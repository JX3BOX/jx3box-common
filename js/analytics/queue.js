import { utf8ByteLength } from "./utils.js";

const DELIVERY_STATES = Object.freeze({
    PENDING: "pending",
    DEFERRED: "deferred",
    ACCEPTED: "accepted",
    DUPLICATE: "duplicate",
    REJECTED: "rejected",
    RETRY: "retry",
});

const ACTIVE_STATES = new Set([
    DELIVERY_STATES.PENDING,
    DELIVERY_STATES.DEFERRED,
    DELIVERY_STATES.RETRY,
]);
const TERMINAL_STATES = new Set([
    DELIVERY_STATES.ACCEPTED,
    DELIVERY_STATES.DUPLICATE,
    DELIVERY_STATES.REJECTED,
]);

function isObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeSink(input, fallbackKey) {
    if (!input || typeof input.send !== "function") return null;
    const key = String(input.key || fallbackKey || "").trim();
    if (!key) return null;
    return {
        accepts: typeof input.accepts === "function" ? input.accepts : null,
        beforeFlush: typeof input.beforeFlush === "function" ? input.beforeFlush : null,
        defer: typeof input.defer === "function" ? input.defer : null,
        key,
        raw: input,
        send: input.send.bind(input),
        sendBeacon: typeof input.sendBeacon === "function" ? input.sendBeacon.bind(input) : function () { return false; },
    };
}

function normalizeSinks(settings) {
    const output = [];
    const seen = new Set();
    let input = settings.sinks;
    if (input && !Array.isArray(input) && typeof input.forEach === "function") {
        const values = [];
        input.forEach(function (sink) { values.push(sink); });
        input = values;
    }
    (Array.isArray(input) ? input : []).forEach(function (sink, index) {
        const normalized = normalizeSink(sink, "sink-" + String(index + 1));
        if (!normalized || seen.has(normalized.key)) return;
        seen.add(normalized.key);
        output.push(normalized);
    });
    if (!output.length && settings.transport) {
        const legacy = normalizeSink(settings.transport, settings.legacySinkKey || "tracking");
        if (legacy) output.push(legacy);
    }
    return output;
}

function normalizeDelivery(input) {
    const delivery = isObject(input) ? input : {};
    let state = String(delivery.state || "").toLowerCase();
    if (!ACTIVE_STATES.has(state) && !TERMINAL_STATES.has(state)) state = DELIVERY_STATES.PENDING;
    const normalized = {
        attempts: Math.max(0, Number(delivery.attempts) || 0),
        state,
    };
    if (Number(delivery.retry_at) > 0) normalized.retry_at = Number(delivery.retry_at);
    if (isObject(delivery.patch)) normalized.patch = Object.assign({}, delivery.patch);
    if (delivery.reason) normalized.reason = String(delivery.reason).slice(0, 128);
    if (Number(delivery.updated_at) > 0) normalized.updated_at = Number(delivery.updated_at);
    return normalized;
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

function createAbortController(runtime) {
    const source = runtime || {};
    const AbortControllerConstructor = source.AbortController
        || (typeof AbortController === "function" ? AbortController : null);
    if (!AbortControllerConstructor) return { abort: function () {}, signal: undefined };
    try {
        return new AbortControllerConstructor();
    } catch (error) {
        return { abort: function () {}, signal: undefined };
    }
}

function normalizedResultItems(result, eventIds) {
    const raw = result || {};
    const expected = new Set(eventIds || []);
    const byId = new Map();

    function add(id, state, reason, retryAfterMs) {
        const eventId = typeof id === "string" ? id : String(id || "");
        if (!expected.has(eventId)) return;
        const normalizedState = String(state || "").toLowerCase();
        if (!ACTIVE_STATES.has(normalizedState) && !TERMINAL_STATES.has(normalizedState)) return;
        const current = byId.get(eventId);
        if (current && TERMINAL_STATES.has(current.state) && !TERMINAL_STATES.has(normalizedState)) return;
        byId.set(eventId, {
            event_id: eventId,
            reason: reason ? String(reason).slice(0, 128) : undefined,
            retry_after_ms: Math.max(0, Number(retryAfterMs) || 0),
            state: normalizedState === DELIVERY_STATES.DEFERRED ? DELIVERY_STATES.RETRY : normalizedState,
        });
    }

    const explicitItems = Array.isArray(raw.deliveries)
        ? raw.deliveries
        : (Array.isArray(raw.items) ? raw.items : []);
    explicitItems.forEach(function (item) {
        if (!item || typeof item !== "object") return;
        add(item.event_id || item.id, item.state || item.status, item.reason, item.retry_after_ms);
    });

    const groups = [
        [raw.acceptedEventIds || raw.accepted_event_ids, DELIVERY_STATES.ACCEPTED],
        [raw.duplicateEventIds || raw.duplicate_event_ids, DELIVERY_STATES.DUPLICATE],
        [raw.rejectedEventIds || raw.rejected_event_ids, DELIVERY_STATES.REJECTED],
        [raw.retryEventIds || raw.retry_event_ids, DELIVERY_STATES.RETRY],
    ];
    groups.forEach(function (pair) {
        if (!Array.isArray(pair[0])) return;
        pair[0].forEach(function (item) {
            add(typeof item === "string" ? item : item && item.event_id, pair[1], item && item.reason, item && item.retry_after_ms);
        });
    });

    // Compatibility for the 9.3/9.4 transport. Its confirmation parser only
    // returns ids explicitly acknowledged by the server.
    if (Array.isArray(raw.confirmedEventIds)) {
        raw.confirmedEventIds.forEach(function (eventId) {
            if (!byId.has(eventId)) add(eventId, DELIVERY_STATES.ACCEPTED);
        });
    }

    eventIds.forEach(function (eventId) {
        if (!byId.has(eventId)) add(eventId, DELIVERY_STATES.RETRY, raw.reason, raw.retryAfterMs || raw.retry_after_ms);
    });
    return Array.from(byId.values());
}

function createEventQueue(options) {
    const settings = options || {};
    const storage = settings.storage;
    const sinks = normalizeSinks(settings);
    const sinkByKey = new Map(sinks.map(function (sink) { return [sink.key, sink]; }));
    const legacySinkKey = settings.legacySinkKey
        || (sinkByKey.has("tracking") ? "tracking" : (sinks[0] && sinks[0].key));
    const batchSize = Math.max(1, Math.min(Number(settings.batchSize) || 20, 50));
    const maxEvents = Math.max(batchSize, Number(settings.maxEvents) || 200);
    const maxBatchBytes = Math.max(4096, Number(settings.maxBatchBytes) || 60 * 1024);
    const flushIntervalMs = Math.max(1000, Number(settings.flushIntervalMs) || 10000);
    const maxRetries = settings.maxRetries === undefined ? 5 : Math.max(0, Number(settings.maxRetries) || 0);
    const retryBaseMs = Math.max(100, Number(settings.retryBaseMs) || 1000);
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const random = typeof settings.random === "function" ? settings.random : Math.random;
    const setTimer = settings.setTimeout || setTimeout;
    const clearTimer = settings.clearTimeout || clearTimeout;
    const onDrop = typeof settings.onDrop === "function" ? settings.onDrop : function () {};
    const beforeFlush = typeof settings.beforeFlush === "function" ? settings.beforeFlush : null;
    const runtime = settings.runtime || {};

    let timer = null;
    let sending = null;
    let destroyed = false;
    let dropped = 0;
    let blocked = false;
    let blockReason = null;
    let generation = 0;
    const inflight = new Set();
    let beaconAuthorizationRevision = 0;
    let globalBeaconAuthorization = null;
    const sinkBeaconAuthorizations = new Map();

    function revokeBeaconAuthorizations() {
        globalBeaconAuthorization = null;
        sinkBeaconAuthorizations.clear();
    }

    function markBeaconPayloadChanged() {
        beaconAuthorizationRevision += 1;
        revokeBeaconAuthorizations();
    }

    function createBeaconAuthorization() {
        return { generation, revision: beaconAuthorizationRevision };
    }

    function hasCurrentBeaconAuthorization(authorization) {
        return !!authorization
            && authorization.generation === generation
            && authorization.revision === beaconAuthorizationRevision;
    }

    function normalizeEntry(input) {
        if (!input || !input.event || !input.event.event_id) return null;
        const deliveries = {};
        if (isObject(input.deliveries)) {
            Object.keys(input.deliveries).forEach(function (key) {
                if (sinkByKey.has(key)) deliveries[key] = normalizeDelivery(input.deliveries[key]);
            });
        }
        // Pre-9.5 analytics entries have no delivery map. They migrate to the
        // tracking sink only and are never replayed into traffic.
        if (!Object.keys(deliveries).length && legacySinkKey && sinkByKey.has(legacySinkKey)) {
            deliveries[legacySinkKey] = normalizeDelivery({
                attempts: input.attempts,
                state: DELIVERY_STATES.PENDING,
            });
        }
        if (!Object.keys(deliveries).length) return null;
        return { deliveries, event: input.event, queued_at: Number(input.queued_at) || now() };
    }

    let entries = (storage ? storage.load() : []).map(normalizeEntry).filter(Boolean);

    function hasActiveDelivery(entry) {
        return Object.keys(entry.deliveries).some(function (key) {
            return ACTIVE_STATES.has(entry.deliveries[key].state);
        });
    }

    function hasReadyDelivery(entry, timestamp) {
        return Object.keys(entry.deliveries).some(function (key) {
            const delivery = entry.deliveries[key];
            return delivery.state !== DELIVERY_STATES.DEFERRED
                && ACTIVE_STATES.has(delivery.state)
                && (!delivery.retry_at || delivery.retry_at <= timestamp);
        });
    }

    function persist() {
        if (storage) entries = storage.save(entries);
    }

    if (entries.some(function (entry) { return !hasActiveDelivery(entry); })) {
        entries = entries.filter(hasActiveDelivery);
        persist();
    }

    function removeCompleted() {
        entries = entries.filter(hasActiveDelivery);
    }

    function nextReadyDelay() {
        const timestamp = now();
        let next = null;
        entries.forEach(function (entry) {
            Object.keys(entry.deliveries).forEach(function (key) {
                const delivery = entry.deliveries[key];
                if (delivery.state === DELIVERY_STATES.DEFERRED || !ACTIVE_STATES.has(delivery.state)) return;
                const delay = Math.max(0, Number(delivery.retry_at || timestamp) - timestamp);
                if (next === null || delay < next) next = delay;
            });
        });
        return next;
    }

    function schedule(delay) {
        if (destroyed || blocked || timer || !entries.length) return;
        const readyDelay = nextReadyDelay();
        if (readyDelay === null) return;
        const requested = delay === undefined ? flushIntervalMs : Math.max(0, Number(delay) || 0);
        timer = setTimer(function () {
            timer = null;
            flush({ reason: "timer", respectRetryAt: true });
        }, Math.max(requested, readyDelay));
    }

    function sinkKeysForEvent(event, enqueueOptions) {
        const explicit = Array.isArray(enqueueOptions.sinkKeys) ? enqueueOptions.sinkKeys : null;
        const source = explicit || sinks.map(function (sink) { return sink.key; });
        const result = [];
        let rejectedExplicitSink = false;
        source.forEach(function (key) {
            const sink = sinkByKey.get(String(key));
            if (!sink) {
                if (explicit) rejectedExplicitSink = true;
                return;
            }
            if (result.indexOf(sink.key) >= 0) return;
            if (sink.accepts) {
                try {
                    if (sink.accepts(event, enqueueOptions) !== true) {
                        if (explicit) rejectedExplicitSink = true;
                        return;
                    }
                } catch (error) {
                    if (explicit) rejectedExplicitSink = true;
                    return;
                }
            }
            result.push(sink.key);
        });
        // A canonical event with an explicit sink contract is all-or-nothing.
        // Silently dropping one requested delivery would corrupt Traffic path
        // predecessors while making the Tracking half appear successful.
        return explicit && rejectedExplicitSink ? [] : result;
    }

    function enqueue(event, optionsForEvent) {
        const enqueueOptions = optionsForEvent || {};
        if (destroyed || blocked || !event || !event.event_id) return false;
        if (entries.some(function (entry) { return entry.event.event_id === event.event_id; })) return false;
        const keys = sinkKeysForEvent(event, enqueueOptions);
        if (!keys.length) return false;
        const explicitlyDeferred = new Set(Array.isArray(enqueueOptions.deferredSinkKeys)
            ? enqueueOptions.deferredSinkKeys.map(String)
            : []);
        const deliveries = {};
        keys.forEach(function (key) {
            const sink = sinkByKey.get(key);
            let deferred = explicitlyDeferred.has(key);
            if (!deferred && sink && sink.defer) {
                try { deferred = sink.defer(event, enqueueOptions) === true; } catch (error) { deferred = true; }
            }
            deliveries[key] = { attempts: 0, state: deferred ? DELIVERY_STATES.DEFERRED : DELIVERY_STATES.PENDING };
        });
        entries.push({ event, queued_at: now(), deliveries });
        markBeaconPayloadChanged();
        while (entries.length > maxEvents) {
            const removed = entries.shift();
            dropped += 1;
            onDrop("queue_limit", removed && removed.event);
        }
        persist();
        if (entries.length >= batchSize) schedule(0);
        else schedule();
        return true;
    }

    function finalize(eventId, sinkKey, patch) {
        const normalizedKey = String(sinkKey || "");
        if (destroyed || blocked || !sinkByKey.has(normalizedKey)) return false;
        const entry = entries.find(function (item) { return item.event.event_id === eventId; });
        if (!entry || !entry.deliveries[normalizedKey]) return false;
        const delivery = entry.deliveries[normalizedKey];
        if (TERMINAL_STATES.has(delivery.state)) return false;
        delivery.patch = Object.assign({}, delivery.patch || {}, isObject(patch) ? patch : {});
        delivery.state = DELIVERY_STATES.PENDING;
        delivery.retry_at = 0;
        delivery.updated_at = now();
        markBeaconPayloadChanged();
        persist();
        schedule(0);
        return true;
    }

    function projectedEvent(entry, sinkKey) {
        const delivery = entry.deliveries[sinkKey];
        const projected = Object.assign({}, entry.event, delivery && delivery.patch ? delivery.patch : {});
        projected.event_id = entry.event.event_id;
        return projected;
    }

    function selectBatch(sinkKey, respectRetryAt, rejectOversized) {
        const selected = [];
        let bytes = 64;
        const timestamp = now();
        for (let index = 0; index < entries.length && selected.length < batchSize; index += 1) {
            const entry = entries[index];
            const delivery = entry.deliveries[sinkKey];
            if (!delivery || delivery.state === DELIVERY_STATES.DEFERRED || !ACTIVE_STATES.has(delivery.state)) continue;
            if (respectRetryAt && delivery.retry_at && delivery.retry_at > timestamp) continue;
            const event = projectedEvent(entry, sinkKey);
            const eventBytes = utf8ByteLength(JSON.stringify(event)) + 1;
            if (eventBytes > maxBatchBytes) {
                if (rejectOversized === false) break;
                delivery.state = DELIVERY_STATES.REJECTED;
                delivery.reason = "event_too_large";
                delivery.updated_at = timestamp;
                dropped += 1;
                onDrop("event_too_large", { event_id: event.event_id, sink_key: sinkKey });
                continue;
            }
            if (bytes + eventBytes > maxBatchBytes) break;
            selected.push({ delivery, entry, event });
            bytes += eventBytes;
        }
        return selected;
    }

    function cancelInflight(reason) {
        generation += 1;
        revokeBeaconAuthorizations();
        // Release the single-flight gate immediately. Some host/native fetch
        // adapters ignore AbortSignal; their stale promise is isolated by the
        // generation check and must not prevent a fresh retry from starting.
        sending = null;
        let cancelled = 0;
        inflight.forEach(function (controller) {
            cancelled += 1;
            try { controller.abort(reason); } catch (error) { controller.abort(); }
        });
        inflight.clear();
        return cancelled;
    }

    function clearInternal(reason, predicate, cancel) {
        if (cancel !== false) cancelInflight(reason || "queue_clear");
        if (timer) clearTimer(timer);
        timer = null;
        const matcher = typeof predicate === "function" ? predicate : function () { return true; };
        const kept = [];
        let cleared = 0;
        entries.forEach(function (entry) {
            let remove = false;
            try { remove = matcher(entry.event, entry) === true; } catch (error) { remove = false; }
            if (!remove) return kept.push(entry);
            cleared += 1;
            onDrop(reason || "queue_clear", entry.event);
        });
        entries = kept;
        if (!entries.length && storage && typeof storage.clear === "function") storage.clear();
        else persist();
        if (entries.length) schedule();
        return cleared;
    }

    function clear(reason, predicate) {
        return clearInternal(reason, predicate, true);
    }

    function block(reason, optionsForBlock) {
        const blockOptions = optionsForBlock || {};
        blocked = true;
        blockReason = normalizeBlock(reason) || { reason: "blocked", clear: true };
        // block({ cancelInflight: false }) must still revoke a previously
        // successful guard before a later unblock can permit Beacon again.
        revokeBeaconAuthorizations();
        if (blockOptions.cancelInflight !== false) cancelInflight(blockReason.reason);
        if (timer) clearTimer(timer);
        timer = null;
        const shouldClear = blockOptions.clear === undefined ? blockReason.clear !== false : blockOptions.clear !== false;
        if (shouldClear) clearInternal(blockReason.reason, null, false);
        else persist();
        return getState();
    }

    function unblock() {
        if (destroyed) return false;
        if (!blocked) return true;
        blocked = false;
        blockReason = null;
        generation += 1;
        revokeBeaconAuthorizations();
        schedule(0);
        return true;
    }

    async function evaluateBeforeFlush(hook, context) {
        if (!hook) return { allow: true };
        try {
            const result = await hook(context);
            if (result === false) return { allow: false };
            if (!isObject(result)) return { allow: true };
            const structuredBlock = normalizeBlock(result.block || result.blocked);
            if (structuredBlock) {
                block(structuredBlock, {
                    cancelInflight: result.cancelInflight !== false,
                    clear: result.clear === undefined ? structuredBlock.clear : result.clear,
                });
                return { allow: false, block: structuredBlock };
            }
            return { allow: result.allow !== false };
        } catch (error) {
            // Guards and remote config fail closed. Events remain local.
            return { allow: false, error };
        }
    }

    function retryDelay(delivery, retryAfterMs) {
        if (Number(retryAfterMs) > 0) return Number(retryAfterMs);
        return retryBaseMs
            * Math.pow(2, Math.min(Math.max(0, delivery.attempts - 1), 6))
            * (0.8 + random() * 0.4);
    }

    function applySinkResult(sinkKey, selected, rawResult) {
        const ids = selected.map(function (item) { return item.event.event_id; });
        const result = rawResult || { ok: false, retryable: true, confirmedEventIds: [] };
        const blockValue = normalizeBlock(result.block || result.blocked);
        if (blockValue) {
            block(blockValue, { clear: blockValue.clear !== false, cancelInflight: true });
            return { sent: 0, blocked: blockValue };
        }
        let sent = 0;
        normalizedResultItems(result, ids).forEach(function (item) {
            const selectedItem = selected.find(function (candidate) { return candidate.event.event_id === item.event_id; });
            if (!selectedItem) return;
            const delivery = selectedItem.delivery;
            if (TERMINAL_STATES.has(item.state)) {
                delivery.state = item.state;
                delivery.reason = item.reason;
                delivery.retry_at = 0;
                delivery.updated_at = now();
                sent += 1;
                return;
            }
            delivery.attempts = Math.max(0, Number(delivery.attempts) || 0) + 1;
            if (delivery.attempts > maxRetries) {
                delivery.state = DELIVERY_STATES.REJECTED;
                delivery.reason = "retry_limit";
                delivery.retry_at = 0;
                delivery.updated_at = now();
                dropped += 1;
                onDrop("retry_limit", { event_id: item.event_id, sink_key: sinkKey });
                return;
            }
            delivery.state = DELIVERY_STATES.RETRY;
            delivery.reason = item.reason;
            delivery.retry_at = now() + Math.round(retryDelay(delivery, item.retry_after_ms));
            delivery.updated_at = now();
        });
        return { sent };
    }

    async function runFlush(flushOptions) {
        const reason = flushOptions.reason || "manual";
        const flushGeneration = generation;
        let globalGuard = { allow: true };
        if (beforeFlush) {
            // Beacon is synchronous and cannot await a remote/config guard.
            // Revoke the previous grant before starting a new evaluation so a
            // concurrent pagehide cannot reuse stale authorization.
            revokeBeaconAuthorizations();
            const guardRevision = beaconAuthorizationRevision;
            globalGuard = await evaluateBeforeFlush(beforeFlush, { getState, reason, sinkKey: null });
            if (globalGuard.allow
                && !blocked
                && !destroyed
                && flushGeneration === generation
                && guardRevision === beaconAuthorizationRevision) {
                globalBeaconAuthorization = createBeaconAuthorization();
            }
        }
        if (!globalGuard.allow || blocked || destroyed || flushGeneration !== generation) {
            if (!blocked && !destroyed && flushGeneration === generation) schedule(flushIntervalMs);
            return { sent: 0, pending: getState().pending, blocked, blockReason };
        }
        const allowedSinkKeys = Array.isArray(flushOptions.sinkKeys)
            ? new Set(flushOptions.sinkKeys.map(String))
            : null;
        let sent = 0;
        let firstResult = null;
        let guardDeferred = false;
        const sinkResults = {};

        for (const sink of sinks) {
            if (destroyed || blocked || flushGeneration !== generation) break;
            if (allowedSinkKeys && !allowedSinkKeys.has(sink.key)) continue;
            const selected = selectBatch(sink.key, flushOptions.respectRetryAt === true, true);
            if (!selected.length) continue;
            let sinkGuard = { allow: true };
            if (sink.beforeFlush) {
                sinkBeaconAuthorizations.delete(sink.key);
                const guardRevision = beaconAuthorizationRevision;
                sinkGuard = await evaluateBeforeFlush(sink.beforeFlush, {
                    events: selected.map(function (item) { return item.event; }),
                    getState,
                    reason,
                    sink: sink.raw,
                    sinkKey: sink.key,
                });
                if (sinkGuard.allow
                    && !blocked
                    && !destroyed
                    && flushGeneration === generation
                    && guardRevision === beaconAuthorizationRevision) {
                    sinkBeaconAuthorizations.set(sink.key, createBeaconAuthorization());
                }
            }
            if (!sinkGuard.allow || blocked || destroyed || flushGeneration !== generation) {
                guardDeferred = guardDeferred || (!blocked && !destroyed && flushGeneration === generation);
                continue;
            }

            const controller = createAbortController(runtime);
            inflight.add(controller);
            let rawResult;
            try {
                rawResult = await sink.send(selected.map(function (item) { return item.event; }), {
                    reason,
                    signal: controller.signal,
                    sinkKey: sink.key,
                });
            } catch (error) {
                rawResult = { ok: false, retryable: true, status: 0, confirmedEventIds: [], error };
            } finally {
                inflight.delete(controller);
            }
            if (flushGeneration !== generation || destroyed || blocked) break;
            if (!firstResult) firstResult = rawResult;
            sinkResults[sink.key] = rawResult;
            sent += applySinkResult(sink.key, selected, rawResult).sent;
        }

        removeCompleted();
        persist();
        const retryDelayValue = nextReadyDelay();
        if (retryDelayValue !== null) schedule(guardDeferred ? flushIntervalMs : retryDelayValue);
        return { sent, pending: getState().pending, result: firstResult, sinkResults };
    }

    function flush(optionsForFlush) {
        const flushOptions = optionsForFlush || {};
        const hasDeliverable = entries.some(function (entry) {
            if (flushOptions.respectRetryAt === true) return hasReadyDelivery(entry, now());
            return Object.keys(entry.deliveries).some(function (key) {
                const state = entry.deliveries[key].state;
                return state !== DELIVERY_STATES.DEFERRED && ACTIVE_STATES.has(state);
            });
        });
        if (destroyed || blocked || !hasDeliverable) {
            return Promise.resolve({ sent: 0, pending: getState().pending, blocked, blockReason });
        }
        if (sending) return sending;
        if (timer) {
            clearTimer(timer);
            timer = null;
        }
        const currentSending = runFlush(flushOptions).finally(function () {
            if (sending === currentSending) sending = null;
        });
        sending = currentSending;
        return currentSending;
    }

    function flushBeacon(optionsForFlush) {
        if (destroyed || blocked || !entries.length) return false;
        if (beforeFlush && !hasCurrentBeaconAuthorization(globalBeaconAuthorization)) return false;
        const flushOptions = optionsForFlush || {};
        const reason = flushOptions.reason || "pagehide";
        const allowedSinkKeys = Array.isArray(flushOptions.sinkKeys)
            ? new Set(flushOptions.sinkKeys.map(String))
            : null;
        let attempted = false;
        let success = true;
        sinks.forEach(function (sink) {
            if (allowedSinkKeys && !allowedSinkKeys.has(sink.key)) return;
            const selected = selectBatch(sink.key, false, false);
            if (!selected.length) return;
            attempted = true;
            if (sink.beforeFlush && !hasCurrentBeaconAuthorization(sinkBeaconAuthorizations.get(sink.key))) {
                success = false;
                return;
            }
            try {
                if (sink.sendBeacon(selected.map(function (item) { return item.event; }), {
                    reason,
                    sinkKey: sink.key,
                }) !== true) success = false;
            } catch (error) {
                success = false;
            }
        });
        // Beacon never changes delivery state.
        return attempted && success;
    }

    function destroy() {
        destroyed = true;
        cancelInflight("destroy");
        if (timer) clearTimer(timer);
        timer = null;
        persist();
    }

    function getState() {
        let pendingDeliveries = 0;
        entries.forEach(function (entry) {
            Object.keys(entry.deliveries).forEach(function (key) {
                if (ACTIVE_STATES.has(entry.deliveries[key].state)) pendingDeliveries += 1;
            });
        });
        return {
            blocked,
            blockReason,
            dropped,
            entries: entries.map(function (entry) {
                return Object.assign({}, entry, {
                    deliveries: Object.keys(entry.deliveries).reduce(function (result, key) {
                        result[key] = Object.assign({}, entry.deliveries[key]);
                        return result;
                    }, {}),
                });
            }),
            eventIds: entries.map(function (entry) { return entry.event.event_id; }),
            pending: entries.filter(hasActiveDelivery).length,
            pendingDeliveries,
        };
    }

    if (entries.length) schedule();

    return {
        block,
        cancelInflight,
        clear,
        destroy,
        enqueue,
        finalize,
        finalizeDelivery: finalize,
        flush,
        flushBeacon,
        getState,
        unblock,
    };
}

export { DELIVERY_STATES, createEventQueue };
