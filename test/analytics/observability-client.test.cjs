const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const observability = require("../../temp/observability.cjs");
const { createRuntime, okResponse } = require("./helpers.cjs");

function createAxiosHarness() {
    const requests = [];
    const responses = [];
    return {
        interceptors: {
            request: {
                use(fulfilled, rejected) {
                    requests.push({ fulfilled, rejected, active: true });
                    return requests.length - 1;
                },
                eject(id) {
                    if (requests[id]) requests[id].active = false;
                },
            },
            response: {
                use(fulfilled, rejected) {
                    responses.push({ fulfilled, rejected, active: true });
                    return responses.length - 1;
                },
                eject(id) {
                    if (responses[id]) responses[id].active = false;
                },
            },
        },
        async request(config, result, reject) {
            let currentConfig = config;
            for (const handler of requests.filter((item) => item.active)) {
                currentConfig = await handler.fulfilled(currentConfig);
            }
            if (reject) {
                reject.config = currentConfig;
                let error = reject;
                for (const handler of responses.filter((item) => item.active)) {
                    try {
                        error = await handler.rejected(error);
                    } catch (nextError) {
                        error = nextError;
                    }
                }
                throw error;
            }
            const responseValue = typeof result === "function" ? result(currentConfig) : result;
            let response = responseValue;
            response.config = currentConfig;
            for (const handler of responses.filter((item) => item.active)) {
                response = await handler.fulfilled(response);
            }
            return response;
        },
        state() {
            return {
                request: requests.filter((item) => item.active).length,
                response: responses.filter((item) => item.active).length,
            };
        },
    };
}

function createObserver(runtime, extra) {
    const requests = [];
    const observer = observability.createClientObserver(Object.assign({
        enabled: true,
        runtime,
        projectKey: "index",
        environment: "production",
        release: "9.4.0-test",
        webVersion: "9.4.0-test",
        client: "pc_web",
        platform: "macos",
        setTimeout: () => 1,
        clearTimeout: () => {},
        fetch: async (url, options) => {
            const payload = JSON.parse(options.body);
            requests.push({ url, options, payload });
            const items = (payload.events || payload.metrics).map((item) => ({
                event_id: item.event_id,
                metric_id: item.metric_id,
                status: "accepted",
            }));
            return okResponse({ code: 0, data: { items } });
        },
    }, extra || {}));
    return { observer, requests };
}

test("observer is inert until explicitly enabled with complete metadata", () => {
    const runtime = createRuntime();
    const before = runtime.localStorage.dump();
    const disabled = observability.createClientObserver({
        runtime,
        projectKey: "index",
        release: "test",
        client: "pc_web",
        platform: "macos",
    });
    assert.equal(disabled.start(), false);
    assert.equal(disabled.captureError(new Error("ignored")), null);
    assert.equal(disabled.getState().identityCreated, false);
    assert.deepEqual(runtime.localStorage.dump(), before);
    assert.deepEqual(runtime.__windowListeners, {});

    const incomplete = observability.createClientObserver({ enabled: true, runtime, projectKey: "index" });
    assert.equal(incomplete.start(), false);
    assert.equal(incomplete.getState().identityCreated, false);
});

test("raw location is ignored while explicit route templates and late disposers stay safe", () => {
    const runtime = createRuntime();
    runtime.location.pathname = "/user/13800138000/order/123456789";
    const created = createObserver(runtime);
    created.observer.start();
    assert.equal(created.observer.getState().routePattern, "/");
    assert.equal(created.observer.setRoute("/post/:id"), "/post/:id");
    assert.equal(created.observer.setRoute("/archive/2026"), "/archive/2026");
    created.observer.destroy();
    let disposed = 0;
    created.observer.registerDisposer(() => { disposed += 1; });
    assert.equal(disposed, 1);
});

test("error envelope keeps metadata snapshot and removes sensitive text", async () => {
    const runtime = createRuntime();
    const created = createObserver(runtime);
    const error = new Error("Load https://api.example.test/post/8719?token=raw-secret for user@example.com");
    error.stack = "Error: token=raw-secret\n    at https://cdn.example.test/app.js?signature=private:10:2";
    created.observer.setRoute("/post/:id?draft=secret");
    const eventId = created.observer.captureError(error, { source: "startup", severity: "fatal" });
    assert.equal(typeof eventId, "string");
    await created.observer.flush();
    const request = created.requests.find((item) => item.payload.events);
    assert.ok(request);
    assert.equal(request.payload.project_key, "index");
    assert.equal(request.payload.release, "9.4.0-test");
    assert.equal(request.payload.events[0].event_id, eventId);
    assert.equal(request.payload.events[0].message, "Application startup error");
    assert.equal(request.payload.events[0].route_pattern, "/post/:id");
    const serialized = JSON.stringify(request.payload);
    assert.doesNotMatch(serialized, /raw-secret|user@example\.com|signature=private/);
    assert.doesNotMatch(serialized, /headers|request_body|response_body|is_robot|user_input/);
    created.observer.destroy();
});

test("Axios aggregates safe routes and preserves request values", async () => {
    const runtime = createRuntime();
    let current = Date.parse("2026-08-26T08:00:00.000Z");
    const created = createObserver(runtime, { now: () => current });
    const axios = createAxiosHarness();
    const dispose = created.observer.observeAxios(axios, {
        serviceKey: "cms",
        now: () => current,
        classifyResponse: (response) => !response.data.code,
    });
    const config = {
        method: "post",
        url: "https://cms.jx3box.com/api/cms/post/8719?token=raw-secret#private",
        telemetryRoute: "/api/cms/archive/2026?token=ignored",
        headers: { Authorization: "Bearer raw-secret" },
        params: { keyword: "private-input" },
        data: { content: "private-body" },
    };
    const response = { status: 200, data: { code: 500, msg: "private-response" } };
    const returned = await axios.request(config, () => {
        current += 1250;
        return response;
    });
    assert.equal(returned.data, response.data);
    await created.observer.flush();
    const request = created.requests.find((item) => item.payload.metrics);
    const metric = request.payload.metrics[0];
    assert.equal(metric.service_key, "cms");
    assert.equal(metric.http_method, "POST");
    assert.equal(metric.api_route, "/api/cms/archive/2026");
    assert.equal(metric.request_count, 1);
    assert.equal(metric.business_error_count, 1);
    assert.equal(metric.latency_1000_2999_count, 1);
    const serialized = JSON.stringify(request.payload);
    assert.doesNotMatch(serialized, /raw-secret|private-input|private-body|private-response|Authorization/);
    dispose();
    assert.deepEqual(axios.state(), { request: 0, response: 0 });
    created.observer.destroy();
});

test("Axios rejection and unhandledrejection share one runtime error", async () => {
    const runtime = createRuntime();
    let current = Date.parse("2026-08-26T08:00:00.000Z");
    const created = createObserver(runtime, { now: () => current, captureRequestErrors: true });
    const axios = createAxiosHarness();
    created.observer.start();
    created.observer.observeAxios(axios, { serviceKey: "next", now: () => current });
    const error = new Error("Network Error token=private");
    error.code = "ERR_NETWORK";
    current += 100;
    await assert.rejects(
        axios.request({ method: "get", url: "/api/next/item/123456?token=private" }, null, error),
        (received) => received === error,
    );
    assert.equal(created.observer.getState().errors.pending, 1);
    runtime.__windowListeners.unhandledrejection({ reason: error });
    assert.equal(created.observer.getState().errors.pending, 1);
    await created.observer.flush();
    const errorEvents = created.requests.flatMap((item) => item.payload.events || []);
    const metrics = created.requests.flatMap((item) => item.payload.metrics || []);
    assert.equal(errorEvents.length, 1);
    assert.equal(errorEvents[0].source, "request_unhandled");
    assert.equal(metrics.length, 1);
    assert.equal(metrics[0].network_error_count, 1);
    assert.equal(metrics[0].api_route, "/api/next/item/:id");
    created.observer.destroy();
});

test("Axios request failures default to HTTP health without creating runtime Issues", async () => {
    const runtime = createRuntime();
    const created = createObserver(runtime);
    const axios = createAxiosHarness();
    created.observer.start();
    created.observer.observeAxios(axios, { serviceKey: "cms" });
    const error = Object.assign(new Error("expected 404"), {
        response: { status: 404 },
    });
    await assert.rejects(axios.request({ method: "get", url: "/api/cms/post/404" }, null, error));
    runtime.__windowListeners.unhandledrejection({ reason: error });
    assert.equal(created.observer.getState().errors.pending, 0);
    assert.equal(created.observer.getState().metricBuckets, 1);
    created.observer.destroy();
});

test("common Axios registry remains explicit and exceptions are isolated", () => {
    const target = {};
    const calls = [];
    assert.doesNotThrow(() => observability.installHttpObserver(target, {}, "cms"));
    const unregister = observability.setHttpObserver({
        observeAxios(instance, options) {
            calls.push({ instance, options });
            throw new Error("observer failure");
        },
    });
    assert.doesNotThrow(() => observability.installHttpObserver(target, {}, "cms", () => true));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].instance, target);
    assert.equal(calls[0].options.serviceKey, "cms");
    observability.installHttpObserver(target, { telemetry: false }, "cms");
    assert.equal(calls.length, 1);
    unregister();
    observability.installHttpObserver(target, {}, "cms");
    assert.equal(calls.length, 1);
});

test("Axios observation failures never change fulfilled or rejected values", async () => {
    const axios = createAxiosHarness();
    const observer = {
        recordHttp() {
            throw new Error("record failed");
        },
        captureError() {
            throw new Error("capture failed");
        },
        markHttpObserved() {
            throw new Error("mark failed");
        },
    };
    const disposeFirst = observability.installAxiosObserver(axios, observer, {
        serviceKey: "cms",
        captureRequestErrors: true,
    });
    const disposeSecond = observability.installAxiosObserver(axios, observer, { serviceKey: "cms" });
    assert.deepEqual(axios.state(), { request: 1, response: 1 });

    const response = { status: 200, data: { code: 0 } };
    assert.equal(await axios.request({ method: "get", url: "/api/test" }, response), response);
    const error = new Error("original");
    await assert.rejects(
        axios.request({ method: "get", url: "/api/test" }, null, error),
        (received) => received === error,
    );

    disposeFirst();
    assert.deepEqual(axios.state(), { request: 1, response: 1 });
    disposeSecond();
    assert.deepEqual(axios.state(), { request: 0, response: 0 });
});

test("HTTP route fallback joins base paths and metric dimensions stay bounded", () => {
    assert.equal(observability.resolveRequestRoute({
        baseURL: "https://cms.jx3box.com/api/cms/",
        url: "/post/8719?token=private",
    }), "/api/cms/post/:id");
    assert.equal(observability.resolveRequestRoute({
        baseURL: "https://cms.jx3box.com/api/cms/",
        url: "/api/cms/post/8719",
    }), "/api/cms/post/:id");

    const emitted = [];
    const dropped = [];
    const collector = observability.createHttpMetricCollector({
        autoClose: false,
        bucketSeconds: 60.9,
        maxBuckets: 1,
        emit: (metric) => emitted.push(metric),
        onDrop: (reason) => dropped.push(reason),
    });
    assert.equal(collector.record({
        service_key: "cms",
        http_method: "GET",
        api_route: "/one",
        outcome: "success",
        latency_ms: 1,
    }), true);
    assert.equal(collector.record({
        service_key: "cms",
        http_method: "GET",
        api_route: "/two",
        outcome: "success",
        latency_ms: 1,
    }), false);
    assert.deepEqual(dropped, ["metric_dimension_limit"]);
    collector.flush();
    assert.equal(emitted[0].bucket_seconds, 60);
    collector.destroy();
});

test("HTTP collector splits a minute before latency_sum_ms exceeds Joi limits", () => {
    const emitted = [];
    const runtime = createRuntime();
    const current = Date.parse("2026-08-26T08:00:00.000Z");
    const collector = observability.createHttpMetricCollector({
        autoClose: false,
        now: () => current,
        runtime,
        emit: (metric, metadata) => emitted.push({ metric, metadata }),
    });
    const input = {
        occurred_at_ms: current,
        service_key: "cms",
        http_method: "GET",
        api_route: "/api/cms/slow/:id",
        _api_route_template: true,
        outcome: "timeout",
        latency_ms: 86_400_000,
        metadata: { release: "same-release" },
    };
    for (let index = 0; index < 12; index += 1) assert.equal(collector.record(input), true);
    collector.flush();

    assert.equal(emitted.length, 2);
    assert.notEqual(emitted[0].metric.metric_id, emitted[1].metric.metric_id);
    assert.ok(emitted.every((item) => item.metric.latency_sum_ms <= 1_000_000_000));
    assert.equal(emitted.reduce((sum, item) => sum + item.metric.request_count, 0), 12);
    assert.equal(emitted.reduce((sum, item) => sum + item.metric.timeout_count, 0), 12);
    assert.equal(emitted.reduce((sum, item) => sum + item.metric.latency_gte_10000_count, 0), 12);
    assert.equal(emitted.reduce((sum, item) => sum + item.metric.slow_count, 0), 12);
    assert.equal(emitted.reduce((sum, item) => sum + item.metric.latency_sum_ms, 0), 12 * 86_400_000);
    assert.ok(emitted.every((item) => item.metric.bucket_start === emitted[0].metric.bucket_start));
    assert.ok(emitted.every((item) => item.metadata.release === "same-release"));
    collector.destroy();
});

test("observer flush projects thrown transport errors without request secrets", async () => {
    const runtime = createRuntime();
    const thrown = {
        message: "native request failed",
        config: {
            headers: { Authorization: "Bearer private-token" },
            data: "private-request-body",
        },
        response: { data: "private-response-body" },
    };
    const created = createObserver(runtime, { fetch: async () => { throw thrown; } });
    created.observer.captureError(new Error("SummerRain"), { source: "startup" });
    const result = await created.observer.flush();
    const serialized = JSON.stringify(result);

    assert.deepEqual(Object.keys(result.errors.result).sort(), ["confirmedEventIds", "ok", "retryable", "status"]);
    assert.doesNotMatch(serialized, /Authorization|private-token|private-request|private-response|SummerRain|groupResults|native request failed|config/);
    created.observer.destroy();
});

test("common request factories install Observer before business interceptors", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../../js/api.js"), "utf8");
    const cmsStart = source.indexOf("function $cms");
    const helperStart = source.indexOf("function $helper");
    const cmsBlock = source.slice(cmsStart, helperStart);
    assert.ok(cmsBlock.indexOf("installHttpObserver") < cmsBlock.indexOf("installStandardInterceptors"));
    assert.match(source, /installHttpObserver\(ins, options, serviceKey/);
    assert.match(source, /installHttpObserver\(ins, options, "helper"/);
    assert.match(source, /installHttpObserver\(ins, options, "node"/);
    assert.match(source, /installHttpObserver\(ins, options, "http"/);
    assert.match(source, /installHttpObserver,\s*setHttpObserver/);
});
