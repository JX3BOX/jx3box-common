const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "../..");

function loadSource(relativePath) {
    const filename = path.join(root, relativePath);
    const result = esbuild.buildSync({
        entryPoints: [filename],
        bundle: true,
        format: "cjs",
        platform: "node",
        target: ["node18"],
        write: false,
    });
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = module.paths;
    loaded._compile(result.outputFiles[0].text, filename);
    return loaded.exports;
}

const dedupe = loadSource("js/observability/dedupe.js");
const privacy = loadSource("js/observability/privacy.js");
const transportModule = loadSource("js/observability/transport.js");
const native = loadSource("js/observability/native.js");

const metadata = {
    instance_id: "instance-6a8a9424",
    project_key: "index",
    environment: "production",
    release: "2026.08.26-a1b2c3d",
    sdk_version: "1.0.0",
    client: "pc_web",
    platform: "windows",
    app_version: null,
    app_build: null,
    web_version: "a1b2c3d",
};

function validError(source, extra) {
    return Object.assign({
        occurred_at: new Date().toISOString(),
        source: source || "vue",
        severity: "error",
        error_name: "Error",
        message: "Safe error",
        stack: null,
        route_pattern: "/tool/:id",
        breadcrumbs: null,
        occurrence_count: 1,
    }, extra || {});
}

function validMetric(extra) {
    return Object.assign({
        bucket_start: new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString(),
        bucket_seconds: 60,
        service_key: "cms",
        http_method: "GET",
        api_route: "/api/cms/post/:id",
        request_count: 1,
        success_count: 1,
        business_error_count: 0,
        http_4xx_count: 0,
        http_5xx_count: 0,
        timeout_count: 0,
        network_error_count: 0,
        offline_count: 0,
        cancelled_count: 0,
        slow_count: 0,
        latency_lt_300_count: 1,
        latency_300_999_count: 0,
        latency_1000_2999_count: 0,
        latency_3000_9999_count: 0,
        latency_gte_10000_count: 0,
        latency_sum_ms: 100,
        max_latency_ms: 100,
    }, extra || {});
}

function response(payload, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            return payload;
        },
    };
}

test("object telemetry marker is non-enumerable and frozen objects use the WeakMap fallback", () => {
    const error = new Error("network");
    const marked = dedupe.markTelemetryObject(error, "event-6a8a9424");
    assert.equal(marked, "event-6a8a9424");
    assert.equal(dedupe.getTelemetryEventId(error), marked);
    const descriptor = Object.getOwnPropertyDescriptor(error, dedupe.TELEMETRY_EVENT_ID);
    assert.equal(descriptor.enumerable, false);
    assert.equal(JSON.stringify(error).includes(marked), false);

    const frozen = Object.freeze({});
    assert.equal(dedupe.markTelemetryObject(frozen, "event-frozen-1"), "event-frozen-1");
    assert.equal(dedupe.getTelemetryEventId(frozen), "event-frozen-1");
    assert.equal(Object.prototype.hasOwnProperty.call(frozen, dedupe.TELEMETRY_EVENT_ID), false);

    const responseObject = {};
    const linkedId = dedupe.linkTelemetryObjects([error, responseObject]);
    assert.equal(linkedId, marked);
    assert.equal(dedupe.getTelemetryEventId(responseObject), marked);
});

test("privacy normalizes API routes and strips identifiers and sensitive text", () => {
    assert.equal(
        privacy.normalizeApiRoute(
            "https://user:password@example.com/api/post/8719/67ef43f2-7981-4706-8177-a73a39e9aa12/abcdef1234567890?token=secret#x"
        ),
        "/api/post/:id/:id/:id"
    );
    assert.equal(
        privacy.normalizeApiRoute("https://example.com/ignored/123", "/api/post/8719?token=secret#x"),
        "/api/post/8719"
    );

    const message = privacy.sanitizeErrorMessage(
        "GET https://example.com/user/8719?token=private Authorization=Bearer.abc foo@example.com " +
            "13800138000 67ef43f2-7981-4706-8177-a73a39e9aa12 password=private " +
            "<main>private-user-text</main> 203.0.113.9 2001:db8:85a3::8a2e:370:7334"
    );
    for (const secret of [
        "?token",
        "Bearer.abc",
        "foo@example.com",
        "13800138000",
        "67ef43f2",
        "password=private",
        "private-user-text",
        "203.0.113.9",
        "2001:db8",
        "<main>",
    ]) {
        assert.equal(message.includes(secret), false, secret);
    }
    assert.equal(privacy.sanitizeErrorMessage(null, "Unknown client error"), "Unknown client error");

    const stack = privacy.sanitizeErrorStack(Array.from({ length: 60 }, (_, index) =>
        `at fn (/Users/alice/project/app.js:${index}:1?token=private)`
    ).join("\n"));
    assert.equal(stack.split("\n").length, 50);
    assert.equal(stack.includes("/Users/alice"), false);
    assert.equal(stack.includes("token=private"), false);

    assert.deepEqual(privacy.sanitizeMetadata({
        ...metadata,
        uid: 8719,
        ip: "203.0.113.1",
        user_agent: "private",
        is_robot: false,
        token: "private",
    }), metadata);
});

test("error transport groups by metadata and session and confirms only terminal ACK statuses", async () => {
    const requests = [];
    const transport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        fetch: async (url, options) => {
            const body = JSON.parse(options.body);
            requests.push({ url, body });
            return response({
                code: 0,
                data: {
                    items: body.events.map((event, index) => ({
                        event_id: event.event_id,
                        status: index ? "duplicate" : body.session_id === "session-a" ? "accepted" : "ignored_robot",
                    })),
                },
            });
        },
    });
    const items = [
        { event_id: "event-0001", _metadata: metadata, _session_id: "session-a", event: validError("vue") },
        { event_id: "event-0002", _metadata: { ...metadata }, _session_id: "session-a", event: validError("router") },
        { event_id: "event-0003", _metadata: { ...metadata, release: "release-b" }, _session_id: "session-b", event: validError("chunk") },
    ];
    const result = await transport.send(items);

    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].body.events.map((event) => event.event_id), ["event-0001", "event-0002"]);
    assert.equal(requests[0].body.session_id, "session-a");
    assert.equal(Object.prototype.hasOwnProperty.call(requests[0].body, "_metadata"), false);
    assert.deepEqual(result.confirmedEventIds, ["event-0001", "event-0002", "event-0003"]);
    assert.equal(result.ok, true);

    const retryTransport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        fetch: async () => response({ data: { items: [{ event_id: "event-0004", status: "rejected" }] } }),
    });
    const retry = await retryTransport.send([
        { event_id: "event-0004", _metadata: metadata, _session_id: "session-a", event: validError("vue") },
    ]);
    assert.deepEqual(retry.confirmedEventIds, []);
    assert.equal(retry.retryable, true);
});

test("metric transport maps queue event_id to metric_id", async () => {
    let envelope;
    const transport = transportModule.createObservabilityTransport({
        kind: "metric",
        endpoint: "/system/stat/api-metrics/batch",
        fetch: async (_url, options) => {
            envelope = JSON.parse(options.body);
            return response({ data: { items: [{ metric_id: "metric-0001", status: "accepted" }] } });
        },
    });
    const result = await transport.send([
        {
            event_id: "metric-0001",
            _metadata: metadata,
            metric: validMetric(),
        },
    ]);
    assert.equal(envelope.metrics[0].metric_id, "metric-0001");
    assert.equal(Object.prototype.hasOwnProperty.call(envelope.metrics[0], "event_id"), false);
    assert.deepEqual(result.confirmedEventIds, ["metric-0001"]);
});

test("observability transport forwards queue cancellation signals", async () => {
    const signal = { aborted: false };
    let capturedSignal;
    const transport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        fetch: async (_url, options) => {
            capturedSignal = options.signal;
            return response({ data: { items: [{ event_id: "event-signal-0001", status: "accepted" }] } });
        },
    });
    await transport.send([{
        event_id: "event-signal-0001",
        _metadata: metadata,
        _session_id: "session-a",
        event: validError("vue"),
    }], { signal });
    assert.equal(capturedSignal, signal);
});

test("transport enforces payload allowlists and retries non-ACK HTTP failures", async () => {
    const transport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        fetch: async () => response({ code: 400 }, 400),
    });
    const item = {
        event_id: "event-allowlist-1",
        _metadata: { ...metadata, token: "metadata-secret", is_robot: false },
        _session_id: "session-a",
        event: {
            occurred_at: "2026-08-26T10:00:00.000Z",
            source: "vue",
            severity: "error",
            error_name: "SummerRain",
            message: "token=event-secret",
            stack: "SummerRain: private input\n    at render (https://cdn.example.test/app.js?token=private:10:2)",
            route_pattern: "/post/:id?token=private",
            breadcrumbs: null,
            occurrence_count: 1,
            headers: { Authorization: "private" },
            response_body: "private",
            user_input: "private",
            is_robot: false,
        },
    };
    const envelope = transport.createEnvelopes([item])[0];
    assert.deepEqual(Object.keys(envelope).sort(), [
        "app_build",
        "app_version",
        "client",
        "environment",
        "events",
        "instance_id",
        "platform",
        "project_key",
        "release",
        "sdk_version",
        "session_id",
        "web_version",
    ]);
    assert.deepEqual(Object.keys(envelope.events[0]).sort(), [
        "breadcrumbs",
        "error_name",
        "event_id",
        "message",
        "occurred_at",
        "occurrence_count",
        "route_pattern",
        "severity",
        "source",
        "stack",
    ]);
    assert.equal(envelope.events[0].error_name, "Error");
    assert.equal(envelope.events[0].message, "Vue runtime error");
    assert.doesNotMatch(JSON.stringify(envelope), /SummerRain|private input|token=private|event-secret|metadata-secret|Authorization|response_body|user_input|is_robot/);
    const result = await transport.send([item]);
    assert.equal(result.retryable, true);
    assert.deepEqual(result.confirmedEventIds, []);
});

test("transport isolates invalid metrics and chunks direct batches to the server limit", async () => {
    const requests = [];
    const transport = transportModule.createObservabilityTransport({
        kind: "metric",
        endpoint: "/system/stat/api-metrics/batch",
        fetch: async (_url, options) => {
            const envelope = JSON.parse(options.body);
            requests.push(envelope);
            return response({
                data: {
                    items: envelope.metrics.map((metric) => ({ metric_id: metric.metric_id, status: "accepted" })),
                },
            });
        },
    });
    const validItems = Array.from({ length: 21 }, (_, index) => ({
        event_id: `metric-chunk-${String(index).padStart(4, "0")}`,
        _metadata: metadata,
        metric: validMetric({ api_route: `/api/cms/post/${index}` }),
    }));
    const invalid = {
        event_id: "metric-invalid-0001",
        _metadata: metadata,
        metric: validMetric({ success_count: 2 }),
    };
    const result = await transport.send(validItems.concat([invalid]));
    assert.deepEqual(requests.map((item) => item.metrics.length), [20, 1]);
    assert.ok(requests.every((item) => item.metrics.every((metric) => metric.api_route === "/api/cms/post/:id")));
    assert.equal(result.confirmedEventIds.length, 21);
    assert.equal(result.retryable, true);
    assert.equal(result.confirmedEventIds.includes("metric-invalid-0001"), false);
});

test("Beacon uses JSON Blobs, attempts every group, and leaves caller items untouched", async () => {
    const calls = [];
    const navigator = {
        sendBeacon(url, body) {
            calls.push({ url, body });
            return calls.length !== 1;
        },
    };
    const transport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        navigator,
        Blob,
    });
    const items = [
        { event_id: "event-1001", _metadata: metadata, _session_id: "session-a", event: validError("vue") },
        { event_id: "event-1002", _metadata: metadata, _session_id: "session-b", event: validError("router") },
    ];
    const snapshot = JSON.stringify(items);
    assert.equal(transport.sendBeacon(items), false);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].body.type, "application/json");
    assert.equal(JSON.parse(await calls[0].body.text()).events[0].event_id, "event-1001");
    assert.equal(JSON.stringify(items), snapshot);
});

test("native adapters inject callbacks and expose Fetch-compatible responses", async () => {
    let genericRequest;
    const genericFetch = native.createNativeFetchAdapter(async (request) => {
        genericRequest = request;
        return { status: 200, data: JSON.stringify({ code: 0, data: { items: [] } }) };
    });
    const genericResponse = await genericFetch("https://example.com/batch", {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: [] }),
    });
    assert.equal(genericRequest.method, "POST");
    assert.equal(typeof genericRequest.body, "string");
    assert.equal(genericResponse.ok, true);
    assert.equal((await genericResponse.json()).code, 0);

    for (const factory of [native.createCapacitorTransportAdapter, native.createHarmonyTransportAdapter]) {
        let platformRequest;
        const platformFetch = factory(async (request) => {
            platformRequest = request;
            return JSON.stringify({ status: 201, data: JSON.stringify({ accepted: 1 }) });
        });
        const platformResponse = await platformFetch("https://example.com/batch", {
            method: "POST",
            body: JSON.stringify({ events: [{ event_id: "event-1" }] }),
        });
        assert.deepEqual(platformRequest.data, { events: [{ event_id: "event-1" }] });
        assert.equal(platformResponse.status, 201);
        assert.deepEqual(await platformResponse.json(), { accepted: 1 });

        let beaconCalls = 0;
        let nativeCalls = 0;
        const markedFetch = factory(async (request) => {
            nativeCalls += 1;
            const event = request.data.events[0];
            return response({ data: { items: [{ event_id: event.event_id, status: "accepted" }] } });
        });
        const nativeTransport = transportModule.createObservabilityTransport({
            kind: "error",
            endpoint: "https://cms.jx3box.com/api/cms/system/stat/errors/batch",
            fetch: markedFetch,
            runtime: { navigator: { sendBeacon() { beaconCalls += 1; return true; } } },
            navigator: { sendBeacon() { beaconCalls += 1; return true; } },
            Blob,
        });
        const item = { event_id: "event-native-0001", _metadata: metadata, event: validError("vue") };
        assert.equal(nativeTransport.sendBeacon([item]), false);
        assert.equal(beaconCalls, 0);
        assert.deepEqual((await nativeTransport.send([item])).confirmedEventIds, ["event-native-0001"]);
        assert.equal(nativeCalls, 1);

        const wrappedFetch = function () { return markedFetch.apply(null, arguments); };
        const wrappedTransport = transportModule.createObservabilityTransport({
            kind: "error",
            endpoint: "https://cms.jx3box.com/api/cms/system/stat/errors/batch",
            fetch: wrappedFetch,
            transportMode: "native",
            navigator: { sendBeacon() { beaconCalls += 1; return true; } },
            Blob,
        });
        assert.equal(wrappedTransport.sendBeacon([item]), false);
        assert.equal(beaconCalls, 0);
    }
});

test("transport results never expose thrown request secrets", async () => {
    const secret = {
        config: { headers: { Authorization: "Bearer private-token" }, data: "private-request" },
        response: { data: "private-response" },
    };
    const transport = transportModule.createObservabilityTransport({
        kind: "error",
        endpoint: "/system/stat/errors/batch",
        fetch: async () => { throw secret; },
    });
    const result = await transport.send([
        { event_id: "event-secret-0001", _metadata: metadata, event: validError("vue") },
    ]);
    const serialized = JSON.stringify(result);

    assert.deepEqual(Object.keys(result.groupResults[0]).sort(), ["confirmedEventIds", "ok", "retryable", "status"]);
    assert.doesNotMatch(serialized, /Authorization|private-token|private-request|private-response|config/);
});
