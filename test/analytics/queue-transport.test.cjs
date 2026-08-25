const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../temp/analytics.cjs");

function memoryQueueStorage() {
    let entries = [];
    return {
        load: () => entries.slice(),
        save: (value) => {
            entries = value.slice();
            return entries;
        },
    };
}

const noTimers = {
    setTimeout: () => 1,
    clearTimeout: () => {},
};

test("transport uses dynamic headers and exact acknowledgement ids", async () => {
    let request = null;
    const transport = analytics.createTransport({
        endpoint: "/batch",
        runtime: {},
        headersProvider: () => ({ Authorization: "Basic live-token" }),
        fetch: async (url, options) => {
            request = { url, options };
            return {
                ok: true,
                status: 200,
                json: async () => ({ acknowledged_event_ids: ["a"], retry_event_ids: ["b"] }),
            };
        },
    });
    const result = await transport.send([{ event_id: "a" }, { event_id: "b" }]);
    assert.equal(request.url, "/batch");
    assert.equal(request.options.headers.Authorization, "Basic live-token");
    assert.equal(request.options.credentials, "include");
    assert.deepEqual(result.confirmedEventIds, ["a"]);
});

test("transport reads wrapped acknowledgements and requires explicit ids", async () => {
    const responses = [
        { data: { acknowledged_event_ids: ["a"], retry_event_ids: ["b"] } },
        { code: 0, data: null },
    ];
    const transport = analytics.createTransport({
        endpoint: "/batch",
        runtime: {},
        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => responses.shift(),
        }),
    });
    const wrapped = await transport.send([{ event_id: "a" }, { event_id: "b" }]);
    assert.equal(wrapped.ok, false);
    assert.deepEqual(wrapped.confirmedEventIds, ["a"]);
    const empty = await transport.send([{ event_id: "b" }]);
    assert.equal(empty.ok, false);
    assert.equal(empty.retryable, true);
    assert.deepEqual(empty.confirmedEventIds, []);
});

test("transport never invents acknowledgement when fetch is unavailable", async () => {
    const transport = analytics.createTransport({ endpoint: "/batch", runtime: {} });
    const result = await transport.send([{ event_id: "a" }]);
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
    assert.deepEqual(result.confirmedEventIds, []);
});

test("explicit empty acknowledgement never falls back to confirming the whole batch", async () => {
    const transport = analytics.createTransport({
        endpoint: "/batch",
        runtime: {},
        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({ acknowledged_event_ids: [], retry_event_ids: ["a", "b"] }),
        }),
    });
    const result = await transport.send([{ event_id: "a" }, { event_id: "b" }]);
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
    assert.deepEqual(result.confirmedEventIds, []);
});

test("transport ignores acknowledgement ids outside the active batch", async () => {
    const transport = analytics.createTransport({
        endpoint: "/batch",
        runtime: {},
        fetch: async () => ({
            ok: true,
            status: 200,
            json: async () => ({ acknowledged_event_ids: ["a", "not-in-this-batch"] }),
        }),
    });
    const result = await transport.send([{ event_id: "a" }, { event_id: "b" }]);
    assert.equal(result.ok, false);
    assert.equal(result.retryable, true);
    assert.deepEqual(result.confirmedEventIds, ["a"]);
});

test("queue only removes ids confirmed from the active batch", async () => {
    let resolveSend;
    const transport = {
        send: () => new Promise((resolve) => {
            resolveSend = resolve;
        }),
        sendBeacon: () => false,
    };
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        transport,
        batchSize: 1,
        flushIntervalMs: 60_000,
        ...noTimers,
    });
    queue.enqueue({ event_id: "first" });
    const sending = queue.flush();
    queue.enqueue({ event_id: "second" });
    resolveSend({ ok: true, retryable: false, confirmedEventIds: ["first"] });
    await sending;
    assert.deepEqual(queue.getState().eventIds, ["second"]);
    queue.destroy();
});

test("beacon never acknowledges or deletes queued events", () => {
    let beaconEvents = null;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        transport: {
            send: async () => ({ ok: true, confirmedEventIds: [] }),
            sendBeacon: (events) => {
                beaconEvents = events;
                return true;
            },
        },
        ...noTimers,
    });
    queue.enqueue({ event_id: "same-id" });
    assert.equal(queue.flushBeacon(), true);
    assert.equal(beaconEvents[0].event_id, "same-id");
    assert.deepEqual(queue.getState().eventIds, ["same-id"]);
    queue.destroy();
});

test("beacon batch also respects the UTF-8 byte limit", () => {
    let beaconEvents = null;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        transport: {
            send: async () => ({ ok: true, confirmedEventIds: [] }),
            sendBeacon: (events) => {
                beaconEvents = events;
                return true;
            },
        },
        maxBatchBytes: 4096,
        ...noTimers,
    });
    queue.enqueue({ event_id: "a", payload: "中".repeat(900) });
    queue.enqueue({ event_id: "b", payload: "中".repeat(900) });
    assert.equal(queue.flushBeacon(), true);
    assert.deepEqual(beaconEvents.map((event) => event.event_id), ["a"]);
    assert.deepEqual(queue.getState().eventIds, ["a", "b"]);
    queue.destroy();
});

test("retry is bounded and keeps event_id stable across attempts", async () => {
    const seen = [];
    let calls = 0;
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        transport: {
            async send(events) {
                seen.push(events[0].event_id);
                calls += 1;
                if (calls === 1) return { ok: false, retryable: true, confirmedEventIds: [] };
                return { ok: true, retryable: false, confirmedEventIds: [events[0].event_id] };
            },
            sendBeacon: () => false,
        },
        maxRetries: 2,
        ...noTimers,
    });
    queue.enqueue({ event_id: "retry-id" });
    await queue.flush();
    assert.deepEqual(queue.getState().eventIds, ["retry-id"]);
    await queue.flush();
    assert.deepEqual(seen, ["retry-id", "retry-id"]);
    assert.equal(queue.getState().pending, 0);
    queue.destroy();
});

test("queue drops oldest entries and oversized single events", async () => {
    const reasons = [];
    const queue = analytics.createEventQueue({
        storage: memoryQueueStorage(),
        transport: {
            send: async (events) => ({ ok: true, confirmedEventIds: events.map((event) => event.event_id) }),
            sendBeacon: () => false,
        },
        batchSize: 1,
        maxEvents: 2,
        maxBatchBytes: 4096,
        onDrop: (reason) => reasons.push(reason),
        ...noTimers,
    });
    queue.enqueue({ event_id: "a" });
    queue.enqueue({ event_id: "b" });
    queue.enqueue({ event_id: "c" });
    assert.deepEqual(queue.getState().eventIds, ["b", "c"]);
    queue.enqueue({ event_id: "huge", payload: "中".repeat(5000) });
    await queue.flush();
    await queue.flush();
    assert.ok(reasons.includes("queue_limit"));
    assert.ok(reasons.includes("event_too_large"));
    queue.destroy();
});
