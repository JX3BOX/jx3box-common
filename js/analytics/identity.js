import { createUuid, isUuid, safeStorage } from "./utils.js";

const INSTANCE_KEY = "jx3box:device_id";
const LEGACY_INSTANCE_KEY = "device_id";
const DEFAULT_SESSION_NAMESPACE = "analytics";

function readUuid(storage, key) {
    if (!storage) return "";
    try {
        const value = storage.getItem(key);
        return isUuid(value) ? value : "";
    } catch (error) {
        return "";
    }
}

function normalizeInstanceId(value) {
    const text = String(value === undefined || value === null ? "" : value).trim();
    if (!text || text.length > 128) return "";
    return /^[a-zA-Z0-9_.:-]+$/.test(text) ? text : "";
}

function readInstanceId(storage, key) {
    if (!storage) return "";
    try {
        return normalizeInstanceId(storage.getItem(key));
    } catch (error) {
        return "";
    }
}

function readNumber(storage, key) {
    if (!storage) return 0;
    try {
        return Number(storage.getItem(key)) || 0;
    } catch (error) {
        return 0;
    }
}

function writeValue(storage, key, value) {
    if (!storage) return;
    try {
        storage.setItem(key, String(value));
    } catch (error) {
        // Storage is best effort only.
    }
}

function resolveInstanceId(runtime, explicitInstanceId) {
    const explicit = normalizeInstanceId(explicitInstanceId);
    if (explicit) return explicit;
    const localStorage = safeStorage(runtime && runtime.localStorage);
    // Heartbeat already treats any bounded historical device id as stable.
    // Reuse that value instead of splitting one browser into two instances.
    const existing = readInstanceId(localStorage, INSTANCE_KEY) || readInstanceId(localStorage, LEGACY_INSTANCE_KEY);
    if (existing) {
        writeValue(localStorage, INSTANCE_KEY, existing);
        return existing;
    }
    const generated = createUuid(runtime);
    writeValue(localStorage, INSTANCE_KEY, generated);
    return generated;
}

function createIdentity(options) {
    const settings = options || {};
    const runtime = settings.runtime || {};
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const sessionTimeout = Math.max(Number(settings.sessionTimeoutMs) || 30 * 60 * 1000, 60 * 1000);
    const sessionStorage = safeStorage(runtime.sessionStorage);
    const instanceId = resolveInstanceId(runtime, settings.instanceId);
    const rawNamespace = String(settings.sessionNamespace || DEFAULT_SESSION_NAMESPACE).trim().toLowerCase();
    const sessionNamespace = /^[a-z0-9_-]{1,32}$/.test(rawNamespace) ? rawNamespace : DEFAULT_SESSION_NAMESPACE;
    const sessionKey = "jx3box:" + sessionNamespace + ":session_id";
    const sessionLastActiveKey = "jx3box:" + sessionNamespace + ":last_active_at";
    const sessionSequenceKey = "jx3box:" + sessionNamespace + ":sequence_no";
    let sessionId = readUuid(sessionStorage, sessionKey);
    let sequence = readNumber(sessionStorage, sessionSequenceKey);
    let lastActiveAt = readNumber(sessionStorage, sessionLastActiveKey);
    let sessionRotated = false;

    // Multiple public packages can resolve the same shared installation identity
    // in one window (for example Analytics and the explicitly enabled Observer).
    // Treat sessionStorage as the source of truth before every mutation so two
    // in-memory identity handles cannot fork the session or reuse a sequence.
    function syncSession() {
        const storedSessionId = readUuid(sessionStorage, sessionKey);
        const storedSequence = readNumber(sessionStorage, sessionSequenceKey);
        const storedLastActiveAt = readNumber(sessionStorage, sessionLastActiveKey);
        if (storedSessionId && storedSessionId !== sessionId) {
            sessionId = storedSessionId;
            sequence = storedSequence;
            lastActiveAt = storedLastActiveAt;
            // Another handle (for example the explicitly enabled Observer)
            // may be the first caller after the shared session times out.
            // The Analytics owner must still observe that rotation so its next
            // business event can derive a canonical session-resume page view.
            sessionRotated = true;
            return;
        }
        if (storedSessionId) sessionId = storedSessionId;
        sequence = Math.max(sequence, storedSequence);
        lastActiveAt = Math.max(lastActiveAt, storedLastActiveAt);
    }

    function resetSession() {
        sessionId = createUuid(runtime);
        sequence = 0;
        lastActiveAt = now();
        sessionRotated = true;
        writeValue(sessionStorage, sessionKey, sessionId);
        writeValue(sessionStorage, sessionSequenceKey, sequence);
        writeValue(sessionStorage, sessionLastActiveKey, lastActiveAt);
    }

    function touch() {
        syncSession();
        const current = now();
        if (!sessionId || !lastActiveAt || current - lastActiveAt > sessionTimeout) resetSession();
        lastActiveAt = current;
        writeValue(sessionStorage, sessionLastActiveKey, lastActiveAt);
        return sessionId;
    }

    function nextSequence() {
        return nextEvent().sequence_no;
    }

    function nextEvent() {
        touch();
        // `touch()` synchronizes the persisted sequence immediately before the
        // increment. JavaScript mutations in one realm are synchronous, which
        // keeps separately constructed handles monotonic without a second ID.
        sequence += 1;
        writeValue(sessionStorage, sessionSequenceKey, sequence);
        const snapshot = {
            instance_id: instanceId,
            session_id: sessionId,
            sequence_no: sequence,
            session_rotated: sessionRotated,
        };
        sessionRotated = false;
        return snapshot;
    }

    touch();

    return {
        getInstanceId: function () {
            return instanceId;
        },
        getSessionId: function () {
            return touch();
        },
        nextEvent,
        nextSequence,
        resetSession,
    };
}

export { createIdentity, normalizeInstanceId, resolveInstanceId };
