const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let fallbackCounter = 0;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function toFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function createUuid(env) {
    const runtime = env || (typeof globalThis !== "undefined" ? globalThis : {});
    const crypto = runtime.crypto;
    const bytes = new Uint8Array(16);

    if (crypto && typeof crypto.getRandomValues === "function") {
        crypto.getRandomValues(bytes);
    } else {
        const now = Date.now();
        fallbackCounter = (fallbackCounter + 1) % 0xffffff;
        for (let index = 0; index < bytes.length; index += 1) {
            const timeByte = (now >> ((index % 6) * 8)) & 0xff;
            const randomByte = Math.floor(Math.random() * 256);
            const counterByte = (fallbackCounter >> ((index % 3) * 8)) & 0xff;
            bytes[index] = timeByte ^ randomByte ^ counterByte;
        }
    }

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.prototype.map.call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
    }).join("");

    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}

function isUuid(value) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function hashString(value) {
    const input = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function stableSampleScore(instanceId, salt) {
    return hashString(String(instanceId || "") + ":" + String(salt || "jx3box-analytics-v1")) / 4294967296;
}

function normalizeSampleRate(rate) {
    const numeric = toFiniteNumber(rate, 1);
    if (numeric > 1) return clamp(numeric / 10000, 0, 1);
    return clamp(numeric, 0, 1);
}

function shouldSample(instanceId, rate, salt) {
    return stableSampleScore(instanceId, salt) < normalizeSampleRate(rate);
}

function safeStorage(storage) {
    if (!storage) return null;
    try {
        const key = "__jx3box_analytics_probe__";
        storage.setItem(key, "1");
        storage.removeItem(key);
        return storage;
    } catch (error) {
        return null;
    }
}

function getRuntime(options) {
    if (options && options.runtime) return options.runtime;
    if (typeof window !== "undefined") return window;
    return typeof globalThis !== "undefined" ? globalThis : {};
}

function getDocument(runtime) {
    return runtime && runtime.document ? runtime.document : null;
}

function nowIso(now) {
    const value = typeof now === "function" ? now() : Date.now();
    return new Date(value).toISOString();
}

function timezoneOffset(now) {
    const value = typeof now === "function" ? now() : Date.now();
    return new Date(value).getTimezoneOffset();
}

function compactObject(input) {
    const output = {};
    Object.keys(input || {}).forEach(function (key) {
        const value = input[key];
        if (value !== undefined && value !== null && value !== "") output[key] = value;
    });
    return output;
}

function utf8ByteLength(value) {
    const text = String(value || "");
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length) {
            const next = text.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                index += 1;
            } else bytes += 3;
        } else bytes += 3;
    }
    return bytes;
}

export {
    clamp,
    compactObject,
    createUuid,
    getDocument,
    getRuntime,
    hashString,
    isUuid,
    normalizeSampleRate,
    nowIso,
    safeStorage,
    shouldSample,
    stableSampleScore,
    timezoneOffset,
    toFiniteNumber,
    utf8ByteLength,
};
