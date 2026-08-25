import { utf8ByteLength } from "./utils.js";

function createEventQueue(options) {
    const settings = options || {};
    const storage = settings.storage;
    const transport = settings.transport;
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

    let entries = storage ? storage.load() : [];
    let timer = null;
    let sending = null;
    let destroyed = false;
    let dropped = 0;

    function persist() {
        if (storage) entries = storage.save(entries);
    }

    function schedule(delay) {
        if (destroyed || timer || !entries.length) return;
        timer = setTimer(function () {
            timer = null;
            flush();
        }, delay === undefined ? flushIntervalMs : delay);
    }

    function enqueue(event) {
        if (destroyed || !event || !event.event_id) return false;
        const exists = entries.some(function (entry) {
            return entry.event.event_id === event.event_id;
        });
        if (exists) return false;
        entries.push({ event, queued_at: now(), attempts: 0 });
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

    function removeByIds(ids) {
        const set = new Set(ids || []);
        if (!set.size) return;
        entries = entries.filter(function (entry) {
            return !set.has(entry.event.event_id);
        });
    }

    async function flush() {
        if (destroyed || sending || !entries.length) return sending || { sent: 0 };
        if (timer) {
            clearTimer(timer);
            timer = null;
        }
        const batchEntries = [];
        let batchBytes = 64;
        entries.slice(0, batchSize).forEach(function (entry) {
            const eventBytes = utf8ByteLength(JSON.stringify(entry.event)) + 1;
            if (!batchEntries.length && eventBytes > maxBatchBytes) {
                removeByIds([entry.event.event_id]);
                dropped += 1;
                onDrop("event_too_large", entry.event);
                return;
            }
            if (batchBytes + eventBytes <= maxBatchBytes) {
                batchEntries.push(entry);
                batchBytes += eventBytes;
            }
        });
        if (!batchEntries.length) {
            persist();
            if (entries.length) schedule(0);
            return { sent: 0, pending: entries.length };
        }
        const events = batchEntries.map(function (entry) {
            return entry.event;
        });

        sending = transport.send(events).then(function (result) {
            const confirmed = result.confirmedEventIds || [];
            removeByIds(confirmed);

            if (!result.ok && result.retryable) {
                const batchIds = new Set(events.map(function (event) {
                    return event.event_id;
                }));
                const exhausted = [];
                entries.forEach(function (entry) {
                    if (!batchIds.has(entry.event.event_id)) return;
                    entry.attempts = Number(entry.attempts || 0) + 1;
                    if (entry.attempts > maxRetries) exhausted.push(entry.event.event_id);
                });
                removeByIds(exhausted);
                dropped += exhausted.length;
                exhausted.forEach(function (eventId) {
                    onDrop("retry_limit", { event_id: eventId });
                });
            }

            persist();
            const firstPending = entries[0];
            if (firstPending) {
                const retryDelay = firstPending.attempts
                    ? retryBaseMs * Math.pow(2, Math.min(firstPending.attempts - 1, 6)) * (0.8 + random() * 0.4)
                    : 0;
                schedule(Math.round(retryDelay));
            }
            return { sent: confirmed.length, pending: entries.length, result };
        }).finally(function () {
            sending = null;
        });

        return sending;
    }

    function flushBeacon() {
        if (destroyed || !entries.length) return false;
        const events = [];
        let batchBytes = 64;
        entries.slice(0, batchSize).some(function (entry) {
            const eventBytes = utf8ByteLength(JSON.stringify(entry.event)) + 1;
            if (eventBytes > maxBatchBytes || batchBytes + eventBytes > maxBatchBytes) return true;
            events.push(entry.event);
            batchBytes += eventBytes;
            return false;
        });
        if (!events.length) return false;
        // Beacon has no acknowledgement. Keep the same event_ids in the queue
        // so the next fetch can obtain a confirmed, idempotent result.
        return transport.sendBeacon(events);
    }

    function destroy() {
        destroyed = true;
        if (timer) clearTimer(timer);
        timer = null;
        persist();
    }

    function getState() {
        return {
            pending: entries.length,
            dropped,
            eventIds: entries.map(function (entry) {
                return entry.event.event_id;
            }),
            entries: entries.slice(),
        };
    }

    if (entries.length) schedule();

    return { destroy, enqueue, flush, flushBeacon, getState };
}

export { createEventQueue };
