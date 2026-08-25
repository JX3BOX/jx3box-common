const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "../..");
const outfile = path.join(root, "temp", "observability-errors.cjs");
fs.mkdirSync(path.dirname(outfile), { recursive: true });

esbuild.buildSync({
    stdin: {
        contents: [
            'export { createErrorEvent } from "./js/observability/error.js";',
            'export { installWindowErrorObserver } from "./js/observability/window.js";',
            'export { installRouterErrorObserver } from "./js/observability/router.js";',
            'export { createVue3ErrorObserverPlugin } from "./js/observability/vue3.js";',
            'export { getTelemetryEventId, markTelemetryObject } from "./js/observability/dedupe.js";',
        ].join("\n"),
        resolveDir: root,
        sourcefile: "observability-errors-test-entry.js",
    },
    outfile,
    bundle: true,
    format: "cjs",
    platform: "node",
    target: ["node18"],
    sourcemap: false,
    minify: false,
});

const observability = require(outfile);

function eventContext(extra) {
    return Object.assign({
        event_id: "12345678-1234-4123-8123-123456789abc",
        occurred_at: "2026-08-26T10:00:00.000Z",
        source: "vue",
    }, extra || {});
}

function createRuntime() {
    const listeners = new Map();
    const removed = [];
    const runtime = {
        addEventListener(type, listener, capture) {
            listeners.set(type, { listener, capture });
        },
        removeEventListener(type, listener, capture) {
            removed.push({ type, listener, capture });
            const current = listeners.get(type);
            if (current && current.listener === listener) listeners.delete(type);
        },
    };
    return { runtime, listeners, removed };
}

test("createErrorEvent emits only the server allowlist and marks the source object", () => {
    const error = new TypeError('request failed token="top-secret" for 13800138000');
    error.stack = 'TypeError: token="top-secret"\n at /Users/alice/project/main.js:12:3';
    const breadcrumbs = Array.from({ length: 12 }, (_, index) => ({
        occurred_at: `2026-08-26T09:${String(index).padStart(2, "0")}:00.000Z`,
        route_pattern: `/post/${index}?token=secret#fragment`,
        query: "must-not-survive",
    }));

    const event = observability.createErrorEvent(error, eventContext({
        severity: "fatal",
        route_pattern: "/post/42?token=secret#fragment",
        breadcrumbs,
        occurrence_count: 20000,
        metadata: { token: "must-not-survive" },
    }));

    assert.deepEqual(Object.keys(event).sort(), [
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
    assert.equal(event.event_id, "12345678-1234-4123-8123-123456789abc");
    assert.equal(event.occurred_at, "2026-08-26T10:00:00.000Z");
    assert.equal(event.source, "vue");
    assert.equal(event.severity, "fatal");
    assert.equal(event.error_name, "TypeError");
    assert.equal(event.message, "Vue runtime error");
    assert.equal(event.route_pattern, "/post/42");
    assert.equal(event.occurrence_count, 10000);
    assert.equal(event.breadcrumbs.length, 10);
    assert.deepEqual(Object.keys(event.breadcrumbs[0]).sort(), ["occurred_at", "route_pattern"]);
    assert.equal(event.message.includes("top-secret"), false);
    assert.equal(event.message.includes("13800138000"), false);
    assert.equal(event.stack.includes("top-secret"), false);
    assert.equal(event.stack.includes("/Users/alice"), false);
    assert.equal(observability.getTelemetryEventId(error), event.event_id);
});

test("raw messages, stack headers, and arbitrary error names are generalized", () => {
    const error = new Error("Invalid nickname SummerRain");
    error.name = "SummerRain";
    error.stack = [
        "SummerRain: Invalid nickname SummerRain",
        "at SummerRain user input",
        "    at render (https://cdn.example.test/app.js?token=private:12:3)",
        "render@https://cdn.example.test/chunk.js?token=private:18:4",
    ].join("\n");
    const event = observability.createErrorEvent(error, eventContext({
        message: "private context message",
        source: "vue",
    }));

    assert.equal(event.error_name, "Error");
    assert.equal(event.message, "Vue runtime error");
    assert.equal(event.stack.split("\n").length, 2);
    assert.doesNotMatch(JSON.stringify(event), /SummerRain|private context|token=private/);
});

test("primitive promise reasons are generalized and invalid event ids fail closed", () => {
    const secretReason = "password=do-not-store";
    const event = observability.createErrorEvent(secretReason, eventContext({ source: "unhandledrejection" }));
    assert.equal(event.error_name, "UnhandledRejection");
    assert.equal(event.message, "Unhandled promise rejection");
    assert.equal(event.stack, null);
    assert.equal(JSON.stringify(event).includes("do-not-store"), false);
    assert.equal(observability.createErrorEvent(new Error("x"), eventContext({ event_id: "short" })), null);
});

test("resource errors never inspect or serialize src and href", () => {
    let sensitiveReads = 0;
    const resource = {
        get src() {
            sensitiveReads += 1;
            return "https://example.test/file.js?token=secret";
        },
        get href() {
            sensitiveReads += 1;
            return "https://example.test/private";
        },
        message: "must-not-survive",
        stack: "must-not-survive",
    };
    const event = observability.createErrorEvent(resource, eventContext({ source: "resource" }));
    assert.equal(sensitiveReads, 0);
    assert.equal(event.error_name, "ResourceError");
    assert.equal(event.message, "Resource failed to load");
    assert.equal(event.stack, null);
    assert.equal(JSON.stringify(event).includes("example.test"), false);
});

test("window adapter captures runtime, promise, and resource errors and skips marked objects", () => {
    const { runtime, listeners, removed } = createRuntime();
    const captured = [];
    const observer = {
        captureError(error, context) {
            captured.push({ error, context });
        },
    };
    const dispose = observability.installWindowErrorObserver(observer, { runtime });
    assert.equal(listeners.get("error").capture, true);

    const runtimeError = new Error("runtime failed");
    listeners.get("error").listener({ error: runtimeError, target: runtime });
    listeners.get("unhandledrejection").listener({ reason: "secret primitive reason" });

    let resourceReads = 0;
    const resourceTarget = {
        get src() {
            resourceReads += 1;
            return "https://example.test/a.js?token=secret";
        },
        get href() {
            resourceReads += 1;
            return "https://example.test/a.css?token=secret";
        },
    };
    listeners.get("error").listener({ target: resourceTarget });

    const marked = new Error("axios failed");
    observability.markTelemetryObject(marked, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    listeners.get("unhandledrejection").listener({ reason: marked });

    assert.equal(captured.length, 3);
    assert.equal(captured[0].error, runtimeError);
    assert.equal(captured[0].context.source, "window_error");
    assert.equal(captured[1].error.message, "Unhandled promise rejection");
    assert.equal(captured[1].context.primitive_reason, true);
    assert.equal(captured[2].context.source, "resource");
    assert.deepEqual(Object.keys(captured[2].error).sort(), ["message", "name"]);
    assert.equal(resourceReads, 0);

    dispose();
    dispose();
    assert.equal(listeners.size, 0);
    assert.equal(removed.length, 2);
});

test("router adapter uses matched templates without reading route data and disposes hooks", () => {
    let afterEachHandler = null;
    let onErrorHandler = null;
    let removed = 0;
    const router = {
        currentRoute: {
            value: {
                path: "/private-user/alice",
                matched: [{ path: "/private-user/:name" }],
            },
        },
        afterEach(handler) {
            afterEachHandler = handler;
            return () => { removed += 1; };
        },
        onError(handler) {
            onErrorHandler = handler;
            return () => { removed += 1; };
        },
    };
    const routes = [];
    const errors = [];
    const observer = {
        setRoute(route) {
            routes.push(route);
        },
        captureError(error, context) {
            errors.push({ error, context, argumentCount: arguments.length });
        },
    };
    const dispose = observability.installRouterErrorObserver(observer, router);
    assert.deepEqual(routes, ["/private-user/:name"]);
    afterEachHandler({ matched: [], get path() { throw new Error("raw path must not be read"); } });
    assert.deepEqual(routes, ["/private-user/:name"]);
    const route = {
        path: "/post/42",
        matched: [{ path: "/post/:id" }],
        get fullPath() { throw new Error("fullPath must not be read"); },
        get query() { throw new Error("query must not be read"); },
        get params() { throw new Error("params must not be read"); },
    };
    afterEachHandler(route);
    assert.deepEqual(routes, ["/private-user/:name", "/post/:id"]);

    const routerError = new Error("navigation failed");
    onErrorHandler(routerError, route, route);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].error, routerError);
    assert.deepEqual(errors[0].context, { source: "router", severity: "error" });
    assert.equal(errors[0].argumentCount, 2);

    observability.markTelemetryObject(routerError, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    onErrorHandler(routerError, route, route);
    assert.equal(errors.length, 1);
    dispose();
    dispose();
    assert.equal(removed, 2);
});

test("Vue 3 plugin chains the previous handler and restores through observer disposal", () => {
    const captures = [];
    const registered = [];
    let unregisterCount = 0;
    const observer = {
        captureError(error, context) {
            captures.push({ error, context, argumentCount: arguments.length });
        },
        registerDisposer(disposer) {
            registered.push(disposer);
            return () => { unregisterCount += 1; };
        },
    };
    const previousCalls = [];
    const previous = function () {
        previousCalls.push({ receiver: this, args: Array.from(arguments) });
        return "previous-result";
    };
    const app = { config: { errorHandler: previous } };
    const plugin = observability.createVue3ErrorObserverPlugin(observer);
    const dispose = plugin.install(app);
    const installed = app.config.errorHandler;
    const instance = { secretState: "must-not-observe" };
    const receiver = { handler: true };
    const error = new Error("render failed");

    const result = installed.call(receiver, error, instance, "render function");
    assert.equal(result, "previous-result");
    assert.equal(captures.length, 1);
    assert.equal(captures[0].error, error);
    assert.deepEqual(captures[0].context, { source: "vue", severity: "error" });
    assert.equal(captures[0].argumentCount, 2);
    assert.equal(JSON.stringify(captures).includes("secretState"), false);
    assert.equal(previousCalls.length, 1);
    assert.equal(previousCalls[0].receiver, receiver);
    assert.deepEqual(previousCalls[0].args, [error, instance, "render function"]);
    assert.equal(registered.length, 1);

    registered[0]();
    assert.equal(app.config.errorHandler, previous);
    assert.equal(unregisterCount, 1);
    dispose();
    assert.equal(unregisterCount, 1);
});

test("Vue 3 plugin keeps a later host handler and still calls the original on capture failure", () => {
    let previousCalls = 0;
    const previous = () => { previousCalls += 1; };
    const app = { config: { errorHandler: previous } };
    const plugin = observability.createVue3ErrorObserverPlugin({
        captureError() {
            throw new Error("observer unavailable");
        },
    });
    plugin.install(app);
    const installed = app.config.errorHandler;
    installed(new Error("host error"), { private: true }, "setup");
    assert.equal(previousCalls, 1);

    const later = () => {};
    app.config.errorHandler = later;
    plugin.destroy();
    assert.equal(app.config.errorHandler, later);
});
