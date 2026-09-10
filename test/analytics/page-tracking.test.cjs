const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const load = () =>
    import(
        `data:text/javascript;base64,${Buffer.from(
            fs.readFileSync(require.resolve("../../js/page-tracking.js"), "utf8")
        ).toString("base64")}`
    );
const tick = () => new Promise(setImmediate);
function setup() {
    const listeners = new Map(),
        requests = [],
        beacons = [],
        values = new Map();
    let id = 0,
        clock = Date.parse("2026-09-06T05:00:00Z"),
        fail = false,
        blocked = false,
        pageKey = "index.std",
        configData = null;
    const configRequests = [];
    const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
    const runtime = {
        location: { hostname: "www.jx3box.com", pathname: "/index/", search: "" },
        innerWidth: 1440,
        innerHeight: 900,
        scrollX: 0,
        scrollY: 0,
        crypto: { randomUUID: () => `id-${++id}` },
        sessionStorage: storage,
        matchMedia: () => ({ matches: runtime.innerWidth <= 1133 }),
        addEventListener: (type, fn) => listeners.set(type, fn),
        removeEventListener: (type) => listeners.delete(type),
        clearTimeout: () => {},
        setInterval: (fn) => {
            listeners.set("interval", fn);
            return 1;
        },
        clearInterval: () => listeners.delete("interval"),
        navigator: {
            sendBeacon: (url, body) => {
                beacons.push(JSON.parse(body));
                return true;
            },
        },
        fetch: async (url, options) => {
            if (url.includes("/config?")) {
                configRequests.push(url);
                return {
                    ok: true,
                    json: async () => ({
                        code: 0,
                        data: configData || { enabled: true, page_key: pageKey, event_keys: ["index.tools.open"] },
                    }),
                };
            }
            const payload = JSON.parse(options.body);
            requests.push(payload);
            if (fail) return { status: 425, ok: false };
            return {
                status: 200,
                ok: true,
                json: async () => ({
                    code: 0,
                    data: blocked ? { blocked: true } : { accepted_ids: payload.events.map((event) => event.id) },
                }),
            };
        },
    };
    runtime.document = {
        documentElement: { scrollHeight: 3000, scrollWidth: 1440 },
        body: { scrollHeight: 3000 },
        visibilityState: "visible",
        addEventListener: runtime.addEventListener,
        removeEventListener: runtime.removeEventListener,
    };
    const root = { contains: () => true, querySelector: () => null };
    const click = (key = "index.tools.open", ignore = false) =>
        listeners.get("click")?.({
            isTrusted: true,
            clientX: 720,
            clientY: 300,
            target: {
                closest: (selector) =>
                    selector === "[data-page-track-event]" ? { getAttribute: () => key } : ignore ? {} : null,
            },
        });
    return {
        runtime,
        requests,
        configRequests,
        setPageKey: (value) => {
            pageKey = value;
        },
        setConfig: (value) => {
            configData = value;
        },
        beacons,
        root,
        click,
        listeners,
        clock: () => clock,
        advance: (ms) => {
            clock += ms;
        },
        setFail: (value) => {
            fail = value;
        },
        setBlocked: () => {
            blocked = true;
        },
    };
}
test("任意域名均可解析页面范围，支持域名覆盖；PC/mobile 使用 1133px media query", async () => {
    const { resolvePageScope } = await load();
    const { runtime } = setup();
    runtime.location.search = "?client=origin";
    assert.equal(resolvePageScope(runtime).domain, "www.jx3box.com");
    runtime.location.hostname = "localhost";
    assert.equal(resolvePageScope(runtime, { domain: "origin.jx3box.com" }).domain, "origin.jx3box.com");
    assert.equal(resolvePageScope(runtime).game_client, undefined);
    assert.equal(resolvePageScope(runtime).page_key, undefined, "页面标识只由服务端返回");
    runtime.innerWidth = 1133;
    assert.equal(resolvePageScope(runtime).surface, "mobile_web");
    runtime.innerWidth = 1134;
    assert.equal(resolvePageScope(runtime).surface, "pc_web");
    runtime.location.pathname = "/index/tv";
    assert.equal(resolvePageScope(runtime).route_path, "/index/tv", "具体页面不再由首页白名单限制");
    runtime.location.pathname = "/macro/123";
    assert.equal(resolvePageScope(runtime).route_path, "/macro/123");
    runtime.location.pathname = "/";
    assert.equal(resolvePageScope(runtime).route_path, "/", "按真实地址查询，不擅自映射到首页");
    runtime.location.hostname = "unregistered.example";
    assert.equal(resolvePageScope(runtime).domain, "unregistered.example");
});
test("按地址获取注册配置，上报使用服务端页面标识；范围变化时隔离访问", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    env.setPageKey("page.std.generated");
    const tracker = createPageTracker({
        ...env,
        endpoint: "/tracking/v2",
        identity: { getInstanceId: () => "instance" },
    });
    tracker.mount(env.root);
    await tick();
    const query = new URL(env.configRequests[0], "https://www.jx3box.com").searchParams;
    assert.equal(query.has("page_key"), false);
    assert.equal(query.get("route_path"), "/index");
    env.click();
    await tracker.flush();
    assert.equal(env.requests[0].page_key, "page.std.generated");
    env.setPageKey("page.std.specific");
    env.advance(61000);
    env.click();
    await tick();
    env.click();
    await tracker.flush();
    await tracker.flush();
    const changed = env.requests.find((request) => request.page_key === "page.std.specific");
    assert(changed);
    assert.notEqual(changed.page_view_id, env.requests[0].page_view_id);
    assert(changed.events.some((event) => event.type === "view"));
    tracker.unmount();
});
test("真实采集指令：同一次点击只产生一行、敏感区域忽略、深度单调、重试幂等", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    const tracker = createPageTracker({
        ...env,
        endpoint: "/tracking/v2",
        identity: { getInstanceId: () => "instance" },
    });
    tracker.mount(env.root);
    await tick();
    env.click();
    env.click("private.not-registered");
    env.click("index.tools.open", true);
    env.runtime.scrollY = 1500;
    env.advance(6000);
    env.listeners.get("scroll")();
    env.runtime.scrollY = 0;
    env.advance(6000);
    env.listeners.get("scroll")();
    env.setFail(true);
    await tracker.flush();
    const first = env.requests[0];
    assert.equal(first.events.filter((event) => event.type === "click").length, 2);
    assert.equal(first.events.filter((event) => event.event_key).length, 1);
    assert.equal(Math.max(...first.events.map((event) => event.depth)), 80);
    assert.equal(first.events.at(-1).depth, 80);
    tracker.flush(true);
    assert.deepEqual(env.beacons[0], first, "Beacon 不清除未被确认的事件");
    env.setFail(false);
    env.advance(65000);
    await tracker.flush();
    assert.deepEqual(
        env.requests[1].events.map((event) => event.id),
        first.events.map((event) => event.id)
    );
    await tracker.flush();
    assert.equal(env.requests.length, 2, "ACK 后不重复上报");
    tracker.unmount();
    assert.equal(env.listeners.has("click"), false);
});
test("跨断点重新分组；旧异步配置不影响新页面；iframe 预览不读取身份或队列", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    const tracker = createPageTracker({
        ...env,
        endpoint: "/tracking/v2",
        identity: { getInstanceId: () => "instance" },
    });
    tracker.mount(env.root);
    await tick();
    await tracker.flush();
    env.runtime.innerWidth = 390;
    env.runtime.document.documentElement.scrollWidth = 390;
    env.listeners.get("resize")();
    await tick();
    env.click();
    await tracker.flush();
    assert.equal(env.requests[1].surface, "mobile_web");
    assert.equal(env.requests[1].viewport_bucket, 390);
    assert.notEqual(env.requests[0].page_view_id, env.requests[1].page_view_id);
    tracker.unmount();
    const preview = setup();
    preview.runtime.location.search = "?jx3box_analytics_preview=1";
    Object.defineProperty(preview.runtime, "sessionStorage", {
        get() {
            throw new Error("preview must not access queue");
        },
    });
    const previewTracker = createPageTracker({
        runtime: preview.runtime,
        identity: {
            getInstanceId() {
                throw new Error("preview must not access identity");
            },
        },
    });
    previewTracker.mount(preview.root);
    previewTracker.flush();
    previewTracker.unmount();
    assert.equal(preview.requests.length, 0);
});
test("未注册、暂停、无标识或配置失败的页面不创建访问、不产生点击与滚动", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    env.runtime.location.pathname = "/index/tv";
    env.setConfig({ enabled: false });
    let identityReads = 0;
    const tracker = createPageTracker({
        ...env,
        endpoint: "/tracking/v2",
        identity: {
            getInstanceId: () => {
                identityReads++;
                return "instance";
            },
        },
    });
    tracker.mount(env.root);
    await tick();
    env.click();
    env.runtime.scrollY = 1200;
    env.listeners.get("scroll")();
    await tracker.flush();
    assert.equal(identityReads, 0);
    assert.equal(env.requests.length, 0);
    assert.equal(new URL(env.configRequests[0], "https://www.jx3box.com").searchParams.get("route_path"), "/index/tv");
    env.setConfig({ enabled: true });
    env.advance(61000);
    tracker.refresh();
    await tick();
    env.click();
    await tracker.flush();
    assert.equal(identityReads, 0, "不能使用前端生成的兜底标识绕过注册");
    env.setConfig({ enabled: true, page_key: "page.std.tv", event_keys: [] });
    env.advance(61000);
    tracker.refresh();
    await tick();
    await tracker.flush();
    assert.equal(identityReads, 1);
    assert.equal(env.requests.length, 1);
    assert.equal(env.requests[0].route_path, "/index/tv");
    assert.equal(env.requests[0].started_at, new Date(env.clock()).toISOString(), "以确认启用时间创建访问");
    env.setConfig({ enabled: false });
    env.advance(61000);
    tracker.refresh();
    await tick();
    env.click();
    await tracker.flush();
    assert.equal(env.requests.length, 1, "暂停响应后不产生新事件");
    env.setConfig({ enabled: true, page_key: "page.std.tv" });
    env.advance(61000);
    tracker.refresh();
    await tick();
    await tracker.flush();
    assert.notEqual(env.requests[1].page_view_id, env.requests[0].page_view_id, "恢复采集使用新访问");
    const fetch = env.runtime.fetch;
    env.runtime.fetch = (url, options) =>
        url.includes("/config?") ? Promise.reject(new Error("offline")) : fetch(url, options);
    env.advance(61000);
    tracker.refresh();
    await tick();
    env.click();
    await tracker.flush();
    assert.equal(env.requests.length, 2, "配置不可用时停止新增采集");
    tracker.unmount();
});
test("应用根指令在路由更新时检查注册范围，同一范围的两个具体地址隔离访问", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    const pendingConfigs = [];
    const fetch = env.runtime.fetch;
    env.runtime.fetch = (url, options) =>
        url.includes("/config?") ? new Promise((resolve) => pendingConfigs.push(resolve)) : fetch(url, options);
    let identityReads = 0;
    const tracker = createPageTracker({
        ...env,
        endpoint: "/tracking/v2",
        identity: {
            getInstanceId: () => {
                identityReads++;
                return "instance";
            },
        },
    });
    const root = { mounted: tracker.mount, updated: tracker.refresh, beforeUnmount: tracker.destroy };
    root.mounted(env.root);
    env.runtime.location.pathname = "/macro/123";
    root.updated(env.root);
    const respond = (page_key) => ({
        ok: true,
        json: async () => ({ code: 0, data: { enabled: true, page_key, event_keys: [] } }),
    });
    pendingConfigs[0](respond("index.std"));
    await tick();
    assert.equal(identityReads, 0, "旧页面慢响应不能启动新页面的采集");
    pendingConfigs[1](respond("page.std.macro"));
    await tick();
    env.runtime.scrollY = 1800;
    env.click();
    await tracker.flush();
    assert.equal(env.requests[0].route_path, "/macro/123");
    assert.equal(env.requests[0].page_key, "page.std.macro");
    env.runtime.location.pathname = "/macro/456";
    env.runtime.scrollY = 0;
    root.updated(env.root);
    pendingConfigs[2](respond("page.std.macro"));
    await tick();
    await tracker.flush();
    assert.equal(env.requests[1].route_path, "/macro/456");
    assert.notEqual(env.requests[0].page_view_id, env.requests[1].page_view_id);
    assert.equal(env.requests[1].events[0].depth, 30, "新的具体页面不继承上一页面滚动深度");
    env.runtime.location.search = "?client=origin&search=private";
    root.updated(env.root);
    assert.equal(pendingConfigs.length, 3, "查询参数不进入范围，也不会额外创建访问");
    root.beforeUnmount(env.root);
    assert.equal(env.listeners.has("interval"), false);
});
test("应用入口与页面渲染使用同一布局版本，预览只监听文档尺寸", async () => {
    const { installPreviewBridge } = await load();
    const env = setup();
    let observed;
    const messages = [];
    env.runtime.parent = { postMessage: (message) => messages.push(message) };
    env.runtime.ResizeObserver = class {
        constructor() {}
        observe(element) {
            observed = element;
        }
        disconnect() {}
    };
    let version = "index-home-v2";
    const stop = installPreviewBridge(env.runtime, { isConnected: true }, { getLayoutVersion: () => version });
    env.listeners.get("message")({
        source: env.runtime.parent,
        origin: "https://www.jx3box.com",
        data: { type: "jx3box:tracking-preview:hello" },
    });
    assert.equal(messages[0].layout_version, "index-home-v2");
    assert.equal(messages[0].height, 3000);
    assert.equal(messages[0].scroll_y, 0);
    assert.equal(observed, env.runtime.document.documentElement);
    version = "web-v1";
    env.listeners.get("message")({
        source: env.runtime.parent,
        origin: "https://www.jx3box.com",
        data: { type: "jx3box:tracking-preview:hello" },
    });
    assert.equal(messages[1].layout_version, "web-v1");
    env.runtime.scrollY = 800;
    env.listeners.get("scroll")();
    assert.equal(messages[2].scroll_y, 800);
    env.runtime.scrollTo = ({ top, behavior }) => {
        assert.equal(behavior, "instant", "预览滚动不得继承样例页面的 CSS smooth");
        env.runtime.scrollY = top;
    };
    const scrollRequest = {
        source: env.runtime.parent,
        origin: "https://www.jx3box.com",
        data: { type: "jx3box:tracking-preview:scroll", top: 5000 },
    };
    env.listeners.get("message")({ ...scrollRequest, origin: "https://elsewhere.example" });
    assert.equal(env.runtime.scrollY, 800);
    env.listeners.get("message")(scrollRequest);
    assert.equal(env.runtime.scrollY, 2100, "滚动不超过文档末尾");
    assert.equal(messages[3].scroll_y, 2100);
    assert.equal(env.requests.length, 0, "预览滚动不写入采集接口");
    stop();
    assert.equal(env.listeners.has("scroll"), false);
});

test("main.js 安装后自动挂载、路由刷新与卸载，无需页面指令", async () => {
    const { createPageTracker } = await load();
    const env = setup();
    Object.assign(env.runtime.document.documentElement, env.root);
    let afterEach, removed = 0, mixin;
    const router = { afterEach(fn) { afterEach = fn; return () => { removed++; }; } };
    const tracker = createPageTracker({ ...env, router, endpoint: "/tracking/v2" });
    const directives = [];
    const app = { directive(name) { directives.push(name); }, mixin(value) { mixin = value; } };
    tracker.install(app);
    tracker.install(app);
    assert.deepEqual(directives, ["track"]);
    const vm = { $nextTick: (fn) => Promise.resolve().then(fn) };
    vm.$root = vm;
    mixin.mounted.call({ $root: vm });
    assert.equal(env.configRequests.length, 0, "子组件不启动采集");
    mixin.mounted.call(vm);
    await tick();
    assert.equal(env.configRequests.length, 1);
    env.runtime.location.pathname = "/macro/123";
    afterEach({}, {}, new Error("cancelled"));
    await tick();
    assert.equal(env.configRequests.length, 1);
    afterEach({}, {}, undefined);
    await tick();
    assert.equal(env.configRequests.length, 2);
    mixin.beforeUnmount.call(vm);
    assert.equal(removed, 1);
    assert.equal(env.listeners.has("interval"), false);
    afterEach({}, {}, undefined);
    await tick();
    assert.equal(env.configRequests.length, 2, "卸载后的回调不重启采集");
});
