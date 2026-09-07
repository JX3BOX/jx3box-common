// Only extract allowlisted external search terms. Never retain the referrer URL.
const SEARCH_ENGINES = [
    { domains: ["baidu.com"], params: ["wd", "word"] },
    { domains: ["bing.com", "google.com", "so.com"], params: ["q"] },
    { domains: ["sogou.com"], params: ["query", "keyword"] },
    { domains: ["sm.cn"], params: ["q"] },
];

export function searchEngineForDomain(domain) {
    const host = String(domain || "").toLowerCase();
    return SEARCH_ENGINES.find(function (engine) {
        return engine.domains.some(function (base) { return host === base || host.endsWith("." + base); });
    });
}

export function normalizeSearchKeyword(value) {
    if (typeof value !== "string") return "";
    const text = value.normalize("NFKC").replace(/\s+/g, " ").trim();
    if (text.length > 128 || /[\u0000-\u001f\u007f\ufffd]/.test(text)) return "";
    return text;
}

export function extractSearchKeyword(referrer) {
    try {
        const url = new URL(referrer);
        if (!["http:", "https:"].includes(url.protocol)) return undefined;
        const engine = searchEngineForDomain(url.hostname);
        if (!engine) return undefined;
        for (const param of engine.params) {
            const keyword = normalizeSearchKeyword(url.searchParams.get(param));
            if (keyword) return keyword;
        }
        // Empty string distinguishes a new collector with no disclosed term from older SDKs.
        return "";
    } catch (_) {
        return undefined;
    }
}
