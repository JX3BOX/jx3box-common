import { safeStorage, utf8ByteLength } from "./utils.js";

const STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 1;

function createQueueStorage(options) {
    const settings = options || {};
    const storage = safeStorage(settings.storage);
    const key = settings.key || "jx3box:analytics:queue:v1";
    const maxEvents = Math.max(1, Number(settings.maxEvents) || 200);
    const maxBytes = Math.max(1024, Number(settings.maxBytes) || 256 * 1024);
    const ttlMs = Math.max(60 * 1000, Number(settings.ttlMs) || 7 * 24 * 60 * 60 * 1000);
    const now = typeof settings.now === "function" ? settings.now : Date.now;

    function normalize(entries) {
        const oldest = now() - ttlMs;
        return (Array.isArray(entries) ? entries : []).filter(function (entry) {
            return entry && entry.event && entry.event.event_id && Number(entry.queued_at) >= oldest;
        }).slice(-maxEvents);
    }

    function load() {
        if (!storage) return [];
        try {
            const parsed = JSON.parse(storage.getItem(key) || "null");
            if (!parsed || (parsed.version !== STORAGE_VERSION && parsed.version !== LEGACY_STORAGE_VERSION)) return [];
            return normalize(parsed.entries);
        } catch (error) {
            return [];
        }
    }

    function save(inputEntries) {
        let entries = normalize(inputEntries);
        // Persistence is best effort. Keep the in-memory queue alive when
        // localStorage is unavailable (private mode, policy or quota errors).
        if (!storage) return entries;
        try {
            let body = JSON.stringify({ version: STORAGE_VERSION, saved_at: now(), entries });
            while (entries.length > 1 && utf8ByteLength(body) > maxBytes) {
                entries.shift();
                body = JSON.stringify({ version: STORAGE_VERSION, saved_at: now(), entries });
            }
            if (utf8ByteLength(body) <= maxBytes) storage.setItem(key, body);
            return entries;
        } catch (error) {
            return entries;
        }
    }

    function clear() {
        if (!storage) return;
        try {
            storage.removeItem(key);
        } catch (error) {
            // Storage is best effort only.
        }
    }

    return { clear, load, save };
}

export { createQueueStorage };
