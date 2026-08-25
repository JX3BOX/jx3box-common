import { createTransport } from "../analytics/transport.js";
import { utf8ByteLength } from "../analytics/utils.js";
import { genericErrorMessageForSource, safeErrorNameForSource } from "./error.js";
import { isNativeFetchAdapter } from "./native.js";
import { normalizeApiRoute, sanitizeErrorStack, sanitizeMetadata } from "./privacy.js";

const TERMINAL_STATUSES = new Set(["accepted", "duplicate", "ignored_robot"]);
const SAFE_EVENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,63}$/;
const SAFE_SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_SERVICE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ERROR_SOURCES = new Set([
    "vue",
    "window_error",
    "unhandledrejection",
    "resource",
    "router",
    "chunk",
    "startup",
    "request_unhandled",
]);
const ERROR_SEVERITIES = new Set(["warning", "error", "fatal"]);
const HTTP_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const RESULT_COUNT_FIELDS = [
    "success_count",
    "business_error_count",
    "http_4xx_count",
    "http_5xx_count",
    "timeout_count",
    "network_error_count",
    "offline_count",
    "cancelled_count",
];
const LATENCY_COUNT_FIELDS = [
    "latency_lt_300_count",
    "latency_300_999_count",
    "latency_1000_2999_count",
    "latency_3000_9999_count",
    "latency_gte_10000_count",
];
const OTHER_COUNT_FIELDS = [
    "request_count",
    "slow_count",
    "latency_sum_ms",
];
const MAX_GROUP_ITEMS = 20;
const MAX_ENVELOPE_BYTES = 44 * 1024;
const MAX_COUNT = 1_000_000_000;
const METRIC_PAST_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;
const METRIC_FUTURE_WINDOW_MS = 10 * 60 * 1000;

function normalizeQueueId(value) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    const id = String(value || "").trim();
    return SAFE_EVENT_ID.test(id) ? id : "";
}

function normalizeSessionId(value) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    const id = String(value || "").trim();
    return SAFE_SESSION_ID.test(id) ? id : "";
}

function stableMetadataKey(metadata) {
    const ordered = {};
    [
        "instance_id",
        "project_key",
        "environment",
        "release",
        "sdk_version",
        "client",
        "platform",
        "app_version",
        "app_build",
        "web_version",
    ].forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(metadata, key)) ordered[key] = metadata[key];
    });
    return JSON.stringify(ordered);
}

function safeRead(value, key) {
    try {
        return value[key];
    } catch (error) {
        return undefined;
    }
}

function isoDate(value) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function boundedInteger(value, minimum, maximum) {
    return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
        ? value
        : null;
}

function metadataReady(metadata) {
    return !!(metadata.instance_id
        && metadata.project_key
        && metadata.environment
        && metadata.release
        && metadata.sdk_version
        && metadata.client
        && metadata.platform);
}

function copyBreadcrumbs(value) {
    if (!Array.isArray(value)) return value === null ? null : undefined;
    const output = value.slice(-10).map(function (item) {
        if (!item || typeof item !== "object") return null;
        const occurredAt = isoDate(safeRead(item, "occurred_at"));
        const routePattern = safeRead(item, "route_pattern");
        if (!occurredAt || typeof routePattern !== "string" || !routePattern.trim()) return null;
        return {
            occurred_at: occurredAt,
            route_pattern: normalizeApiRoute(routePattern, { explicit: false }),
        };
    }).filter(Boolean);
    return output.length ? output : null;
}

function copyErrorPayload(payload) {
    const occurredAt = isoDate(safeRead(payload, "occurred_at"));
    const source = safeRead(payload, "source");
    const severity = safeRead(payload, "severity") === undefined ? "error" : safeRead(payload, "severity");
    const rawName = safeRead(payload, "error_name");
    const rawStack = safeRead(payload, "stack");
    if (!occurredAt || !ERROR_SOURCES.has(source) || !ERROR_SEVERITIES.has(severity)) return null;
    if (typeof rawName !== "string") return null;
    if (rawStack !== undefined && rawStack !== null && typeof rawStack !== "string") return null;

    const output = {
        occurred_at: occurredAt,
        source,
        severity,
        error_name: safeErrorNameForSource(rawName, source),
        message: genericErrorMessageForSource(source),
        occurrence_count: 1,
    };
    if (rawStack !== undefined) output.stack = rawStack === null ? null : sanitizeErrorStack(rawStack);

    const requestId = safeRead(payload, "request_id");
    if (requestId !== undefined) {
        if (typeof requestId !== "string" || !SAFE_REQUEST_ID.test(requestId) || /^eyJ|token|secret|bearer/i.test(requestId)) return null;
        output.request_id = requestId;
    }

    const routePattern = safeRead(payload, "route_pattern");
    if (routePattern !== undefined) {
        if (routePattern !== null && typeof routePattern !== "string") return null;
        output.route_pattern = routePattern === null ? null : normalizeApiRoute(routePattern, { explicit: false });
    }

    const breadcrumbs = safeRead(payload, "breadcrumbs");
    if (breadcrumbs !== undefined) output.breadcrumbs = copyBreadcrumbs(breadcrumbs);
    const occurrenceCount = safeRead(payload, "occurrence_count");
    if (occurrenceCount !== undefined) {
        const normalizedCount = boundedInteger(occurrenceCount, 1, 10_000);
        if (normalizedCount === null) return null;
        output.occurrence_count = normalizedCount;
    }
    return output;
}

function copyMetricPayload(payload, now) {
    const bucketSeconds = boundedInteger(safeRead(payload, "bucket_seconds"), 10, 300);
    const rawBucketStart = safeRead(payload, "bucket_start");
    const bucketStart = isoDate(rawBucketStart);
    const bucketTimestamp = bucketStart ? new Date(bucketStart).getTime() : NaN;
    const serviceKey = safeRead(payload, "service_key");
    const httpMethod = safeRead(payload, "http_method");
    const apiRoute = safeRead(payload, "api_route");
    if (!bucketSeconds || !bucketStart || bucketTimestamp % (bucketSeconds * 1000) !== 0) return null;
    if (bucketTimestamp < now - METRIC_PAST_WINDOW_MS || bucketTimestamp > now + METRIC_FUTURE_WINDOW_MS) return null;
    if (typeof serviceKey !== "string" || !SAFE_SERVICE_KEY.test(serviceKey)) return null;
    if (typeof httpMethod !== "string" || !HTTP_METHODS.has(httpMethod)) return null;
    if (typeof apiRoute !== "string" || !apiRoute.trim()) return null;

    const output = {
        bucket_start: bucketStart,
        bucket_seconds: bucketSeconds,
        service_key: serviceKey,
        http_method: httpMethod,
        api_route: normalizeApiRoute(apiRoute, { explicit: safeRead(payload, "_api_route_template") === true }),
    };
    const countFields = OTHER_COUNT_FIELDS.concat(RESULT_COUNT_FIELDS, LATENCY_COUNT_FIELDS);
    for (const key of countFields) {
        const normalized = boundedInteger(safeRead(payload, key), 0, MAX_COUNT);
        if (normalized === null) return null;
        output[key] = normalized;
    }
    const maxLatency = boundedInteger(safeRead(payload, "max_latency_ms"), 0, 86_400_000);
    if (maxLatency === null) return null;
    output.max_latency_ms = maxLatency;

    const resultCount = RESULT_COUNT_FIELDS.reduce(function (sum, key) { return sum + output[key]; }, 0);
    const latencyCount = LATENCY_COUNT_FIELDS.reduce(function (sum, key) { return sum + output[key]; }, 0);
    if (resultCount !== output.request_count || latencyCount > output.request_count || output.slow_count > output.request_count) {
        return null;
    }
    return output;
}

function prepareQueueItem(item, kind, now) {
    try {
        if (!item || typeof item !== "object") return null;
        const eventId = normalizeQueueId(safeRead(item, "event_id"));
        if (!eventId) return null;
        const payload = kind === "error" ? safeRead(item, "event") : safeRead(item, "metric");
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

        const metadata = sanitizeMetadata(safeRead(item, "_metadata"));
        if (!metadataReady(metadata)) return null;
        const normalizedPayload = kind === "error" ? copyErrorPayload(payload) : copyMetricPayload(payload, now);
        if (!normalizedPayload) return null;
        return {
            event_id: eventId,
            metadata,
            session_id: kind === "error" ? normalizeSessionId(safeRead(item, "_session_id")) : "",
            payload: normalizedPayload,
        };
    } catch (error) {
        return null;
    }
}

function groupQueueItems(items, kind, now) {
    const groups = new Map();
    (Array.isArray(items) ? items : []).forEach(function (item) {
        const prepared = prepareQueueItem(item, kind, now);
        if (!prepared) return;
        const key = stableMetadataKey(prepared.metadata) + "\n" + prepared.session_id;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(prepared);
    });
    return Array.from(groups.values());
}

function createEnvelope(kind, items) {
    const first = items[0] || { metadata: {}, session_id: "" };
    const envelope = Object.assign({}, first.metadata);
    if (kind === "error" && first.session_id) envelope.session_id = first.session_id;

    if (kind === "error") {
        envelope.events = items.map(function (item) {
            return Object.assign({}, item.payload, { event_id: item.event_id });
        });
    } else {
        envelope.metrics = items.map(function (item) {
            return Object.assign({}, item.payload, { metric_id: item.event_id });
        });
    }
    return envelope;
}

function prepareGroups(items, kind, now) {
    const chunks = [];
    groupQueueItems(items, kind, now).forEach(function (group) {
        let current = [];
        group.forEach(function (item) {
            const candidate = current.concat([item]);
            const candidateBytes = utf8ByteLength(JSON.stringify(createEnvelope(kind, candidate)));
            if (candidate.length > MAX_GROUP_ITEMS || candidateBytes > MAX_ENVELOPE_BYTES) {
                if (current.length) chunks.push(current);
                current = [];
                const singleBytes = utf8ByteLength(JSON.stringify(createEnvelope(kind, [item])));
                if (singleBytes <= MAX_ENVELOPE_BYTES) current = [item];
                return;
            }
            current = candidate;
        });
        if (current.length) chunks.push(current);
    });
    return chunks;
}

function createConfirmationParser(kind) {
    const idField = kind === "error" ? "event_id" : "metric_id";
    return function parseConfirmation(payload, fallbackIds) {
        if (!payload || typeof payload !== "object") return [];
        if (Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) return [];
        const data = Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
        if (!data || !Array.isArray(data.items)) return [];
        const expected = new Set(fallbackIds || []);
        const confirmed = [];
        data.items.forEach(function (item) {
            if (!item || !TERMINAL_STATUSES.has(String(item.status || "").toLowerCase())) return;
            const id = normalizeQueueId(item[idField]);
            if (id && expected.has(id) && !confirmed.includes(id)) confirmed.push(id);
        });
        return confirmed;
    };
}

function createJsonBlobFactory(settings) {
    const runtime = settings.runtime || {};
    const BlobConstructor = settings.Blob || runtime.Blob || (typeof Blob === "function" ? Blob : null);
    return function jsonBlob(envelope) {
        if (!BlobConstructor) throw new Error("Blob is unavailable for observability Beacon transport");
        return new BlobConstructor([JSON.stringify(envelope)], { type: "application/json" });
    };
}

function projectTransportResult(result) {
    return {
        ok: !!(result && result.ok),
        retryable: !result || result.retryable !== false,
        status: Number(result && result.status) || 0,
        confirmedEventIds: Array.isArray(result && result.confirmedEventIds)
            ? result.confirmedEventIds.filter(function (id) { return typeof id === "string"; })
            : [],
    };
}

function createObservabilityTransport(options) {
    const settings = options || {};
    const kind = settings.kind;
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    if (kind !== "error" && kind !== "metric") {
        throw new TypeError("createObservabilityTransport kind must be 'error' or 'metric'");
    }

    const disableBeacon = settings.disableBeacon === true
        || settings.transportMode === "native"
        || isNativeFetchAdapter(settings.fetch);
    const baseTransport = createTransport(Object.assign({}, settings, {
        navigator: disableBeacon ? {} : settings.navigator,
        eventIdProvider: function (item) {
            return item.event_id;
        },
        envelopeFactory: function (items) {
            return createEnvelope(kind, items);
        },
        confirmationParser: createConfirmationParser(kind),
        beaconBodyFactory: createJsonBlobFactory(settings),
    }));

    async function send(items) {
        const input = Array.isArray(items) ? items : [];
        const groups = prepareGroups(input, kind, now());
        if (!groups.length) {
            return { ok: false, retryable: true, status: 0, confirmedEventIds: [], groupResults: [] };
        }

        const groupResults = [];
        const confirmedEventIds = [];
        for (const group of groups) {
            const rawResult = await baseTransport.send(group);
            const status = Number(rawResult && rawResult.status) || 0;
            const normalizedResult = status >= 200 && status < 300
                ? rawResult
                : Object.assign({}, rawResult, {
                    ok: false,
                    retryable: true,
                    confirmedEventIds: [],
                });
            const result = projectTransportResult(normalizedResult);
            groupResults.push(result);
            (result.confirmedEventIds || []).forEach(function (id) {
                if (!confirmedEventIds.includes(id)) confirmedEventIds.push(id);
            });
        }

        const validItemCount = groups.reduce(function (total, group) {
            return total + group.length;
        }, 0);
        const complete = validItemCount === input.length && confirmedEventIds.length === validItemCount;
        const failedResult = groupResults.find(function (result) {
            return !result.ok;
        });
        return {
            ok: complete && !failedResult,
            retryable: !complete || groupResults.some(function (result) { return result.retryable; }),
            status: failedResult ? failedResult.status : groupResults[groupResults.length - 1].status,
            confirmedEventIds,
            groupResults,
        };
    }

    function sendBeacon(items) {
        const groups = prepareGroups(items, kind, now());
        if (!groups.length) return false;
        let allQueued = true;
        groups.forEach(function (group) {
            // Do not short-circuit: every metadata/session group gets one
            // opportunity. Beacon has no ACK, so the caller keeps its queue.
            if (baseTransport.sendBeacon(group) !== true) allQueued = false;
        });
        return allQueued;
    }

    function createEnvelopes(items) {
        return prepareGroups(items, kind, now()).map(function (group) {
            return createEnvelope(kind, group);
        });
    }

    return { createEnvelopes, send, sendBeacon };
}

export { createObservabilityTransport };
