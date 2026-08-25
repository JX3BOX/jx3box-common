import { sanitizeErrorStack } from "./privacy.js";
import { markTelemetryObject } from "./dedupe.js";
import { normalizeRoutePath } from "../analytics/privacy.js";

const ALLOWED_SOURCES = new Set([
    "vue",
    "window_error",
    "unhandledrejection",
    "resource",
    "router",
    "chunk",
    "startup",
    "request_unhandled",
]);
const ALLOWED_SEVERITIES = new Set(["warning", "error", "fatal"]);
const EVENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;
const PRIMITIVE_REJECTION_MESSAGE = "Unhandled promise rejection";
const RESOURCE_ERROR_MESSAGE = "Resource failed to load";
const UNKNOWN_ERROR_MESSAGE = "Unknown client error";
const SOURCE_MESSAGES = Object.freeze({
    vue: "Vue runtime error",
    window_error: "Window runtime error",
    unhandledrejection: PRIMITIVE_REJECTION_MESSAGE,
    resource: RESOURCE_ERROR_MESSAGE,
    router: "Router navigation error",
    chunk: "Chunk loading error",
    startup: "Application startup error",
    request_unhandled: "HTTP request failed",
});
const SOURCE_ERROR_NAMES = Object.freeze({
    unhandledrejection: "UnhandledRejection",
    resource: "ResourceError",
    router: "RouterError",
    chunk: "ChunkLoadError",
    request_unhandled: "HttpRequestError",
});
const SAFE_ERROR_NAMES = new Set([
    "Error",
    "TypeError",
    "ReferenceError",
    "RangeError",
    "SyntaxError",
    "URIError",
    "EvalError",
    "AggregateError",
    "DOMException",
    "AxiosError",
    "AbortError",
    "TimeoutError",
    "NetworkError",
    "SecurityError",
    "NotAllowedError",
    "NotFoundError",
    "InvalidStateError",
    "QuotaExceededError",
    "DataCloneError",
    "EncodingError",
    "OperationError",
    "UnhandledRejection",
    "ResourceError",
    "RouterError",
    "ChunkLoadError",
    "HttpRequestError",
]);

function safeRead(value, key) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    try {
        return value[key];
    } catch (error) {
        return undefined;
    }
}

function normalizeEventId(value) {
    const eventId = typeof value === "string" ? value.trim() : "";
    return EVENT_ID_PATTERN.test(eventId) ? eventId : "";
}

function normalizeOccurredAt(value, fallback) {
    const candidate = value === undefined || value === null ? fallback : value;
    try {
        const date = candidate instanceof Date ? candidate : new Date(candidate);
        return Number.isFinite(date.getTime()) ? date.toISOString() : "";
    } catch (error) {
        return "";
    }
}

function normalizeSource(value) {
    return ALLOWED_SOURCES.has(value) ? value : "window_error";
}

function normalizeSeverity(value) {
    return ALLOWED_SEVERITIES.has(value) ? value : "error";
}

function genericErrorMessageForSource(value) {
    return SOURCE_MESSAGES[value] || UNKNOWN_ERROR_MESSAGE;
}

function safeErrorNameForSource(value, source) {
    const fallback = SOURCE_ERROR_NAMES[source] || "Error";
    const name = typeof value === "string" ? value.trim() : "";
    return SAFE_ERROR_NAMES.has(name) ? name : fallback;
}

function normalizeOccurrenceCount(value) {
    try {
        const count = Number(value);
        if (!Number.isFinite(count)) return 1;
        return Math.max(1, Math.min(10000, Math.floor(count)));
    } catch (error) {
        return 1;
    }
}

function normalizeOptionalRoute(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    return normalizeRoutePath(value).slice(0, 512);
}

function sanitizedStack(value) {
    if (typeof value !== "string") return null;
    try {
        const sanitized = sanitizeErrorStack(value);
        return typeof sanitized === "string" && sanitized.trim() ? sanitized : null;
    } catch (error) {
        return null;
    }
}

function normalizeBreadcrumbs(value) {
    if (!Array.isArray(value)) return null;
    const normalized = [];
    value.slice(-10).forEach(function (entry) {
        const occurredAt = normalizeOccurredAt(safeRead(entry, "occurred_at"), NaN);
        const routePattern = normalizeOptionalRoute(safeRead(entry, "route_pattern"));
        if (!occurredAt || !routePattern) return;
        normalized.push({ occurred_at: occurredAt, route_pattern: routePattern });
    });
    return normalized.length ? normalized : null;
}

function readErrorDetails(error, source, primitiveReason, context) {
    if (source === "resource") {
        return {
            errorName: "ResourceError",
            message: RESOURCE_ERROR_MESSAGE,
            stack: null,
        };
    }

    if (primitiveReason) {
        return {
            errorName: "UnhandledRejection",
            message: PRIMITIVE_REJECTION_MESSAGE,
            stack: null,
        };
    }

    const value = context || {};
    const contextualName = safeRead(value, "error_name");
    const contextualStack = safeRead(value, "stack");
    const rawName = typeof contextualName === "string" ? contextualName : safeRead(error, "name");
    const rawStack = typeof contextualStack === "string" ? contextualStack : safeRead(error, "stack");

    return {
        errorName: safeErrorNameForSource(rawName, source),
        // Error.message frequently includes form values, search terms or
        // response text. A source label is safe and stable for aggregation;
        // sanitized code frames retain the actionable location details.
        message: genericErrorMessageForSource(source),
        stack: sanitizedStack(rawStack),
    };
}

function createErrorEvent(error, context) {
    const value = context || {};
    const eventId = normalizeEventId(safeRead(value, "event_id"));
    if (!eventId) return null;

    const source = normalizeSource(safeRead(value, "source"));
    const primitiveReason = safeRead(value, "primitive_reason") === true
        || (source === "unhandledrejection" && (error === null || (typeof error !== "object" && typeof error !== "function")));
    const details = readErrorDetails(error, source, primitiveReason, value);
    const occurredAt = normalizeOccurredAt(safeRead(value, "occurred_at"), Date.now());
    if (!occurredAt) return null;

    const event = {
        event_id: eventId,
        occurred_at: occurredAt,
        source,
        severity: normalizeSeverity(safeRead(value, "severity")),
        error_name: details.errorName || "Error",
        message: details.message || UNKNOWN_ERROR_MESSAGE,
        stack: details.stack || null,
        route_pattern: normalizeOptionalRoute(safeRead(value, "route_pattern")),
        breadcrumbs: normalizeBreadcrumbs(safeRead(value, "breadcrumbs")),
        occurrence_count: normalizeOccurrenceCount(safeRead(value, "occurrence_count")),
    };

    try {
        markTelemetryObject(error, eventId);
    } catch (markError) {
        // The event is still safe to enqueue when a host object cannot be marked.
    }
    return event;
}

export {
    PRIMITIVE_REJECTION_MESSAGE,
    RESOURCE_ERROR_MESSAGE,
    createErrorEvent,
    genericErrorMessageForSource,
    safeErrorNameForSource,
};
