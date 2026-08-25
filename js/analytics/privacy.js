import { clamp, compactObject, toFiniteNumber } from "./utils.js";

const SENSITIVE_KEY_PATTERN = /(password|passwd|token|jwt|secret|authorization|cookie|email|phone|mobile|raw[_-]?text|input[_-]?value|keyword|query|search|outerhtml|innerhtml)/i;
const CONTENT_KEY_PATTERN = /(^|[_-])(text|href|url|html|selector)([_-]|$)/i;
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;
const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);

function truncate(value, maxLength) {
    const text = String(value === undefined || value === null ? "" : value).trim();
    return text.slice(0, maxLength || 128);
}

function normalizeRoutePath(value) {
    let path = truncate(value || "/", 512);
    const queryIndex = path.indexOf("?");
    const hashIndex = path.indexOf("#");
    const cutAt = [queryIndex, hashIndex].filter(function (index) {
        return index >= 0;
    }).sort(function (a, b) {
        return a - b;
    })[0];
    if (cutAt !== undefined) path = path.slice(0, cutAt);
    if (!path.startsWith("/")) path = "/" + path;
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    return path || "/";
}

function sanitizeKey(value, maxLength) {
    const key = truncate(value, maxLength || 128);
    return SAFE_KEY_PATTERN.test(key) ? key : "";
}

function sanitizeScalar(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") return truncate(value, 256);
    return null;
}

function sanitizeProperties(properties, allowedKeys, maxProperties) {
    if (!properties || typeof properties !== "object" || Array.isArray(properties)) return undefined;
    const allowlist = new Set(Array.isArray(allowedKeys) ? allowedKeys : []);
    const output = {};
    const limit = Math.max(0, Math.min(Number(maxProperties) || 20, 50));

    Object.keys(properties).slice(0, limit * 2).some(function (rawKey) {
        if (Object.keys(output).length >= limit) return true;
        const key = sanitizeKey(rawKey, 64);
        if (!key || SENSITIVE_KEY_PATTERN.test(key) || CONTENT_KEY_PATTERN.test(key)) return false;
        if (!allowlist.has(key)) return false;

        const value = properties[rawKey];
        if (Array.isArray(value)) return false;

        const scalar = sanitizeScalar(value);
        if (scalar !== null && scalar !== "") output[key] = scalar;
        return false;
    });

    return Object.keys(output).length ? output : undefined;
}

function sanitizePosition(position) {
    if (!position || typeof position !== "object") return undefined;
    const output = {};
    ["viewport_x_ratio", "viewport_y_ratio", "page_x_ratio", "page_y_ratio", "target_x_ratio", "target_y_ratio"].forEach(function (key) {
        const value = toFiniteNumber(position[key], NaN);
        if (Number.isFinite(value)) output[key] = Number(clamp(value, 0, 1).toFixed(6));
    });
    ["viewport_width", "viewport_height", "document_width", "document_height", "scroll_x", "scroll_y"].forEach(function (key) {
        const value = toFiniteNumber(position[key], NaN);
        if (Number.isFinite(value) && value >= 0) output[key] = Math.round(Math.min(value, 1000000));
    });
    return Object.keys(output).length ? output : undefined;
}

function sanitizePage(page) {
    const value = page || {};
    return compactObject({
        page_key: sanitizeKey(value.page_key || value.id, 128),
        route_name: sanitizeKey(value.route_name, 128),
        route_pattern: normalizeRoutePath(value.route_pattern || value.path || "/"),
        route_path: normalizeRoutePath(value.route_path || value.path || "/"),
        layout_version: sanitizeKey(value.layout_version || value.layoutVersion, 64),
        navigation_type: sanitizeKey(value.navigation_type, 32),
    });
}

function sanitizeEventDetails(details, page) {
    const value = details || {};
    const target = value.target || {};
    const allowedPropertyKeys = page && page.property_keys;
    return compactObject({
        event_name: sanitizeKey(value.event_name || value.name, 128),
        target_key: sanitizeKey(value.target_key || value.id || target.key, 128),
        target_type: sanitizeKey(value.target_type || target.type, 64),
        target_id: sanitizeKey(value.target_id || target.id, 128),
        position: sanitizePosition(value.position),
        properties: sanitizeProperties(value.properties || value.props, allowedPropertyKeys, 20),
    });
}

function getReferrerDomain(value, base) {
    if (!value) return "";
    try {
        const parsed = new URL(value, base || undefined);
        return truncate(parsed.hostname, 128).toLowerCase();
    } catch (error) {
        return "";
    }
}

function shouldIgnoreElement(element) {
    let current = element;
    while (current && current.nodeType === 1) {
        if (IGNORED_TAGS.has(current.tagName)) return true;
        if (current.isContentEditable) return true;
        if (typeof current.hasAttribute === "function" && current.hasAttribute("data-track-ignore")) return true;
        current = current.parentElement;
    }
    return false;
}

export {
    getReferrerDomain,
    normalizeRoutePath,
    sanitizeEventDetails,
    sanitizeKey,
    sanitizePage,
    sanitizePosition,
    sanitizeProperties,
    shouldIgnoreElement,
    truncate,
};
