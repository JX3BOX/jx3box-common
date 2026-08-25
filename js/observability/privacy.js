import { sanitizeKey, truncate } from "../analytics/privacy.js";

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_HASH_SEGMENT = /^[0-9a-f]{16,}$/i;
const LONG_HASH_SEGMENT = /^(?=.*[a-z])(?=.*\d)[a-z0-9_-]{24,}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SAFE_RELEASE = /^[A-Za-z0-9][A-Za-z0-9._:+/-]*$/;
const SENSITIVE_VALUE = /(?:\b(?:bearer|basic)\s+)|(?:authorization|token|password|passwd|secret|cookie)\s*[:=]|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const CLIENTS = new Set(["app", "miniprogram", "pc_game", "mobile_game", "mobile_web", "pc_web", "unknown"]);
const PLATFORMS = new Set(["ios", "android", "harmony", "windows", "macos", "linux", "unknown"]);
const ENVIRONMENTS = new Set(["production", "staging", "development", "test"]);

function stripOriginQueryAndFragment(value) {
    let raw = truncate(value, 2048);
    if (!raw) return "/";

    try {
        if (/^https?:\/\//i.test(raw)) raw = new URL(raw).pathname;
        else if (/^\/\//.test(raw)) raw = new URL("https:" + raw).pathname;
    } catch (error) {
        raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "");
    }

    const cutAt = [raw.indexOf("?"), raw.indexOf("#")].filter(function (index) {
        return index >= 0;
    }).sort(function (left, right) {
        return left - right;
    })[0];
    if (cutAt !== undefined) raw = raw.slice(0, cutAt);
    if (!raw.startsWith("/")) raw = "/" + raw;
    raw = raw.replace(/\/{2,}/g, "/");
    if (raw.length > 1) raw = raw.replace(/\/+$/, "");
    return raw.slice(0, 512) || "/";
}

function resolveExplicitTemplate(value, explicitTemplate) {
    if (typeof explicitTemplate === "string" && explicitTemplate.trim()) {
        return { explicit: true, value: explicitTemplate };
    }
    if (explicitTemplate === true) return { explicit: true, value };
    if (explicitTemplate && typeof explicitTemplate === "object") {
        const template = explicitTemplate.telemetryRoute || explicitTemplate.template || explicitTemplate.route;
        if (typeof template === "string" && template.trim()) return { explicit: true, value: template };
        if (explicitTemplate.explicit === true) return { explicit: true, value };
    }
    return { explicit: false, value };
}

function isDynamicSegment(segment) {
    return /^\d+$/.test(segment) || UUID_SEGMENT.test(segment) || HEX_HASH_SEGMENT.test(segment) || LONG_HASH_SEGMENT.test(segment);
}

function normalizeApiRoute(value, explicitTemplate) {
    const selected = resolveExplicitTemplate(value, explicitTemplate);
    const path = stripOriginQueryAndFragment(selected.value);
    if (selected.explicit) return path;

    const segments = path.split("/");
    const firstSegment = segments[1] || "";
    const staticLimit = firstSegment === "api" ? 3 : 1;

    return segments.map(function (segment, index) {
        if (!index || !segment || segment.charAt(0) === ":") return segment;
        if (isDynamicSegment(segment)) return ":id";
        return index > staticLimit ? ":id" : segment;
    }).join("/");
}

function stripUrlSecrets(value) {
    const raw = String(value || "");
    try {
        const parsed = new URL(raw.startsWith("//") ? "https:" + raw : raw);
        const origin = raw.startsWith("//") ? "//" + parsed.host : parsed.origin;
        return origin + normalizeApiRoute(parsed.pathname);
    } catch (error) {
        return raw.split(/[?#]/, 1)[0];
    }
}

function sanitizeSensitiveText(value, maxLength) {
    if (value === undefined || value === null) return "";
    let text = String(value).replace(/\r\n?/g, "\n");

    text = text.replace(/(?:https?:)?\/\/[^\s"'<>)}\]]+/gi, function (url) {
        return stripUrlSecrets(url);
    });
    text = text.replace(/((?:^|[\s("'=])\/[^\s"'<>?#]*)[?#][^\s"'<>)}\]]*/g, "$1");
    text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]");
    text = text.replace(/\bBasic\s+[A-Za-z0-9+/=]+/gi, "Basic [REDACTED]");
    text = text.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_JWT]");
    text = text.replace(
        /(["']?)(authorization|token|access[_-]?token|refresh[_-]?token|password|passwd|secret|cookie|set-cookie)\1\s*[:=]\s*(["'])[^"']*\3/gi,
        "$1$2$1=[REDACTED]"
    );
    text = text.replace(
        /\b(authorization|token|access[_-]?token|refresh[_-]?token|password|passwd|secret|cookie|set-cookie)["']?\s*[:=]\s*[^\s,;}]+/gi,
        "$1=[REDACTED]"
    );
    text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]");
    text = text.replace(/(^|[^\d])1[3-9]\d{9}(?!\d)/g, "$1[REDACTED_PHONE]");
    text = text.replace(/\b\d{17}[\dXx]\b/g, "[REDACTED_ID_CARD]");
    text = text.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]");
    text = text.replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi, "[REDACTED_IP]");
    text = text.replace(/[0-9a-f]{8}-[0-9a-f-]{27,36}/gi, "[REDACTED_UUID]");
    text = text.replace(/\b[0-9a-f]{16,}\b/gi, "[REDACTED_IDENTIFIER]");
    text = text.replace(/\b\d{6,}\b/g, "[REDACTED_NUMBER]");
    text = text.replace(/\/Users\/[^/\s]+/g, "/Users/[REDACTED]");
    text = text.replace(/\/home\/[^/\s]+/g, "/home/[REDACTED]");
    text = text.replace(/\b[A-Z]:\\Users\\[^\\\s]+/gi, "C:\\Users\\[REDACTED]");
    text = text.replace(
        /<(?:html|body|main|form|textarea|select|option|article|section|div|span|p|label|button)\b[^>]*>[\s\S]*?<\/(?:html|body|main|form|textarea|select|option|article|section|div|span|p|label|button)\s*>/gi,
        "[REDACTED_DOM]"
    );
    text = text.replace(/<[^>]{1,2048}>/g, "[REDACTED_DOM]");
    return text.slice(0, maxLength);
}

function errorText(value, field) {
    if (value === undefined || value === null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value[field] === "string") return value[field];
    if (field === "message" && value && typeof value.name === "string") return value.name;
    return "";
}

function sanitizeErrorMessage(value, fallback) {
    const message = errorText(value, "message") || errorText(fallback, "message");
    return sanitizeSensitiveText(message, 4096).trim();
}

function isStackFrame(line) {
    const chromeFrame = /^\s*at\s+.*(?:(?:https?|file|webpack|capacitor|blob|chrome-extension):\/\/|node:|\/|[A-Za-z]:\\|<anonymous>|native\b|[A-Za-z0-9_.-]+\.m?js:).*(?::\d+(?::\d+)?|native\b)(?:[?#].*)?\)?\s*$/i;
    const firefoxFrame = /^[^@\n]*@(?:(?:https?|file|webpack|capacitor|blob|chrome-extension):\/\/|node:|\/|[A-Za-z]:\\|<anonymous>|[A-Za-z0-9_.-]+\.m?js:).*:\d+(?::\d+)?(?:[?#].*)?\s*$/i;
    return chromeFrame.test(line) || firefoxFrame.test(line);
}

function sanitizeErrorStack(value) {
    const stack = errorText(value, "stack");
    if (!stack) return "";
    const frames = stack.split(/\r?\n/).filter(function (line) {
        return isStackFrame(line);
    }).slice(0, 50);
    return sanitizeSensitiveText(frames.join("\n"), 16384).trim();
}

function sanitizeIdentifier(value, maxLength, pattern) {
    const result = truncate(value, maxLength);
    if (!result || SENSITIVE_VALUE.test(result) || !pattern.test(result)) return "";
    return result;
}

function sanitizeMetadata(metadata) {
    const source = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
    const output = {};
    const instanceId = sanitizeIdentifier(source.instance_id, 128, SAFE_IDENTIFIER);
    const projectKey = sanitizeKey(source.project_key, 64).toLowerCase();
    const environment = truncate(source.environment, 32).toLowerCase();
    const release = sanitizeIdentifier(source.release, 128, SAFE_RELEASE);
    const sdkVersion = sanitizeIdentifier(source.sdk_version, 32, SAFE_RELEASE);
    const client = truncate(source.client, 32).toLowerCase();
    const platform = truncate(source.platform, 32).toLowerCase();

    if (instanceId) output.instance_id = instanceId;
    if (/^[a-z0-9][a-z0-9._-]*$/.test(projectKey)) output.project_key = projectKey;
    if (ENVIRONMENTS.has(environment)) output.environment = environment;
    if (release) output.release = release;
    if (sdkVersion) output.sdk_version = sdkVersion;
    if (CLIENTS.has(client)) output.client = client;
    if (PLATFORMS.has(platform)) output.platform = platform;

    ["app_version", "app_build", "web_version"].forEach(function (key) {
        if (source[key] === null) {
            output[key] = null;
            return;
        }
        const version = sanitizeIdentifier(source[key], 64, SAFE_RELEASE);
        if (version) output[key] = version;
    });
    return output;
}

export { normalizeApiRoute, sanitizeErrorMessage, sanitizeErrorStack, sanitizeMetadata };
