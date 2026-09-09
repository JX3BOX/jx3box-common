// 统计系统-页面追踪
export const DEFAULT_LAYOUT_VERSION = "web-v1";
export const INDEX_MOBILE_QUERY = "(max-width: 1133px)";
export const VIEWPORT_BUCKETS = { mobile_web: [390, 768, 1133], pc_web: [1280, 1600, 1920, 2560] };
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];
export function isTrackingPreview(runtime = window) {
    return new URLSearchParams(runtime.location.search).get("jx3box_analytics_preview") === "1";
}
export function resolvePageScope(runtime = window, { layoutVersion = DEFAULT_LAYOUT_VERSION, domain = runtime.location.hostname } = {}) {
    const path = runtime.location.pathname.replace(/\/+$/, "") || "/";
    if (
        !/^\/(?:[a-zA-Z0-9_.~-]+(?:\/[a-zA-Z0-9_.~-]+)*)?$/.test(path) ||
        path.length > 256
    )
        return null;
    const surface = runtime.matchMedia(INDEX_MOBILE_QUERY).matches ? "mobile_web" : "pc_web";
    const width = runtime.innerWidth;
    const buckets = VIEWPORT_BUCKETS[surface];
    return {
        domain,
        route_path: path,
        surface,
        layout_version: layoutVersion,
        viewport_bucket: buckets.find((bucket) => width <= bucket) || buckets[buckets.length - 1],
    };
}
export function shanghaiDay(value) {
    return new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
const clamp = (value, max = 1) => Math.max(0, Math.min(max, value));
const ignored =
    "[data-track-ignore],input,textarea,select,[contenteditable]:not([contenteditable='false']),iframe,.c-header,.el-dialog,.el-overlay";
const uuid = (runtime) =>
    runtime.crypto?.randomUUID?.() ||
    `pt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
const eventKey = (el, binding) => {
    if ((!binding.arg || binding.arg === "click") && /^[a-z][a-z0-9_.-]{0,79}$/.test(binding.value || ""))
        el.setAttribute("data-page-track-event", binding.value);
    else el.removeAttribute("data-page-track-event");
};
export const trackDirective = {
    mounted: eventKey,
    updated: eventKey,
    beforeUnmount: (el) => el.removeAttribute("data-page-track-event"),
};

export function createPageTracker({
    runtime = window,
    identity,
    router,
    endpoint,
    headersProvider = () => ({}),
    clock = () => Date.now(),
    getLayoutVersion = () => DEFAULT_LAYOUT_VERSION,
    getDomain = () => runtime.location.hostname,
}) {
    const preview = isTrackingPreview(runtime);
    const storageKey = "jx3box:page-tracking:v2:pending";
    let pending = [],
        root = null,
        view = null,
        config = null,
        generation = 0,
        timer = null,
        busy = false,
        retryAt = 0,
        failures = 0,
        lastConfigAt = 0,
        lastDepthAt = 0,
        lastSentDepth = -1;
    const now = clock;
    const currentScope = () => resolvePageScope(runtime, { layoutVersion: getLayoutVersion(), domain: getDomain() });
    const scopeSignature = (scope) => scope && JSON.stringify([scope, shanghaiDay(now())]);
    const persist = () => {
        try {
            runtime.sessionStorage.setItem(storageKey, JSON.stringify(pending));
        } catch (_) {
            /* 无存储权限仍可内存批量上报 */
        }
    };
    if (!preview) {
        try {
            const saved = JSON.parse(runtime.sessionStorage.getItem(storageKey) || "[]");
            pending = Array.isArray(saved)
                ? saved
                      .filter(
                          (item) =>
                              item?.context &&
                              item?.event?.id &&
                              now() - new Date(item.context.started_at).getTime() < 7 * 86400000
                      )
                      .slice(-300)
                : [];
        } catch (_) {
            pending = [];
        }
    }
    const measurements = () => {
        const d = runtime.document.documentElement;
        const height = Math.max(d.scrollHeight, runtime.document.body?.scrollHeight || 0, runtime.innerHeight);
        const width = Math.max(d.scrollWidth, runtime.innerWidth);
        const loading = Boolean(root?.querySelector('[aria-busy="true"]'));
        return {
            viewport_width: runtime.innerWidth,
            viewport_height: runtime.innerHeight,
            document_height: height,
            document_width: width,
            depth: loading
                ? view?.depth || 0
                : clamp((Math.max(0, runtime.scrollY) + runtime.innerHeight) / height, 1) * 100,
        };
    };
    const add = (type, extra = {}) => {
        if (!view?.started || !config?.enabled || !root) return;
        const size = measurements();
        view.depth = Math.max(view.depth, size.depth);
        const event = {
            id: uuid(runtime),
            type,
            at: new Date(now()).toISOString(),
            depth: Number(view.depth.toFixed(2)),
            viewport_width: size.viewport_width,
            viewport_height: size.viewport_height,
            document_height: size.document_height,
            ...extra,
        };
        pending.push({ context: view.context, event });
        pending = pending.slice(-300);
        persist();
    };
    const loadConfig = async (scope, token) => {
        try {
            const query = { ...scope };
            delete query.viewport_bucket;
            delete query.page_key;
            const response = await runtime.fetch(`${endpoint}/config?${new URLSearchParams(query)}`, {
                credentials: "include",
                headers: headersProvider(),
            });
            if (!response.ok) throw new Error("config unavailable");
            const result = await response.json();
            if (token !== generation || !root || scopeSignature(currentScope()) !== view?.signature) return;
            if (result.code !== 0) throw new Error("invalid config");
            config = {
                ...result.data,
                enabled:
                    result.data?.enabled === true &&
                    /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,63}$/.test(result.data?.page_key || ""),
            };
            lastConfigAt = now();
            if (config.enabled) {
                if (!view.started || view.context.page_key !== config.page_key) {
                    // 命中注册规则后才创建访问；新旧范围各用独立访问。
                    view.depth = 0;
                    lastSentDepth = -1;
                    lastDepthAt = 0;
                    view.context = {
                        ...scope,
                        page_key: config.page_key,
                        page_view_id: uuid(runtime),
                        instance_id: identity.getInstanceId(),
                        started_at: new Date(now()).toISOString(),
                    };
                    view.started = true;
                    add("view");
                }
            } else {
                view.started = false;
            }
        } catch (_) {
            if (token === generation) config = null; // 配置失败时停止新增采集，不影响页面使用。
        }
    };
    const ensureScope = () => {
        if (!root || preview) return false;
        const scope = currentScope();
        const signature = scopeSignature(scope);
        if (!scope) {
            generation++;
            view = null;
            config = null;
            return false;
        }
        if (view?.signature !== signature) {
            generation++;
            config = null;
            lastSentDepth = -1;
            lastDepthAt = 0;
            lastConfigAt = 0;
            view = {
                signature,
                started: false,
                depth: 0,
                context: null,
            };
            lastConfigAt = now();
            loadConfig(scope, generation);
        } else if (now() - lastConfigAt > 60000) {
            lastConfigAt = now();
            loadConfig(scope, generation);
        }
        return Boolean(config?.enabled);
    };
    const depth = (force = false) => {
        if (!ensureScope()) return;
        const value = Math.max(view.depth, measurements().depth);
        if (value > lastSentDepth && (force || now() - lastDepthAt > 5000)) {
            add("depth");
            lastSentDepth = value;
            lastDepthAt = now();
        }
    };
    const click = (event) => {
        if (!event.isTrusted || !root?.contains(event.target) || event.target.closest?.(ignored) || !ensureScope())
            return;
        const size = measurements();
        const key = event.target.closest?.("[data-page-track-event]")?.getAttribute("data-page-track-event");
        add("click", {
            x: clamp((event.clientX + runtime.scrollX) / size.document_width),
            y: clamp((event.clientY + runtime.scrollY) / size.document_height),
            ...(key && config.event_keys?.includes(key) ? { event_key: key } : {}),
        });
        if (pending.length >= (config.max_batch || 40)) flush();
    };
    async function flush(beacon = false) {
        if (preview || !pending.length || (!beacon && (busy || now() < retryAt))) return;
        const first = pending[0];
        const items = pending.filter((item) => item.context.page_view_id === first.context.page_view_id).slice(0, 40);
        const body = JSON.stringify({ ...first.context, events: items.map((item) => item.event) });
        if (beacon) {
            // Beacon 入队不等于服务器确认，保留队列；下次加载按 event id 幂等重试。
            try {
                runtime.navigator.sendBeacon?.(`${endpoint}/batch`, body);
            } catch (_) {
                /* 保留待发送队列 */
            }
            return;
        }
        busy = true;
        try {
            const response = await runtime.fetch(`${endpoint}/batch`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", ...headersProvider() },
                body,
            });
            if ([425, 429, 500, 502, 503, 504].includes(response.status)) throw new Error("retry");
            const result = await response.json();
            if (!response.ok || result.code !== 0) {
                if (![400, 403, 404, 410, 413].includes(response.status)) throw new Error("retry");
                const ids = new Set(items.map((item) => item.event.id));
                pending = pending.filter((item) => !ids.has(item.event.id));
            } else if (result.data?.blocked) {
                pending = pending.filter((item) => item.context.page_key !== first.context.page_key);
                if (view?.context?.page_key === first.context.page_key) config = { enabled: false };
            } else {
                const acknowledged = new Set([
                    ...(result.data?.accepted_ids || []),
                    ...(result.data?.rejected_ids || []),
                ]);
                if (!acknowledged.size) throw new Error("retry");
                pending = pending.filter((item) => !acknowledged.has(item.event.id));
            }
            failures = 0;
            retryAt = 0;
            persist();
        } catch (_) {
            failures++;
            retryAt = now() + Math.min(60000, 2000 * 2 ** Math.min(failures, 5));
        } finally {
            busy = false;
        }
    }
    const hidden = () => {
        if (runtime.document.visibilityState === "hidden") {
            depth(true);
            flush(true);
        } else {
            ensureScope();
            flush();
        }
    };
    const exit = () => {
        depth(true);
        flush(true);
    };
    const resized = () => {
        ensureScope();
    };
    const scrolled = () => depth();
    let stopPreview = null;
    const unmount = () => {
        if (!root) return;
        if (!preview) exit();
        generation++;
        root = null;
        view = null;
        config = null;
        runtime.clearInterval(timer);
        stopPreview?.();
        stopPreview = null;
        runtime.document.removeEventListener("click", click, true);
        runtime.document.removeEventListener("visibilitychange", hidden);
        runtime.removeEventListener("pagehide", exit);
        runtime.removeEventListener("resize", resized);
        runtime.removeEventListener("scroll", scrolled);
    };
    const mount = (element) => {
        unmount();
        root = element;
        if (preview) {
            stopPreview = installPreviewBridge(runtime, element, { getLayoutVersion });
            return;
        }
        ensureScope();
        runtime.document.addEventListener("click", click, true);
        runtime.document.addEventListener("visibilitychange", hidden);
        runtime.addEventListener("pagehide", exit);
        runtime.addEventListener("resize", resized);
        runtime.addEventListener("scroll", scrolled, { passive: true });
        timer = runtime.setInterval(() => {
            if (runtime.document.visibilityState !== "hidden") depth();
            flush();
        }, 5000);
    };
    let stopRouter = null;
    let installedApp = null;
    const destroy = () => {
        stopRouter?.();
        stopRouter = null;
        unmount();
    };
    return {
        destroy,
        mount,
        unmount,
        refresh: ensureScope,
        flush,
        install(app) {
            if (installedApp === app) return;
            if (installedApp) throw new Error("Page tracker is already installed in another app");
            installedApp = app;
            app.directive("track", trackDirective);
            app.mixin({
                mounted() {
                    if (this !== this.$root) return;
                    mount(runtime.document.documentElement);
                    if (router?.afterEach) {
                        stopRouter = router.afterEach((to, from, failure) => {
                            if (failure) return;
                            this.$nextTick(() => { if (root) ensureScope(); });
                        });
                    }
                },
                beforeUnmount() {
                    if (this === this.$root) destroy();
                },
            });
        },
    };
}

// 管理端仅接收已知源窗口的布局尺寸。预览不创建身份、不登记 PV，也不采集点击。
export function installPreviewBridge(runtime, element, { getLayoutVersion = () => DEFAULT_LAYOUT_VERSION } = {}) {
    let targetOrigin = null,
        timer = null;
    const post = () => {
        if (!targetOrigin || !element.isConnected) return;
        runtime.parent.postMessage(
            {
                type: "jx3box:tracking-preview:layout",
                layout_version: getLayoutVersion(),
                width: runtime.innerWidth,
                height: Math.max(runtime.document.documentElement.scrollHeight, runtime.innerHeight),
                scroll_y: Math.max(0, runtime.scrollY || 0),
            },
            targetOrigin
        );
    };
    const receive = (event) => {
        if (event.source !== runtime.parent) return;
        let origin;
        try {
            origin = new URL(event.origin);
        } catch (_) {
            return;
        }
        if (!(LOCAL_HOSTS.includes(origin.hostname) || origin.hostname === "os.jx3box.com")) return;
        if (event.data?.type === "jx3box:tracking-preview:scroll") {
            if (event.origin !== targetOrigin || !Number.isFinite(event.data.top)) return;
            const maxTop = Math.max(0, runtime.document.documentElement.scrollHeight - runtime.innerHeight);
            runtime.scrollTo({ top: Math.max(0, Math.min(event.data.top, maxTop)), behavior: "auto" });
            post();
            return;
        }
        if (event.data?.type !== "jx3box:tracking-preview:hello") return;
        targetOrigin = event.origin;
        post();
    };
    const observer = runtime.ResizeObserver
        ? new runtime.ResizeObserver(() => {
              runtime.clearTimeout(timer);
              timer = runtime.setTimeout(post, 150);
          })
        : null;
    observer?.observe(runtime.document.documentElement || element);
    runtime.addEventListener("message", receive);
    runtime.addEventListener("scroll", post, { passive: true });
    return () => {
        observer?.disconnect();
        runtime.clearTimeout(timer);
        runtime.removeEventListener("message", receive);
        runtime.removeEventListener("scroll", post);
    };
}
