const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const analytics = require("../../temp/analytics.cjs");

function memoryQueueStorage(initial) {
    let entries = Array.isArray(initial) ? initial.slice() : [];
    return {
        clear() { entries = []; },
        load() { return entries.slice(); },
        save(value) {
            entries = value.slice();
            return entries;
        },
    };
}

const noTimers = {
    clearTimeout() {},
    setTimeout() { return 1; },
};

test("dual-sink contract fixture shares one canonical id and contains no raw navigation fields", () => {
    const fixturePath = path.resolve(__dirname, "../../docs/fixtures/analytics-dual-sink-v1.json");
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    const canonical = fixture.canonical_event;
    const trackingEvent = fixture.tracking.request.events[0];
    const trafficEvent = fixture.traffic.request.events[0];
    assert.equal(trackingEvent.event_id, canonical.event_id);
    assert.equal(trafficEvent.event_id, canonical.event_id);
    assert.deepEqual(analytics.projectTrackingEvent(canonical), trackingEvent);
    assert.deepEqual(
        analytics.projectTrafficEvent({ ...canonical, ...fixture.traffic_finalization }),
        trafficEvent
    );
    assert.equal(Object.prototype.hasOwnProperty.call(trafficEvent.target, "key"), false);

    const forbidden = new Set(fixture.privacy_assertions.payload_fields_that_must_be_absent.map((key) => key.toLowerCase()));
    function assertSafeKeys(value) {
        if (Array.isArray(value)) return value.forEach(assertSafeKeys);
        if (!value || typeof value !== "object") return;
        Object.keys(value).forEach((key) => {
            assert.equal(forbidden.has(key.toLowerCase()), false, `forbidden payload key: ${key}`);
            assertSafeKeys(value[key]);
        });
    }
    assertSafeKeys(fixture.tracking.request);
    assertSafeKeys(fixture.traffic.request);

    assert.deepEqual(analytics.defaultAckDecoder(fixture.tracking.response).deliveries.map((item) => ({
        event_id: item.event_id,
        state: item.state,
    })), [{
        event_id: canonical.event_id,
        state: "accepted",
    }]);
    assert.deepEqual(analytics.defaultAckDecoder(fixture.traffic.response).deliveries.map((item) => ({
        event_id: item.event_id,
        state: item.state,
    })), [{
        event_id: canonical.event_id,
        state: "duplicate",
    }]);
});

test("legacy transport never invents ACK ids for a non-2xx response", async () => {
    const signal = { aborted: false };
    let capturedSignal;
    const transport = analytics.createTransport({
        endpoint: "/batch",
        runtime: {},
        fetch: async (_url, options) => {
            capturedSignal = options.signal;
            return ({
            ok: false,
            status: 400,
            json: async () => ({ acknowledged_event_ids: ["legacy-http-0001"] }),
            });
        },
    });
    const result = await transport.send([{ event_id: "legacy-http-0001" }], { signal });
    assert.equal(capturedSignal, signal);
    assert.equal(result.retryable, true);
    assert.deepEqual(result.confirmedEventIds, []);
});

test("one journal tracks exact delivery state independently for each sink", async () => {
    let trafficCalls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [
            {
                key: "tracking",
                async send(events) {
                    return {
                        ok: true,
                        deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })),
                    };
                },
            },
            {
                key: "traffic",
                async send(events) {
                    trafficCalls += 1;
                    return {
                        ok: trafficCalls > 1,
                        deliveries: events.map((event) => ({
                            event_id: event.event_id,
                            state: trafficCalls > 1 ? "duplicate" : "retry",
                        })),
                    };
                },
            },
        ],
        random: () => 0.5,
        ...noTimers,
    });

    assert.equal(queue.enqueue({ event_id: "canonical-0001", event_type: "page_view" }), true);
    await queue.flush();
    const pending = queue.getState();
    assert.equal(pending.pending, 1);
    assert.equal(pending.pendingDeliveries, 1);
    assert.equal(pending.entries[0].deliveries.tracking.state, "accepted");
    assert.equal(pending.entries[0].deliveries.traffic.state, "retry");

    await queue.flush();
    assert.equal(queue.getState().pending, 0);
    assert.equal(trafficCalls, 2);
    queue.destroy();
});

test("deferred traffic finalizes the same canonical event without creating another page view", async () => {
    const trackingIds = [];
    const trafficEvents = [];
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [
            {
                key: "tracking",
                accepts: () => true,
                async send(events) {
                    trackingIds.push(...events.map((event) => event.event_id));
                    return { deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })) };
                },
            },
            {
                key: "traffic",
                accepts: (event) => event.event_type === "page_view",
                defer: () => true,
                async send(events) {
                    trafficEvents.push(...events);
                    return { deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })) };
                },
            },
        ],
        ...noTimers,
    });
    queue.enqueue({ event_id: "canonical-0002", event_type: "page_view", is_exit: false });
    await queue.flush();
    assert.deepEqual(trackingIds, ["canonical-0002"]);
    assert.equal(trafficEvents.length, 0);
    assert.equal(queue.getState().entries[0].deliveries.traffic.state, "deferred");

    assert.equal(queue.finalize("canonical-0002", "traffic", { duration_ms: 3200, is_exit: true }), true);
    await queue.flush();
    assert.equal(trafficEvents.length, 1);
    assert.equal(trafficEvents[0].event_id, "canonical-0002");
    assert.equal(trafficEvents[0].duration_ms, 3200);
    assert.equal(trafficEvents[0].is_exit, true);
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("legacy queue entries migrate to tracking only", () => {
    const storage = memoryQueueStorage([{
        event: { event_id: "legacy-event-0001" },
        queued_at: Date.now(),
        attempts: 2,
    }]);
    const queue = analytics.createEventQueue({
        storage,
        sinks: [
            { key: "tracking", send: async () => ({ deliveries: [] }) },
            { key: "traffic", send: async () => ({ deliveries: [] }) },
        ],
        ...noTimers,
    });
    const state = queue.getState();
    assert.deepEqual(Object.keys(state.entries[0].deliveries), ["tracking"]);
    assert.equal(state.entries[0].deliveries.tracking.attempts, 2);
    queue.destroy();
});

test("explicit sink keys cannot bypass a sink accepts guard", () => {
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "traffic",
            accepts: (event) => event.event_type === "page_view",
            send: async () => ({ deliveries: [] }),
        }],
        ...noTimers,
    });
    assert.equal(queue.enqueue({ event_id: "guarded-click-0001", event_type: "click" }, {
        sinkKeys: ["traffic"],
    }), false);
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("an explicit dual-sink event fails atomically when either sink is unavailable", () => {
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{ key: "tracking", send: async () => ({ deliveries: [] }) }],
        ...noTimers,
    });
    assert.equal(queue.enqueue({ event_id: "missing-traffic-event-0001", event_type: "page_view" }, {
        sinkKeys: ["tracking", "traffic"],
    }), false);
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("beforeFlush structured disabled block fails closed and clears the journal", async () => {
    let sends = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            async send() {
                sends += 1;
                return { deliveries: [] };
            },
        }],
        beforeFlush: () => ({ blocked: "disabled" }),
        ...noTimers,
    });
    queue.enqueue({ event_id: "blocked-event-0001" });
    await queue.flush();
    const state = queue.getState();
    assert.equal(sends, 0);
    assert.equal(state.blocked, true);
    assert.equal(state.blockReason.reason, "disabled");
    assert.equal(state.pending, 0);
    assert.equal(queue.enqueue({ event_id: "blocked-event-0002" }), false);
    assert.equal(queue.unblock(), true);
    assert.equal(queue.getState().blocked, false);
    queue.destroy();
});

test("block aborts inflight work, clears storage, and ignores a late acknowledgement", async () => {
    let resolveSend;
    let capturedSignal;
    class FakeAbortController {
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    }
    const queue = analytics.createEventQueue({
        runtime: { AbortController: FakeAbortController },
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            send(events, context) {
                capturedSignal = context.signal;
                return new Promise((resolve) => { resolveSend = () => resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })),
                }); });
            },
        }],
        ...noTimers,
    });
    queue.enqueue({ event_id: "inflight-event-0001" });
    const flushing = queue.flush();
    assert.equal(typeof resolveSend, "function");
    queue.block("robot");
    assert.equal(capturedSignal.aborted, true);
    assert.equal(queue.getState().pending, 0);
    resolveSend();
    await flushing;
    assert.equal(queue.getState().pending, 0);
    assert.equal(queue.getState().blockReason.reason, "robot");
    queue.destroy();
});

test("clear and cancelInflight abort requests without allowing late ACKs to mutate the journal", async () => {
    const resolvers = [];
    const signals = [];
    class FakeAbortController {
        constructor() {
            this.signal = { aborted: false };
        }
        abort() {
            this.signal.aborted = true;
        }
    }
    const queue = analytics.createEventQueue({
        runtime: { AbortController: FakeAbortController },
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            send(events, context) {
                signals.push(context.signal);
                return new Promise((resolve) => {
                    resolvers.push(() => resolve({
                        deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })),
                    }));
                });
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "cancel-event-0001" });
    const cancelledFlush = queue.flush();
    assert.equal(queue.cancelInflight("manual_cancel"), 1);
    assert.equal(signals[0].aborted, true);
    resolvers.shift()();
    await cancelledFlush;
    assert.deepEqual(queue.getState().eventIds, ["cancel-event-0001"]);

    const clearedFlush = queue.flush();
    assert.equal(queue.clear("privacy_disable"), 1);
    assert.equal(signals[1].aborted, true);
    resolvers.shift()();
    await clearedFlush;
    assert.equal(queue.getState().pending, 0);
    assert.equal(queue.enqueue({ event_id: "cancel-event-0002" }), true);
    queue.destroy();
});

test("cancelInflight releases the send gate when an adapter ignores AbortSignal", async () => {
    let resolveStale;
    let calls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            send(events) {
                calls += 1;
                if (calls === 1) {
                    return new Promise((resolve) => {
                        resolveStale = () => resolve({
                            deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })),
                        });
                    });
                }
                return Promise.resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "accepted" })),
                });
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "ignored-abort-event-0001" });
    const staleFlush = queue.flush();
    assert.equal(queue.cancelInflight("config_refresh"), 1);
    const freshFlush = queue.flush();
    await freshFlush;
    assert.equal(calls, 2);
    assert.equal(queue.getState().pending, 0);
    resolveStale();
    await staleFlush;
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("Beacon never changes delivery state, including an oversized first event", () => {
    let beaconCalls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            send: async () => ({ deliveries: [] }),
            sendBeacon() {
                beaconCalls += 1;
                return true;
            },
        }],
        maxBatchBytes: 4096,
        ...noTimers,
    });
    queue.enqueue({ event_id: "beacon-huge-0001", payload: "中".repeat(5000) });
    const before = queue.getState();
    assert.equal(queue.flushBeacon(), false);
    const after = queue.getState();
    assert.equal(beaconCalls, 0);
    assert.equal(after.dropped, before.dropped);
    assert.equal(after.entries[0].deliveries.tracking.state, "pending");
    queue.destroy();
});

test("Beacon fails closed until the global beforeFlush guard succeeds", async () => {
    const guardResults = [true, false, new Error("config unavailable")];
    let beaconCalls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        beforeFlush() {
            const result = guardResults.shift();
            if (result instanceof Error) throw result;
            return result;
        },
        sinks: [{
            key: "tracking",
            send(events) {
                return Promise.resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "retry" })),
                });
            },
            sendBeacon() {
                beaconCalls += 1;
                return true;
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "guarded-beacon-event-0001" });
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 0);

    await queue.flush();
    assert.equal(queue.flushBeacon(), true);
    assert.equal(beaconCalls, 1);

    await queue.flush();
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 1);

    await queue.flush();
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 1);
    queue.destroy();
});

test("Beacon requires per-sink guard authorization and cancelInflight revokes it", async () => {
    let sinkGuardResult = true;
    let beaconCalls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "tracking",
            beforeFlush() {
                if (sinkGuardResult instanceof Error) throw sinkGuardResult;
                return sinkGuardResult;
            },
            send(events) {
                return Promise.resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "retry" })),
                });
            },
            sendBeacon() {
                beaconCalls += 1;
                return true;
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "sink-guarded-beacon-event-0001" });
    assert.equal(queue.flushBeacon(), false);

    await queue.flush();
    assert.equal(queue.flushBeacon(), true);
    assert.equal(beaconCalls, 1);

    assert.equal(queue.cancelInflight("config_refresh"), 0);
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 1);

    sinkGuardResult = false;
    await queue.flush();
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 1);

    sinkGuardResult = new Error("sink config unavailable");
    await queue.flush();
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconCalls, 1);
    queue.destroy();
});

test("Beacon remains immediately available when no beforeFlush hook is configured", () => {
    let beaconCalls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [{
            key: "legacy",
            send: async () => ({ deliveries: [] }),
            sendBeacon() {
                beaconCalls += 1;
                return true;
            },
        }],
        ...noTimers,
    });
    queue.enqueue({ event_id: "legacy-beacon-event-0001" });
    assert.equal(queue.flushBeacon(), true);
    assert.equal(beaconCalls, 1);
    queue.destroy();
});

test("Beacon authorization is revoked when a new event changes the journal", async () => {
    const beaconBatches = [];
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        beforeFlush: () => true,
        sinks: [{
            key: "tracking",
            send(events) {
                return Promise.resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "retry" })),
                });
            },
            sendBeacon(events) {
                beaconBatches.push(events.map((event) => event.event_id));
                return true;
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "beacon-journal-event-a" });
    await queue.flush();
    assert.equal(queue.flushBeacon(), true);

    queue.enqueue({ event_id: "beacon-journal-event-b" });
    assert.equal(queue.flushBeacon(), false);
    assert.deepEqual(beaconBatches, [["beacon-journal-event-a"]]);

    await queue.flush();
    assert.equal(queue.flushBeacon(), true);
    assert.deepEqual(beaconBatches[1], ["beacon-journal-event-a", "beacon-journal-event-b"]);
    queue.destroy();
});

test("Beacon authorization is revoked when Traffic finalization changes its payload", async () => {
    const beaconEvents = [];
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        beforeFlush: () => true,
        sinks: [{
            key: "traffic",
            send(events) {
                return Promise.resolve({
                    deliveries: events.map((event) => ({ event_id: event.event_id, state: "retry" })),
                });
            },
            sendBeacon(events) {
                beaconEvents.push(...events);
                return true;
            },
        }],
        ...noTimers,
    });

    queue.enqueue({ event_id: "beacon-traffic-event-0001", event_type: "page_view" });
    await queue.flush();
    assert.equal(queue.flushBeacon(), true);

    assert.equal(queue.finalize("beacon-traffic-event-0001", "traffic", {
        duration_ms: 4200,
        is_exit: true,
    }), true);
    assert.equal(queue.flushBeacon(), false);
    assert.equal(beaconEvents.length, 1);

    await queue.flush();
    assert.equal(queue.flushBeacon(), true);
    assert.equal(beaconEvents[1].duration_ms, 4200);
    assert.equal(beaconEvents[1].is_exit, true);
    queue.destroy();
});

test("HTTP sink injects encoder, ACK decoder, retry policy, and beacon encoder", async () => {
    const bodies = [];
    const beaconBodies = [];
    let retryContext = null;
    const responses = [
        {
            status: 200,
            json: async () => ({ rows: [
                { id: "http-event-0001", result: "stored" },
                { id: "http-event-0002", result: "again" },
            ] }),
        },
        {
            status: 409,
            json: async () => ({ rows: [{ id: "http-event-0003", result: "stored" }] }),
        },
    ];
    const sink = analytics.createHttpSink({
        key: "custom",
        endpoint: "/batch",
        encoder: (events) => ({ body: JSON.stringify({ custom_events: events }) }),
        ackDecoder: (payload) => ({
            deliveries: payload.rows.map((row) => ({
                event_id: row.id,
                state: row.result === "stored" ? "accepted" : "retry",
            })),
        }),
        retryPolicy(context) {
            retryContext = context;
            return { action: "retry", delayMs: 1200, reason: "heartbeat_required" };
        },
        beaconEncoder: (events) => "beacon:" + events.map((event) => event.event_id).join(","),
        navigator: {
            sendBeacon(_url, body) {
                beaconBodies.push(body);
                return true;
            },
        },
        fetch: async (_url, options) => {
            bodies.push(JSON.parse(options.body));
            return responses.shift();
        },
    });
    const first = await sink.send([{ event_id: "http-event-0001" }, { event_id: "http-event-0002" }]);
    assert.deepEqual(first.deliveries.map((item) => item.state), ["accepted", "retry"]);
    assert.deepEqual(first.confirmedEventIds, ["http-event-0001"]);
    assert.equal(bodies[0].custom_events.length, 2);

    const second = await sink.send([{ event_id: "http-event-0003" }]);
    assert.equal(retryContext.status, 409);
    assert.equal(second.confirmedEventIds.length, 0);
    assert.equal(second.deliveries[0].state, "retry");
    assert.equal(second.deliveries[0].retry_after_ms, 1200);
    assert.equal(sink.sendBeacon([{ event_id: "http-event-0004" }]), true);
    assert.deepEqual(beaconBodies, ["beacon:http-event-0004"]);
});

test("HTTP sink hook failures retain every id for retry", async () => {
    let fetchCalls = 0;
    const encoderFailure = analytics.createHttpSink({
        endpoint: "/batch",
        encoder() {
            throw new Error("encoder failed");
        },
        fetch: async () => {
            fetchCalls += 1;
            return { status: 200, json: async () => ({}) };
        },
    });
    const encoderResult = await encoderFailure.send([{ event_id: "hook-event-0001" }]);
    assert.equal(fetchCalls, 0);
    assert.equal(encoderResult.deliveries[0].state, "retry");

    const decoderFailure = analytics.createHttpSink({
        endpoint: "/batch",
        ackDecoder() {
            throw new Error("decoder failed");
        },
        fetch: async () => ({ status: 200, json: async () => ({}) }),
    });
    const decoderResult = await decoderFailure.send([{ event_id: "hook-event-0002" }]);
    assert.equal(decoderResult.deliveries[0].state, "retry");

    const retryFailure = analytics.createHttpSink({
        endpoint: "/batch",
        retryPolicy() {
            throw new Error("retry policy failed");
        },
        fetch: async () => ({ status: 503, json: async () => ({}) }),
    });
    const retryResult = await retryFailure.send([{ event_id: "hook-event-0003" }]);
    assert.equal(retryResult.deliveries[0].state, "retry");
    assert.deepEqual(retryResult.confirmedEventIds, []);
});

test("HTTP sink honors Retry-After and recognizes non-2xx robot or disabled blocks without ACKing", async () => {
    const responses = [
        {
            status: 429,
            headers: { get: (name) => name === "Retry-After" ? "3" : null },
            json: async () => ({ code: 42910, data: { accepted_event_ids: ["rate-event-0001"] } }),
        },
        {
            status: 429,
            json: async () => ({ code: 42910, data: { retry_after_ms: 1700 } }),
        },
        {
            status: 503,
            json: async () => ({ code: 50310, data: { blocked: "disabled", accepted_event_ids: ["disabled-event-0001"] } }),
        },
    ];
    const sink = analytics.createHttpSink({
        endpoint: "/batch",
        fetch: async () => responses.shift(),
    });
    const limited = await sink.send([{ event_id: "rate-event-0001" }]);
    assert.deepEqual(limited.confirmedEventIds, []);
    assert.equal(limited.deliveries[0].state, "retry");
    assert.equal(limited.deliveries[0].retry_after_ms, 3000);

    const bodyLimited = await sink.send([{ event_id: "body-rate-event-0001" }]);
    assert.equal(bodyLimited.deliveries[0].state, "retry");
    assert.equal(bodyLimited.deliveries[0].retry_after_ms, 1700);

    const disabled = await sink.send([{ event_id: "disabled-event-0001" }]);
    assert.deepEqual(disabled.confirmedEventIds, []);
    assert.equal(disabled.block.reason, "disabled");
});

test("2xx empty ACK retries, while ignored_robot atomically blocks the queue", async () => {
    const responses = [
        { status: 200, json: async () => ({ code: 0, data: { accepted: 1 } }) },
        {
            status: 200,
            json: async () => ({ code: 0, data: { items: [{ event_id: "robot-event-0001", status: "ignored_robot" }] } }),
        },
    ];
    const sink = analytics.createTrackingSink({
        endpoint: "/tracking",
        fetch: async () => responses.shift(),
    });
    const emptyAck = await sink.send([{ event_id: "empty-ack-event-0001" }]);
    assert.equal(emptyAck.confirmedEventIds.length, 0);
    assert.equal(emptyAck.deliveries[0].state, "retry");

    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        sinks: [sink],
        ...noTimers,
    });
    queue.enqueue({ event_id: "robot-event-0001" });
    await queue.flush();
    assert.equal(queue.getState().blocked, true);
    assert.equal(queue.getState().blockReason.reason, "robot");
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("TrafficSink partitions session context and never reinterprets interaction targets", async () => {
    const payloads = [];
    const sink = analytics.createTrafficSink({
        endpoint: "/traffic",
        fetch: async (_url, options) => {
            const payload = JSON.parse(options.body);
            payloads.push(payload);
            return {
                status: 200,
                json: async () => ({
                    code: 0,
                    data: {
                        items: payload.events.map((event) => ({ event_id: event.event_id, status: "accepted" })),
                    },
                }),
            };
        },
    });
    const base = {
        event_type: "page_view",
        instance_id: "instance-0001",
        surface: "pc_web",
        domain: "www.jx3box.com",
        game_client: "std",
        occurred_at: "2026-08-26T01:20:30.000Z",
        project: "index",
        route_pattern: "/item/:id",
        route_path: "https://www.jx3box.com/item/secret?uid=42#raw",
        page_key: "index.item",
        public_target: { type: "item", id: "12345" },
        interaction_target: { type: "button", id: "private-dom-id" },
        referrer_domain: "ref.example",
    };
    const result = await sink.send([
        { ...base, event_id: "traffic-event-0001", session_id: "session-0001" },
        { ...base, event_id: "traffic-event-0002", session_id: "session-0002" },
    ]);
    assert.equal(payloads.length, 2);
    assert.deepEqual(payloads.map((payload) => payload.session_id).sort(), ["session-0001", "session-0002"]);
    assert.equal(payloads[0].events[0].path, "/item/:id");
    assert.deepEqual(payloads[0].events[0].target, { type: "item", id: "12345" });
    const serialized = JSON.stringify(payloads);
    assert.doesNotMatch(serialized, /uid=42|private-dom-id|www\.jx3box\.com\/item\/secret/);
    assert.equal(result.confirmedEventIds.length, 2);
});

test("TrafficSink keeps optional route templates, strips target key, and fails closed without project", async () => {
    const projected = analytics.projectTrafficEvent({
        event_id: "traffic-project-0001",
        route_pattern: "/item/:item_id?/**",
        route_path: "https://www.jx3box.com/item/1?token=raw",
        public_target: { key: "id", type: "item", id: "12345", revision_id: "678" },
    });
    assert.equal(projected.route_pattern, "/item/:item_id?/**");
    assert.equal(projected.path, "/__unclassified__");
    assert.deepEqual(projected.target, { type: "item", id: "12345", revision_id: "678" });

    let fetchCalls = 0;
    const sink = analytics.createTrafficSink({
        endpoint: "/traffic",
        fetch: async () => {
            fetchCalls += 1;
            return { status: 200, json: async () => ({}) };
        },
    });
    const result = await sink.send([{
        event_id: "traffic-project-0001",
        event_type: "page_view",
        instance_id: "instance-0001",
        session_id: "session-0001",
        surface: "pc_web",
        route_pattern: "/index",
        route_path: "/index",
    }]);
    assert.equal(fetchCalls, 0);
    assert.deepEqual(result.confirmedEventIds, []);
    assert.equal(result.deliveries[0].state, "retry");
});
