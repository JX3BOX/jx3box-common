const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../temp/analytics.cjs");
const { createElement, createRuntime, okResponse } = require("./helpers.cjs");

function createClient(runtime, extra) {
    return analytics.createAnalytics(Object.assign({
        runtime,
        endpoint: "/batch",
        sampleSalt: "tests",
        flushIntervalMs: 60_000,
        fetch: async (url, options) => {
            const payload = JSON.parse(options.body);
            return okResponse({ acknowledged_event_ids: payload.events.map((event) => event.event_id) });
        },
    }, extra || {}));
}

const page = {
    page_key: "index.home",
    route_name: "index",
    route_pattern: "/index",
    route_path: "/index/?token=secret#hash",
    layout_version: "index-home-v1",
    sample_rate: 1,
    event_types: ["page_view", "click", "exposure", "scroll_depth"],
    property_keys: ["module_id", "depth_percent"],
};

test("analytics is fail-closed before an allowed page resolves", async () => {
    const runtime = createRuntime();
    const client = createClient(runtime, { resolvePage: async () => null });
    assert.equal(client.getState().identityCreated, false);
    assert.equal(client.track("click", {}), null);
    await client.enterPage(page);
    assert.equal(client.getState().identityCreated, false);
    assert.equal(client.getState().active, false);
    assert.equal(client.getState().queue.pending, 0);
    client.destroy();
});

test("page activation snapshots path context and restricts event types", async () => {
    const runtime = createRuntime();
    const client = createClient(runtime, { resolvePage: async (input) => Object.assign({}, input, { enabled: true }) });
    await client.enterPage(page);
    const state = client.getState();
    assert.equal(state.active, true);
    assert.equal(state.page.route_path, "/index");
    assert.equal(state.queue.pending, 1);
    assert.equal(state.queue.entries[0].event.event_type, "page_view");
    assert.equal(state.queue.entries[0].event.route_path, "/index");
    assert.equal(state.queue.entries[0].event.referrer_domain, "ref.example");
    assert.equal(client.track("custom", { name: "forbidden" }), null);
    assert.ok(client.track("click", { target_key: "index.slider" }));
    assert.equal(client.getState().queue.pending, 2);
    client.leavePage("index.home");
    assert.equal(client.track("click", {}), null);
    client.destroy();
});

test("remote page resolver fails closed and caches successful registration", async () => {
    const runtime = createRuntime();
    let calls = 0;
    const resolver = analytics.createRemotePageResolver({
        runtime,
        endpoint: "/config",
        fetch: async () => {
            calls += 1;
            return okResponse({ data: Object.assign({}, page, { enabled: true }) });
        },
    });
    const first = await resolver(page);
    const second = await resolver(page);
    assert.equal(first.page_key, "index.home");
    assert.equal(second.page_key, "index.home");
    assert.equal(calls, 1);
});

test("remote page resolver rejects empty or incomplete wrapper data", async () => {
    const runtime = createRuntime();
    const emptyResolver = analytics.createRemotePageResolver({
        runtime,
        endpoint: "/config",
        fetch: async () => okResponse({ code: 0, data: null }),
    });
    assert.equal(await emptyResolver(page), null);

    const incompleteResolver = analytics.createRemotePageResolver({
        runtime,
        endpoint: "/config",
        fetch: async () => okResponse({
            data: { page_key: "index.home", enabled: true, sample_rate: 1 },
        }),
    });
    assert.equal(await incompleteResolver(page), null);

    const unsafeResolver = analytics.createRemotePageResolver({
        runtime,
        endpoint: "/config",
        fetch: async () => okResponse({
            code: 500,
            data: Object.assign({}, page, { enabled: true, sample_rate: 1 }),
        }),
    });
    assert.equal(await unsafeResolver(page), null);
});

test("session timeout starts a new page view before the next business event", async () => {
    const runtime = createRuntime();
    let current = 100_000;
    const client = createClient(runtime, {
        now: () => current,
        sessionTimeoutMs: 60_000,
    });
    await client.enterPage(page);
    const firstPageView = client.getState().queue.entries[0].event;

    current += 60_001;
    client.track("click", { target_key: "index.posts" });
    const events = client.getState().queue.entries.map((entry) => entry.event);
    const resumedPageView = events[events.length - 2];
    const click = events[events.length - 1];
    assert.equal(resumedPageView.event_type, "page_view");
    assert.equal(resumedPageView.navigation_type, "session_resume");
    assert.equal(resumedPageView.sequence_no, 1);
    assert.equal(click.sequence_no, 2);
    assert.notEqual(resumedPageView.session_id, firstPageView.session_id);
    assert.notEqual(resumedPageView.page_view_id, firstPageView.page_view_id);
    assert.equal(click.session_id, resumedPageView.session_id);
    assert.equal(click.page_view_id, resumedPageView.page_view_id);
    client.destroy();
});

test("unmounting an old page does not cancel the next page resolver", async () => {
    const runtime = createRuntime();
    let resolveNext;
    const client = createClient(runtime, {
        resolvePage: async (input) => {
            if (input.page_key === "index.home") return Object.assign({}, input, { enabled: true });
            return new Promise((resolve) => {
                resolveNext = () => resolve(Object.assign({}, input, { enabled: true }));
            });
        },
    });
    await client.enterPage(page);
    const nextPage = Object.assign({}, page, { page_key: "index.next", route_path: "/index/next" });
    const pending = client.enterPage(nextPage);
    client.leavePage("index.home");
    resolveNext();
    await pending;
    assert.equal(client.getState().page.page_key, "index.next");
    client.destroy();
});

test("vue3 directives produce one semantic click and clean page lifecycle", async () => {
    const runtime = createRuntime();
    const client = createClient(runtime);
    const directives = {};
    const app = {
        config: { globalProperties: {} },
        directive(name, value) {
            directives[name] = value;
        },
        provide() {},
    };
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime, exposureDurationMs: 1 });
    plugin.install(app);
    assert.deepEqual(Object.keys(directives).sort(), ["track", "track-id", "track-page"]);

    const root = createElement();
    directives["track-page"].mounted(root, { value: page });
    assert.equal(client.getState().queue.pending, 1);

    const element = createElement();
    directives["track-id"].mounted(element, { value: "index.slider" });
    directives.track.mounted(element, {
        arg: "click",
        modifiers: {},
        value: { name: "index_slider_click", id: "index.slider", props: { module_id: "slider" } },
    });
    runtime.__documentListeners.click({ target: element, clientX: 50, clientY: 25 });
    const events = client.getState().queue.entries.map((entry) => entry.event);
    assert.equal(events.length, 2);
    assert.equal(events[1].event_type, "click");
    assert.equal(events[1].event_name, "index_slider_click");
    assert.equal(events[1].target_key, "index.slider");
    assert.equal(events[1].properties.module_id, "slider");

    directives["track-page"].beforeUnmount(root);
    assert.equal(client.isActive(), false);
    runtime.__documentListeners.click({ target: element, clientX: 50, clientY: 25 });
    assert.equal(client.getState().queue.pending, 2);
    plugin.destroy();
});

test("keyboard clicks keep semantics without creating a top-left heat point", async () => {
    const runtime = createRuntime();
    const client = createClient(runtime);
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime });
    const directives = {};
    plugin.install({ config: { globalProperties: {} }, directive: (name, value) => { directives[name] = value; }, provide() {} });
    const root = createElement();
    directives["track-page"].mounted(root, { value: page });
    const element = createElement();
    directives["track-id"].mounted(element, { value: "index.keyboard" });
    runtime.__documentListeners.click({ target: element, detail: 0, clientX: 0, clientY: 0 });
    const click = client.getState().queue.entries.map((entry) => entry.event).pop();
    assert.equal(click.event_type, "click");
    assert.equal(click.target_key, "index.keyboard");
    assert.equal(Object.prototype.hasOwnProperty.call(click, "viewport_x_ratio"), false);
    plugin.destroy();
});

test("scroll thresholds reset per page and beacon keeps queued ids", async () => {
    const runtime = createRuntime();
    let beaconCount = 0;
    runtime.navigator.sendBeacon = () => {
        beaconCount += 1;
        return true;
    };
    const client = createClient(runtime, { navigator: runtime.navigator });
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime });
    const directives = {};
    plugin.install({ config: { globalProperties: {} }, directive: (name, value) => { directives[name] = value; }, provide() {} });
    const root = createElement();
    directives["track-page"].mounted(root, { value: page });

    runtime.scrollY = 800;
    runtime.__windowListeners.scroll();
    const depths = client.getState().queue.entries
        .filter((entry) => entry.event.event_type === "scroll_depth")
        .map((entry) => entry.event.properties.depth_percent);
    assert.deepEqual(depths, [25, 50, 75]);

    runtime.__windowListeners.pagehide();
    assert.equal(beaconCount, 1);
    assert.ok(client.getState().queue.pending >= 4);
    plugin.destroy();
});

test("exposure once survives directive updates and resets for a new page view", async () => {
    const runtime = createRuntime();
    let observerCallback = null;
    let pendingTimer = null;
    runtime.IntersectionObserver = class {
        constructor(callback) {
            observerCallback = callback;
        }
        observe() {}
        disconnect() {}
    };
    runtime.setTimeout = (callback) => {
        pendingTimer = callback;
        return 1;
    };
    runtime.clearTimeout = () => {
        pendingTimer = null;
    };

    const client = createClient(runtime);
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime, exposureDurationMs: 1 });
    const directives = {};
    plugin.install({ config: { globalProperties: {} }, directive: (name, value) => { directives[name] = value; }, provide() {} });
    const root = createElement();
    directives["track-page"].mounted(root, { value: page });

    const element = createElement();
    const binding = {
        arg: "exposure",
        modifiers: { once: true },
        value: { name: "module_exposure", id: "index.posts", props: { module_id: "posts" } },
    };
    directives.track.mounted(element, binding);
    observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    pendingTimer();
    assert.equal(client.getState().queue.entries.filter((entry) => entry.event.event_type === "exposure").length, 1);

    directives.track.updated(element, binding);
    observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    pendingTimer();
    assert.equal(client.getState().queue.entries.filter((entry) => entry.event.event_type === "exposure").length, 1);

    await client.enterPage(Object.assign({}, page, { layout_version: "index-home-v2" }));
    pendingTimer();
    assert.equal(client.getState().queue.entries.filter((entry) => entry.event.event_type === "exposure").length, 2);
    plugin.destroy();
});

test("visible exposure restarts after a delayed remote page registration", async () => {
    const runtime = createRuntime();
    let observerCallback = null;
    let pendingTimer = null;
    let resolveConfig = null;
    runtime.IntersectionObserver = class {
        constructor(callback) {
            observerCallback = callback;
        }
        observe() {}
        disconnect() {}
    };
    runtime.setTimeout = (callback) => {
        pendingTimer = callback;
        return 1;
    };
    runtime.clearTimeout = () => {
        pendingTimer = null;
    };
    const client = createClient(runtime, {
        resolvePage: (input) => new Promise((resolve) => {
            resolveConfig = () => resolve(Object.assign({}, input, { enabled: true }));
        }),
    });
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime, exposureDurationMs: 1 });
    const directives = {};
    plugin.install({ config: { globalProperties: {} }, directive: (name, value) => { directives[name] = value; }, provide() {} });
    directives["track-page"].mounted(createElement(), { value: page });
    directives.track.mounted(createElement(), {
        arg: "exposure",
        modifiers: { once: true },
        value: { name: "module_exposure", id: "index.posts", props: { module_id: "posts" } },
    });
    observerCallback([{ isIntersecting: true, intersectionRatio: 1 }]);
    pendingTimer();
    assert.equal(client.getState().queue.pending, 0);

    resolveConfig();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(typeof pendingTimer, "function");
    pendingTimer();
    const events = client.getState().queue.entries.map((entry) => entry.event.event_type);
    assert.deepEqual(events, ["page_view", "exposure"]);
    plugin.destroy();
});

test("exposure falls back when IntersectionObserver construction fails", async () => {
    const runtime = createRuntime();
    runtime.IntersectionObserver = class {
        constructor() {
            throw new RangeError("unsupported threshold");
        }
    };
    runtime.setTimeout = () => 1;
    runtime.clearTimeout = () => {};
    const client = createClient(runtime);
    await client.enterPage(page);
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime });
    const directives = {};
    plugin.install({ config: { globalProperties: {} }, directive: (name, value) => { directives[name] = value; }, provide() {} });
    assert.doesNotThrow(() => directives.track.mounted(createElement(), {
        arg: "exposure",
        modifiers: { once: true },
        value: { name: "module_exposure", props: { module_id: "posts", visibility_ratio: 2 } },
    }));
    plugin.destroy();
});
