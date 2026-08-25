import { normalizeRoutePattern } from "./privacy.js";

const TERMINAL_ACK_STATES = new Set(["accepted", "duplicate", "rejected"]);
const RETRY_ACK_STATES = new Set(["retry", "pending", "retryable"]);
const FORBIDDEN_TRACKING_KEYS = new Set([
    "authorization",
    "cookie",
    "full_url",
    "fullpath",
    "hash",
    "href",
    "location",
    "query",
    "raw_query",
    "search",
    "token",
    "url",
]);

function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function compactObject(value) {
    const output = {};
    Object.keys(value || {}).forEach(function (key) {
        if (value[key] !== undefined && value[key] !== "") output[key] = value[key];
    });
    return output;
}

function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
}

function safeToken(value, maxLength) {
    const text = String(value === undefined || value === null ? "" : value).trim().slice(0, maxLength || 128);
    return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text) ? text : "";
}

function safeDomain(value) {
    const domain = String(value || "").trim().toLowerCase().slice(0, 253);
    return domain && !/[\s/?#]/.test(domain) ? domain : "";
}

function safePath(value) {
    const path = String(value || "").trim().slice(0, 2048);
    if (!path
        || path.charAt(0) !== "/"
        || path.slice(0, 2) === "//"
        || /[?#\\\u0000-\u001f\u007f]/.test(path)
        || path.indexOf("://") >= 0) return "";
    return path;
}

function safeInteger(value, maximum) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || Math.floor(number) !== number) return undefined;
    return Math.min(number, maximum || 4294967295);
}

function sanitizeTarget(value, requireType) {
    if (!isObject(value)) return undefined;
    const output = compactObject({
        key: safeToken(value.key || value.target_key || value.query_key, 64),
        type: safeToken(value.type || value.target_type, 64),
        variant: safeToken(value.variant, 32),
        id: safeToken(value.id || value.target_id, 128),
        revision_id: safeToken(value.revision_id, 128),
    });
    if (!output.id || (requireType && !output.type)) return undefined;
    return output;
}

function sanitizeTrackingProperties(value, depth) {
    if (depth > 2 || !isObject(value)) return undefined;
    const output = {};
    Object.keys(value).slice(0, 50).forEach(function (rawKey) {
        const key = safeToken(rawKey, 64);
        const normalizedKey = key.toLowerCase();
        if (!key
            || FORBIDDEN_TRACKING_KEYS.has(normalizedKey)
            || /(password|secret|jwt|email|phone|query|search|token|cookie|authorization|href|url|hash)/i.test(normalizedKey)) return;
        const item = value[rawKey];
        if (typeof item === "string") {
            if (item.indexOf("://") >= 0 || item.indexOf("?") >= 0 || item.indexOf("#") >= 0) return;
            output[key] = item.slice(0, 256);
        } else if (typeof item === "number" && Number.isFinite(item)) {
            output[key] = item;
        } else if (typeof item === "boolean") {
            output[key] = item;
        } else if (isObject(item)) {
            const nested = sanitizeTrackingProperties(item, depth + 1);
            if (nested) output[key] = nested;
        }
    });
    return Object.keys(output).length ? output : undefined;
}

function projectTrackingEvent(event) {
    const source = event || {};
    const output = {};
    const scalarKeys = [
        "schema_version", "event_id", "instance_id", "session_id", "sequence_no", "previous_event_id",
        "previous_canonical_event_id",
        "page_view_id", "occurred_at", "timezone_offset", "event_type", "event_name", "page_key",
        "route_name", "from_page_key", "from_route_name",
        "navigation_type", "is_entry", "layout_version", "target_key", "target_type", "target_id",
        "product", "project", "client", "surface", "game_client", "platform", "domain", "channel",
        "app_version", "app_build", "web_version", "referrer_domain", "display_mode", "sample_rate",
        "viewport_x_ratio", "viewport_y_ratio", "page_x_ratio", "page_y_ratio", "target_x_ratio",
        "target_y_ratio", "viewport_width", "viewport_height", "document_width", "document_height",
        "scroll_x", "scroll_y",
    ];
    scalarKeys.forEach(function (key) {
        if (source[key] !== undefined && source[key] !== null) output[key] = source[key];
    });
    const routePath = safePath(source.route_path || source.path);
    if (routePath) output.route_path = routePath;
    const routePattern = normalizeRoutePattern(source.route_pattern);
    if (routePattern) output.route_pattern = routePattern;
    const fromRoutePattern = normalizeRoutePattern(source.from_route_pattern);
    if (fromRoutePattern) output.from_route_pattern = fromRoutePattern;
    const interactionTarget = sanitizeTarget(source.interaction_target, false);
    if (interactionTarget) output.interaction_target = interactionTarget;
    const publicTarget = sanitizeTarget(source.public_target, true);
    if (publicTarget) output.public_target = publicTarget;
    const properties = sanitizeTrackingProperties(source.properties, 0);
    if (properties) output.properties = properties;
    return output;
}

function sanitizeEntrySource(value, referrerDomain) {
    const source = isObject(value) ? value : {};
    const output = {};
    const type = safeToken(source.type, 32);
    if (type) output.type = type;
    // Only an origin reconstructed from an already-sanitized hostname may be
    // sent. A raw referrer path, query or fragment is never forwarded.
    const domain = safeDomain(referrerDomain || source.referrer_domain);
    if (domain) output.referrer = "https://" + domain + "/";
    return Object.keys(output).length ? output : undefined;
}

function trafficContextForEvent(event) {
    const source = isObject(event.traffic_context) ? event.traffic_context : event;
    return compactObject({
        instance_id: safeToken(source.instance_id || event.instance_id, 128),
        session_id: safeToken(source.session_id || event.session_id, 128),
        surface: safeToken(source.surface || event.surface, 32),
        domain: safeDomain(source.domain || event.domain) || "unknown",
        game_client: safeToken(source.game_client || event.game_client, 16) || "unknown",
        entry_source: sanitizeEntrySource(source.entry_source || event.entry_source, source.referrer_domain || event.referrer_domain),
    });
}

function projectTrafficEvent(event) {
    const source = event || {};
    const routePattern = normalizeRoutePattern(source.route_pattern);
    const path = safePath(source.canonical_path || source.route_path || source.path)
        || (routePattern && routePattern.indexOf("?") < 0 ? routePattern : "")
        || "/__unclassified__";
    const publicTarget = sanitizeTarget(source.public_target, true);
    const target = publicTarget ? compactObject({
        type: publicTarget.type,
        variant: publicTarget.variant,
        id: publicTarget.id,
        revision_id: publicTarget.revision_id,
    }) : undefined;
    const output = compactObject({
        event_id: safeToken(source.event_id, 128),
        occurred_at: typeof source.occurred_at === "string" ? source.occurred_at.slice(0, 64) : undefined,
        project: safeToken(source.project, 64),
        path,
        route_pattern: routePattern,
        page_key: safeToken(source.page_key, 128),
        target,
        previous_event_id: safeToken(source.previous_event_id, 128),
        sequence: safeInteger(source.sequence === undefined ? source.sequence_no : source.sequence),
        is_entry: source.is_entry === true,
        is_exit: source.is_exit === true,
        duration_ms: source.duration_ms === null ? null : safeInteger(source.duration_ms, 86400000),
    });
    // interaction_target and the legacy flat target fields are deliberately
    // ignored. Only the rule-resolved public_target may enter traffic.
    return output;
}

function trafficPartition(events, context) {
    const groups = new Map();
    (events || []).forEach(function (event) {
        const trafficContext = trafficContextForEvent(event);
        const key = JSON.stringify(trafficContext);
        if (!groups.has(key)) groups.set(key, { context: Object.assign({}, context || {}, trafficContext), events: [] });
        groups.get(key).events.push(event);
    });
    return Array.from(groups.values());
}

function normalizeAckState(value) {
    const state = String(value || "").toLowerCase();
    if (state === "acknowledged" || state === "success") return "accepted";
    if (state === "ignored_robot") return "rejected";
    if (state === "disabled") return "rejected";
    if (TERMINAL_ACK_STATES.has(state)) return state;
    if (RETRY_ACK_STATES.has(state)) return "retry";
    return "";
}

function normalizeBlock(value) {
    if (!value) return null;
    if (typeof value === "string") return { reason: value.slice(0, 128), clear: true };
    if (!isObject(value)) return null;
    return {
        reason: String(value.reason || value.code || "blocked").slice(0, 128),
        clear: value.clear !== false,
        details: isObject(value.details) ? value.details : undefined,
    };
}

function defaultAckDecoder(payload) {
    if (!payload || typeof payload !== "object") return { deliveries: [] };
    const data = Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
    if (!isObject(data)) return { deliveries: [] };
    const deliveries = [];
    let block = normalizeBlock(data.blocked || data.block);

    if (data.enabled === false && !block) block = { reason: "disabled", clear: true };
    if (Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) {
        return { block, deliveries: [] };
    }
    (Array.isArray(data.items) ? data.items : []).forEach(function (item) {
        if (!isObject(item)) return;
        const state = normalizeAckState(item.state || item.status);
        const eventId = item.event_id || item.id;
        if (!state || !eventId) return;
        if (String(item.status || "").toLowerCase() === "ignored_robot" && !block) {
            block = { reason: "robot", clear: true };
        }
        if (String(item.status || "").toLowerCase() === "disabled" && !block) {
            block = { reason: "disabled", clear: true };
        }
        deliveries.push({
            event_id: String(eventId),
            state,
            reason: item.reason,
            retry_after_ms: item.retry_after_ms,
        });
    });

    [
        [data.acknowledged_event_ids, "accepted"],
        [data.accepted_event_ids, "accepted"],
        [data.duplicate_event_ids, "duplicate"],
        [data.rejected_event_ids, "rejected"],
        [data.retry_event_ids, "retry"],
        [Array.isArray(data.accepted) ? data.accepted : null, "accepted"],
        [Array.isArray(data.duplicate) ? data.duplicate : null, "duplicate"],
        [Array.isArray(data.rejected) ? data.rejected : null, "rejected"],
        [Array.isArray(data.retry) ? data.retry : null, "retry"],
    ].forEach(function (pair) {
        if (!Array.isArray(pair[0])) return;
        pair[0].forEach(function (item) {
            const eventId = typeof item === "string" ? item : item && item.event_id;
            if (eventId) deliveries.push({
                event_id: String(eventId),
                state: pair[1],
                reason: item && item.reason,
                retry_after_ms: item && item.retry_after_ms,
            });
        });
    });
    return {
        block,
        deliveries,
        retry_after_ms: Math.max(0, Number(data.retry_after_ms) || Number(data.retry_after) * 1000 || 0),
        rule_version: data.rule_version,
    };
}

function responseRetryAfterMs(response, payload) {
    let value = "";
    try {
        if (response && response.headers && typeof response.headers.get === "function") {
            value = response.headers.get("Retry-After") || "";
        }
    } catch (error) {
        value = "";
    }
    const seconds = Number(value);
    if (value !== "" && Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const retryAt = Date.parse(value);
    if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
    const data = isObject(payload) && isObject(payload.data) ? payload.data : payload;
    return Math.max(0, Number(data && data.retry_after_ms) || Number(data && data.retry_after) * 1000 || 0);
}

function defaultRetryPolicy(context) {
    return {
        action: "retry",
        delayMs: Math.max(0, Number(context.retryAfterMs) || 0),
        reason: context.error ? "network_error" : ("http_" + String(context.status || 0)),
    };
}

function normalizeRetryDecision(value, fallback) {
    const source = typeof value === "string" ? { action: value } : (isObject(value) ? value : {});
    const action = ["retry", "reject", "block"].indexOf(source.action) >= 0 ? source.action : "retry";
    return {
        action,
        block: normalizeBlock(source.block || (action === "block" ? { reason: source.reason || "blocked" } : null)),
        delayMs: Math.max(0, Number(source.delayMs || source.retry_after_ms || fallback) || 0),
        reason: String(source.reason || "retry").slice(0, 128),
    };
}

function normalizeDecoded(value, expectedIds) {
    const decoded = Array.isArray(value)
        ? { accepted_event_ids: value }
        : (isObject(value) ? value : {});
    const expected = new Set(expectedIds || []);
    const byId = new Map();
    const items = Array.isArray(decoded.deliveries)
        ? decoded.deliveries
        : (Array.isArray(decoded.items) ? decoded.items : []);

    function add(id, state, reason, retryAfterMs) {
        const eventId = String(id || "");
        const normalizedState = normalizeAckState(state);
        if (!expected.has(eventId) || !normalizedState) return;
        byId.set(eventId, {
            event_id: eventId,
            state: normalizedState,
            reason: reason ? String(reason).slice(0, 128) : undefined,
            retry_after_ms: Math.max(0, Number(retryAfterMs) || 0),
        });
    }
    items.forEach(function (item) {
        if (isObject(item)) add(item.event_id || item.id, item.state || item.status, item.reason, item.retry_after_ms);
    });
    [
        [decoded.acknowledged_event_ids || decoded.acknowledgedEventIds, "accepted"],
        [decoded.accepted_event_ids || decoded.acceptedEventIds, "accepted"],
        [decoded.duplicate_event_ids || decoded.duplicateEventIds, "duplicate"],
        [decoded.rejected_event_ids || decoded.rejectedEventIds, "rejected"],
        [decoded.retry_event_ids || decoded.retryEventIds, "retry"],
    ].forEach(function (pair) {
        if (Array.isArray(pair[0])) pair[0].forEach(function (id) {
            add(typeof id === "string" ? id : id && id.event_id, pair[1], id && id.reason, id && id.retry_after_ms);
        });
    });
    return {
        block: normalizeBlock(decoded.block || decoded.blocked),
        byId,
        retryAfterMs: Math.max(0, Number(decoded.retry_after_ms || decoded.retryAfterMs) || 0),
    };
}

function normalizePartitions(output, events, baseContext) {
    const source = Array.isArray(output) ? output : [];
    if (!source.length) return [];
    if (Array.isArray(source[0])) {
        return source.map(function (group) { return { events: group, context: baseContext || {} }; });
    }
    if (isObject(source[0]) && Array.isArray(source[0].events)) {
        return source.map(function (group) {
            return { events: group.events, context: Object.assign({}, baseContext || {}, group.context || {}) };
        });
    }
    return [{ events: source, context: baseContext || {} }];
}

function createHttpSink(options) {
    const settings = options || {};
    const runtime = settings.runtime || {};
    const fetchImpl = settings.fetch || runtime.fetch;
    const navigatorObject = settings.navigator || runtime.navigator || {};
    const key = String(settings.key || "http");
    const endpoint = settings.endpoint;
    const credentials = settings.credentials || "include";
    const eventIdProvider = typeof settings.eventIdProvider === "function"
        ? settings.eventIdProvider
        : function (event) { return event.event_id; };
    const partition = typeof settings.partition === "function"
        ? settings.partition
        : function (events, context) { return [{ events, context }]; };
    const encoder = typeof settings.encoder === "function"
        ? settings.encoder
        : function (events) { return { events }; };
    const ackDecoder = typeof settings.ackDecoder === "function" ? settings.ackDecoder : defaultAckDecoder;
    const retryPolicy = typeof settings.retryPolicy === "function"
        ? settings.retryPolicy
        : (typeof settings.retry === "function" ? settings.retry : defaultRetryPolicy);
    const beaconEncoder = typeof settings.beaconEncoder === "function" ? settings.beaconEncoder : null;

    function eventIds(events) {
        return unique(events.map(function (event) {
            try { return String(eventIdProvider(event) || ""); } catch (error) { return ""; }
        }));
    }

    function encodeGroup(events, context) {
        const encoded = encoder(events, context || {});
        if (isObject(encoded) && Object.prototype.hasOwnProperty.call(encoded, "body")) {
            if (encoded.body === undefined || encoded.body === null) throw new Error("encoded body is required");
            return {
                body: encoded.body,
                headers: isObject(encoded.headers) ? encoded.headers : {},
            };
        }
        const body = JSON.stringify(encoded);
        if (typeof body !== "string") throw new Error("encoded payload is required");
        return { body, headers: {} };
    }

    function failedDeliveries(ids, decision) {
        const state = decision.action === "reject" ? "rejected" : "retry";
        return ids.map(function (eventId) {
            return {
                event_id: eventId,
                state,
                reason: decision.reason,
                retry_after_ms: decision.delayMs,
            };
        });
    }

    async function send(events, sendContext) {
        const input = Array.isArray(events) ? events : [];
        const inputIds = eventIds(input);
        if (!endpoint || typeof fetchImpl !== "function" || inputIds.length !== input.length) {
            return {
                ok: false,
                retryable: true,
                status: 0,
                confirmedEventIds: [],
                deliveries: inputIds.map(function (id) { return { event_id: id, state: "retry", reason: "transport_unavailable" }; }),
            };
        }
        let groups;
        try {
            groups = normalizePartitions(partition(input, sendContext || {}), input, sendContext || {});
        } catch (error) {
            groups = [];
        }
        if (!groups.length) {
            return {
                ok: false,
                retryable: true,
                status: 0,
                confirmedEventIds: [],
                deliveries: inputIds.map(function (id) { return { event_id: id, state: "retry", reason: "partition_failed" }; }),
            };
        }

        const deliveries = new Map();
        let block = null;
        let finalStatus = 0;
        let failureStatus = 0;
        let failureSeen = false;
        for (const group of groups) {
            if (block) break;
            const ids = eventIds(group.events);
            if (!ids.length) continue;
            let encoded;
            let response;
            let payload = null;
            let requestError = null;
            try {
                encoded = encodeGroup(group.events, group.context);
                let dynamicHeaders = {};
                if (typeof settings.headersProvider === "function") {
                    try { dynamicHeaders = settings.headersProvider(group.context) || {}; } catch (error) { dynamicHeaders = {}; }
                }
                const requestOptions = {
                    method: "POST",
                    headers: Object.assign({ "Content-Type": "application/json" }, dynamicHeaders, encoded.headers),
                    credentials,
                    body: encoded.body,
                };
                if (group.context.signal) requestOptions.signal = group.context.signal;
                response = await fetchImpl.call(runtime, endpoint, requestOptions);
                finalStatus = Number(response && response.status) || 0;
                try { payload = response && typeof response.json === "function" ? await response.json() : null; } catch (error) { payload = null; }
            } catch (error) {
                requestError = error;
                finalStatus = 0;
            }

            const successful = finalStatus >= 200 && finalStatus < 300;
            if (!successful) {
                if (!failureSeen) failureStatus = finalStatus;
                failureSeen = true;
                const retryAfterMs = responseRetryAfterMs(response, payload);
                // Error responses never ACK event ids, but an authenticated
                // server may still issue an explicit device-wide block.
                let failureBlock = null;
                try {
                    const failureDecoded = normalizeDecoded(ackDecoder(payload, {
                        eventIds: ids,
                        events: group.events,
                        response,
                        status: finalStatus,
                        context: group.context,
                    }), ids);
                    failureBlock = failureDecoded.block;
                } catch (error) {
                    failureBlock = null;
                }
                if (failureBlock) {
                    block = failureBlock;
                    failedDeliveries(ids, {
                        action: "retry",
                        delayMs: retryAfterMs,
                        reason: failureBlock.reason,
                    }).forEach(function (item) { deliveries.set(item.event_id, item); });
                    continue;
                }
                let rawDecision;
                try {
                    rawDecision = retryPolicy({
                        endpoint,
                        error: requestError,
                        eventIds: ids,
                        events: group.events,
                        payload,
                        response,
                        retryAfterMs,
                        status: finalStatus,
                        context: group.context,
                    });
                } catch (error) {
                    rawDecision = null;
                }
                const decision = normalizeRetryDecision(rawDecision, retryAfterMs);
                if (decision.action === "block") block = decision.block || { reason: decision.reason, clear: true };
                failedDeliveries(ids, decision).forEach(function (item) { deliveries.set(item.event_id, item); });
                continue;
            }

            let decodedValue;
            try {
                decodedValue = ackDecoder(payload, {
                    eventIds: ids,
                    events: group.events,
                    response,
                    status: finalStatus,
                    context: group.context,
                });
            } catch (error) {
                decodedValue = { deliveries: [] };
            }
            const decoded = normalizeDecoded(decodedValue, ids);
            if (decoded.block) block = decoded.block;
            ids.forEach(function (eventId) {
                const item = decoded.byId.get(eventId) || {
                    event_id: eventId,
                    state: "retry",
                    reason: "ack_missing",
                    retry_after_ms: decoded.retryAfterMs,
                };
                deliveries.set(eventId, item);
            });
        }

        inputIds.forEach(function (eventId) {
            if (!deliveries.has(eventId)) deliveries.set(eventId, {
                event_id: eventId,
                state: "retry",
                reason: "partition_missing",
            });
        });
        const items = Array.from(deliveries.values());
        const confirmedEventIds = items.filter(function (item) {
            return TERMINAL_ACK_STATES.has(item.state);
        }).map(function (item) { return item.event_id; });
        const retryable = items.some(function (item) { return item.state === "retry"; });
        return {
            block,
            confirmedEventIds,
            deliveries: items,
            ok: !block && !retryable,
            retryable: !block && retryable,
            status: failureSeen ? failureStatus : finalStatus,
        };
    }

    function sendBeacon(events, sendContext) {
        const input = Array.isArray(events) ? events : [];
        if (!endpoint || !input.length || typeof navigatorObject.sendBeacon !== "function") return false;
        let groups;
        try { groups = normalizePartitions(partition(input, sendContext || {}), input, sendContext || {}); } catch (error) { return false; }
        if (!groups.length) return false;
        let allQueued = true;
        groups.forEach(function (group) {
            try {
                let body;
                if (beaconEncoder) body = beaconEncoder(group.events, group.context);
                else body = encodeGroup(group.events, group.context).body;
                if (body === undefined || body === null) throw new Error("beacon body is required");
                if (navigatorObject.sendBeacon(endpoint, body) !== true) allQueued = false;
            } catch (error) {
                allQueued = false;
            }
        });
        return allQueued;
    }

    return {
        accepts: typeof settings.accepts === "function" ? settings.accepts : null,
        beforeFlush: typeof settings.beforeFlush === "function" ? settings.beforeFlush : null,
        defer: typeof settings.defer === "function" ? settings.defer : null,
        key,
        send,
        sendBeacon,
    };
}

function createTrackingSink(options) {
    const settings = options || {};
    const schemaVersion = Number(settings.schemaVersion) || 1;
    const sdkVersion = settings.sdkVersion || "1.1.0";
    return createHttpSink(Object.assign({}, settings, {
        key: settings.key || "tracking",
        endpoint: settings.endpoint || "/api/cms/system/stat/tracking/batch",
        accepts: settings.accepts || function () { return true; },
        encoder: settings.encoder || function (events) {
            return {
                schema_version: schemaVersion,
                sdk_version: sdkVersion,
                events: events.map(projectTrackingEvent),
            };
        },
    }));
}

function createTrafficSink(options) {
    const settings = options || {};
    return createHttpSink(Object.assign({}, settings, {
        key: settings.key || "traffic",
        endpoint: settings.endpoint || "/api/cms/system/traffic/visits/batch",
        accepts: settings.accepts || function (event) { return event && event.event_type === "page_view"; },
        defer: settings.defer || function (event) { return event && event.event_type === "page_view"; },
        partition: settings.partition || trafficPartition,
        encoder: settings.encoder || function (events, context) {
            const projected = events.map(projectTrafficEvent);
            const contextReady = context.instance_id && context.session_id && context.surface;
            const eventsReady = projected.every(function (event) {
                return event.event_id && event.occurred_at && event.project && event.path;
            });
            if (!contextReady || !eventsReady) {
                throw new Error("traffic context and canonical event fields are required");
            }
            return compactObject({
                instance_id: context.instance_id,
                session_id: context.session_id,
                surface: context.surface,
                domain: context.domain,
                game_client: context.game_client,
                entry_source: context.entry_source,
                events: projected,
            });
        },
    }));
}

export {
    createHttpSink,
    createTrackingSink,
    createTrafficSink,
    defaultAckDecoder,
    defaultRetryPolicy,
    projectTrackingEvent,
    projectTrafficEvent,
    trafficPartition,
};
