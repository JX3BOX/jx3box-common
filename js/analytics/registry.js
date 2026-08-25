import { normalizeRoutePath, sanitizeKey, sanitizePage } from "./privacy.js";

const DEFAULT_EVENT_TYPES = ["page_view", "click", "exposure", "scroll_depth", "custom"];

function normalizePageDefinition(input) {
    const source = typeof input === "string" ? { page_key: input } : (input || {});
    const page = sanitizePage(source);
    const paths = source.paths || source.route_paths || (source.path ? [source.path] : []);
    const eventTypes = source.event_types || source.eventTypes || DEFAULT_EVENT_TYPES;
    page.paths = paths.map(normalizeRoutePath);
    page.event_types = eventTypes.map(function (type) {
        return sanitizeKey(type, 32);
    }).filter(Boolean);
    if (source.sample_rate_bps !== undefined) page.sample_rate = Number(source.sample_rate_bps) / 10000;
    else page.sample_rate = source.sample_rate === undefined ? source.sampleRate : source.sample_rate;
    page.property_keys = Array.isArray(source.property_keys || source.propertyKeys)
        ? (source.property_keys || source.propertyKeys).map(function (key) {
            return sanitizeKey(key, 64);
        }).filter(Boolean)
        : [];
    page.enabled = source.enabled !== false;
    return page;
}

function createPageRegistry(definitions) {
    const pages = new Map();

    function register(definition) {
        const page = normalizePageDefinition(definition);
        if (!page.page_key) throw new Error("analytics page_key is required");
        pages.set(page.page_key, page);
        return page;
    }

    function unregister(pageKey) {
        pages.delete(pageKey);
    }

    function get(pageKey) {
        return pages.get(pageKey) || null;
    }

    function match(routePath) {
        const normalized = normalizeRoutePath(routePath);
        let matched = null;
        pages.forEach(function (page) {
            if (!matched && page.enabled && page.paths.indexOf(normalized) >= 0) matched = page;
        });
        return matched;
    }

    (definitions || []).forEach(register);
    return { get, match, register, unregister };
}

function createRemotePageResolver(options) {
    const settings = options || {};
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : {});
    const fetchImpl = settings.fetch || runtime.fetch;
    const endpoint = settings.endpoint || "/api/cms/system/stat/tracking/config";
    const credentials = settings.credentials || "include";
    const cacheTtlMs = Math.max(1000, Number(settings.cacheTtlMs) || 60000);
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const cache = new Map();

    return async function resolvePage(pageInput) {
        const page = normalizePageDefinition(pageInput);
        if (!page.page_key || typeof fetchImpl !== "function") return null;
        const domain = runtime.location && runtime.location.hostname ? runtime.location.hostname : "";
        const cacheKey = page.page_key + ":" + domain + ":" + page.route_path;
        const cached = cache.get(cacheKey);
        if (cached && cached.expires_at > now()) return cached.value;

        const query = [
            "page_key=" + encodeURIComponent(page.page_key),
            "route_path=" + encodeURIComponent(page.route_path || "/"),
            "domain=" + encodeURIComponent(domain),
        ].join("&");

        try {
            const response = await fetchImpl.call(runtime, endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + query, {
                method: "GET",
                credentials,
            });
            if (!response || !response.ok) return null;
            const payload = typeof response.json === "function" ? await response.json() : null;
            if (payload && Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) return null;
            const raw = payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
            const eventTypes = raw && (raw.event_types || raw.eventTypes);
            const hasSampleRate = raw && (raw.sample_rate !== undefined || raw.sampleRate !== undefined || raw.sample_rate_bps !== undefined);
            if (!raw || typeof raw !== "object" || raw.enabled !== true) return null;
            if (raw.page_key !== page.page_key || !Array.isArray(eventTypes) || !eventTypes.length || !hasSampleRate) return null;
            const sampleRate = raw.sample_rate_bps !== undefined
                ? Number(raw.sample_rate_bps) / 10000
                : Number(raw.sample_rate === undefined ? raw.sampleRate : raw.sample_rate);
            if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) return null;
            const resolved = normalizePageDefinition(Object.assign({}, raw, {
                page_key: page.page_key,
                route_name: page.route_name,
                route_pattern: page.route_pattern,
                route_path: page.route_path,
                event_types: eventTypes,
                property_keys: Array.isArray(raw.property_keys || raw.propertyKeys) ? (raw.property_keys || raw.propertyKeys) : [],
                enabled: true,
            }));
            if (!resolved.event_types.length || resolved.event_types.indexOf("page_view") < 0) return null;
            cache.set(cacheKey, { value: resolved, expires_at: now() + cacheTtlMs });
            return resolved;
        } catch (error) {
            return null;
        }
    };
}

export { DEFAULT_EVENT_TYPES, createPageRegistry, createRemotePageResolver, normalizePageDefinition };
