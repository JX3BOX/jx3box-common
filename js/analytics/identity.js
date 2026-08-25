import { createUuid, isUuid, safeStorage } from "./utils.js";

const INSTANCE_KEY = "jx3box:device_id";
const LEGACY_INSTANCE_KEY = "device_id";
const SESSION_KEY = "jx3box:analytics:session_id";
const SESSION_LAST_ACTIVE_KEY = "jx3box:analytics:last_active_at";
const SESSION_SEQUENCE_KEY = "jx3box:analytics:sequence_no";

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
    let sessionId = readUuid(sessionStorage, SESSION_KEY);
    let sequence = readNumber(sessionStorage, SESSION_SEQUENCE_KEY);
    let lastActiveAt = readNumber(sessionStorage, SESSION_LAST_ACTIVE_KEY);
    let sessionRotated = false;

    function resetSession() {
        sessionId = createUuid(runtime);
        sequence = 0;
        sessionRotated = true;
        writeValue(sessionStorage, SESSION_KEY, sessionId);
        writeValue(sessionStorage, SESSION_SEQUENCE_KEY, sequence);
    }

    function touch() {
        const current = now();
        if (!sessionId || !lastActiveAt || current - lastActiveAt > sessionTimeout) resetSession();
        lastActiveAt = current;
        writeValue(sessionStorage, SESSION_LAST_ACTIVE_KEY, lastActiveAt);
        return sessionId;
    }

    function nextSequence() {
        return nextEvent().sequence_no;
    }

    function nextEvent() {
        touch();
        sequence += 1;
        writeValue(sessionStorage, SESSION_SEQUENCE_KEY, sequence);
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
