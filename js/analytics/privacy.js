import { clamp, compactObject, toFiniteNumber } from "./utils.js";

const SENSITIVE_KEY_PATTERN = /(password|passwd|token|jwt|secret|authorization|cookie|email|phone|mobile|raw[_-]?text|input[_-]?value|keyword|query|search|outerhtml|innerhtml)/i;
const CONTENT_KEY_PATTERN = /(^|[_-])(text|href|url|html|selector)([_-]|$)/i;
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{1,128}$/;
const IGNORED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);
const TARGET_ID_VALIDATORS = Object.freeze({
    positive_int: function (value) { return /^[1-9][0-9]{0,18}$/.test(value); },
    positive_integer: function (value) { return /^[1-9][0-9]{0,18}$/.test(value); },
    nonnegative_int: function (value) { return /^(?:0|[1-9][0-9]{0,18})$/.test(value); },
    digits: function (value) { return /^[0-9]{1,64}$/.test(value); },
    digits_underscore: function (value) { return /^\d+(?:_\d+)*$/.test(value); },
    digits_or_underscore: function (value) { return /^\d+(?:_\d+)*$/.test(value); },
    bounded_slug: function (value) { return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value); },
    safe_short_id: function (value) { return /^[a-zA-Z0-9_-]{1,64}$/.test(value); },
    safe_slug: function (value) { return /^[a-zA-Z0-9_-]{1,64}$/.test(value); },
    safe_key: function (value) { return SAFE_KEY_PATTERN.test(value); },
});

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

function normalizeRoutePattern(value) {
    let pattern = truncate(value, 512);
    if (!pattern || pattern.indexOf("#") >= 0 || pattern.indexOf("\\") >= 0) return "";
    if (!pattern.startsWith("/")) pattern = "/" + pattern;
    pattern = pattern.replace(/\/{2,}/g, "/");
    if (pattern.length > 1) pattern = pattern.replace(/\/+$/, "");
    if (pattern === "/") return pattern;
    const segments = pattern.slice(1).split("/");
    const valid = segments.every(function (segment) {
        if (segment === "*" || segment === "**") return true;
        const parameter = segment.charAt(segment.length - 1) === "?" ? segment.slice(0, -1) : segment;
        if (/^:[a-zA-Z_][a-zA-Z0-9_]*$/.test(parameter)) return true;
        // Deliberately reject Vue Router custom-regex syntax and anything that
        // could be a query/hash fragment. Route rules use named validators.
        return /^[a-zA-Z0-9._~-]+$/.test(segment);
    });
    return valid ? pattern : "";
}

function sanitizeCanonicalPath(value) {
    let path = truncate(value, 2048);
    if (!path
        || path.charAt(0) !== "/"
        || path.slice(0, 2) === "//"
        || /[?#\\\u0000-\u001f\u007f]/.test(path)
        || path.indexOf("://") >= 0) return "";
    path = path.replace(/\/{2,}/g, "/");
    if (path.length > 1) path = path.replace(/\/+$/, "");
    const safe = path.split("/").filter(Boolean).every(function (rawSegment) {
        if (rawSegment === "*" || rawSegment === "**") return true;
        if (rawSegment.charAt(0) === ":") return false;
        try {
            const segment = decodeURIComponent(rawSegment);
            return !!segment
                && segment !== "."
                && segment !== ".."
                && !/[/?#\\\u0000-\u001f\u007f]/.test(segment);
        } catch (error) {
            return false;
        }
    });
    return safe ? path : "";
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
    const routePattern = normalizeRoutePattern(value.route_pattern || value.path || value.route_path || "/");
    return compactObject({
        page_key: sanitizeKey(value.page_key || value.id, 128),
        route_name: sanitizeKey(value.route_name, 128),
        route_pattern: routePattern,
        route_path: routePattern,
        canonical_path: sanitizeCanonicalPath(value.canonical_path || value.canonicalPath),
        layout_version: sanitizeKey(value.layout_version || value.layoutVersion, 64),
        navigation_type: sanitizeKey(value.navigation_type, 32),
        public_target: sanitizePublicTarget(value.public_target || value.publicTarget),
    });
}

function resolveInteractionTargetRule(page, key, type) {
    const trackingRule = page && page.sink_rules && page.sink_rules.tracking;
    const source = trackingRule && trackingRule.interaction_target_rules
        || page && page.interaction_target_rules
        || [];
    if (!Array.isArray(source)) return null;
    return source.find(function (rule) {
        if (!rule || typeof rule !== "object") return false;
        if (rule.target_key && rule.target_key !== key) return false;
        if (rule.target_type && rule.target_type !== type) return false;
        return true;
    }) || null;
}

function sanitizeInteractionTarget(value, page) {
    const target = value || {};
    const key = sanitizeKey(target.key || target.target_key, 128);
    const type = sanitizeKey(target.type || target.target_type, 64);
    const rawId = sanitizeKey(target.target_id || target.value || target.id, 128);
    const rule = rawId ? resolveInteractionTargetRule(page, key, type) : null;
    let id = "";
    if (rule) {
        const allowedIds = Array.isArray(rule.allowed_ids) ? rule.allowed_ids : [];
        const validator = TARGET_ID_VALIDATORS[rule.validator];
        if (allowedIds.indexOf(rawId) >= 0 || (validator && validator(rawId))) id = rawId;
    }
    const output = compactObject({
        key,
        type,
        id,
    });
    return Object.keys(output).length ? output : undefined;
}

function sanitizePublicTarget(value) {
    const target = value || {};
    const output = compactObject({
        key: sanitizeKey(target.key || target.target_key || target.query_key, 64),
        type: sanitizeKey(target.type || target.target_type, 64),
        id: sanitizeKey(target.id || target.target_id, 128),
        variant: sanitizeKey(target.variant, 32),
        revision_id: sanitizeKey(target.revision_id || target.revisionId, 128),
    });
    if (!output.type || !output.id) return undefined;
    return output;
}

function sanitizeEventDetails(details, page) {
    const value = details || {};
    const target = value.target || {};
    const allowedPropertyKeys = page && page.property_keys;
    const interactionTarget = sanitizeInteractionTarget(value.interaction_target || value.interactionTarget || {
        key: value.target_key || value.id || target.key,
        type: value.target_type || target.type,
        id: value.target_id || target.id,
    }, page);
    return compactObject({
        event_name: sanitizeKey(value.event_name || value.name, 128),
        interaction_target: interactionTarget,
        // Keep the 9.3 flat fields for tracking consumers. New traffic encoders
        // must use page.public_target and can never reinterpret these DOM fields.
        target_key: interactionTarget && interactionTarget.key,
        target_type: interactionTarget && interactionTarget.type,
        target_id: interactionTarget && interactionTarget.id,
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
    normalizeRoutePattern,
    sanitizeCanonicalPath,
    sanitizeEventDetails,
    sanitizeInteractionTarget,
    sanitizeKey,
    sanitizePage,
    sanitizePosition,
    sanitizeProperties,
    sanitizePublicTarget,
    TARGET_ID_VALIDATORS,
    shouldIgnoreElement,
    truncate,
};
