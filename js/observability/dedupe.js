import { createUuid } from "../analytics/utils.js";

const TELEMETRY_EVENT_ID = Symbol.for("jx3box.telemetry.event_id");
const telemetryObjectIds = new WeakMap();

function isObjectLike(value) {
    return (typeof value === "object" && value !== null) || typeof value === "function";
}

function normalizeEventId(value) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    return String(value).trim().slice(0, 128);
}

function getTelemetryEventId(value) {
    if (!isObjectLike(value)) return "";

    try {
        const marker = normalizeEventId(value[TELEMETRY_EVENT_ID]);
        if (marker) return marker;
    } catch (error) {
        // Proxies and host objects may reject property access. The WeakMap is
        // deliberately checked below as a side-channel fallback.
    }

    try {
        return normalizeEventId(telemetryObjectIds.get(value));
    } catch (error) {
        return "";
    }
}

function markTelemetryObject(value, eventId, runtime) {
    if (!isObjectLike(value)) return "";

    const currentId = getTelemetryEventId(value);
    const resolvedId = currentId || normalizeEventId(eventId) || createUuid(runtime);

    try {
        telemetryObjectIds.set(value, resolvedId);
    } catch (error) {
        // WeakMap failures are unusual host-object behaviour. Defining the
        // non-enumerable Symbol below can still preserve the association.
    }

    if (!currentId) {
        try {
            Object.defineProperty(value, TELEMETRY_EVENT_ID, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: resolvedId,
            });
        } catch (error) {
            // Frozen/sealed objects intentionally fall back to the WeakMap.
        }
    }

    return resolvedId;
}

function linkTelemetryObjects(values, explicitId, runtime) {
    let objects = Array.isArray(values) ? values.slice() : [values];
    let requestedId = explicitId;
    let uuidRuntime = runtime;

    // Compatibility with linkTelemetryObjects(error, response, eventId).
    if (!Array.isArray(values) && isObjectLike(explicitId)) {
        objects.push(explicitId);
        requestedId = normalizeEventId(runtime);
        uuidRuntime = requestedId ? undefined : runtime;
    }

    objects = objects.filter(isObjectLike);
    if (!objects.length) return "";

    const linkedId = objects.reduce(function (result, value) {
        return result || getTelemetryEventId(value);
    }, "") || normalizeEventId(requestedId) || createUuid(uuidRuntime);

    objects.forEach(function (value) {
        markTelemetryObject(value, linkedId, uuidRuntime);
    });
    return linkedId;
}

export { TELEMETRY_EVENT_ID, getTelemetryEventId, linkTelemetryObjects, markTelemetryObject };
