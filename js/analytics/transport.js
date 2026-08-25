function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
}

function collectConfirmedIds(payload, fallbackIds) {
    if (!payload || typeof payload !== "object") return [];
    if (Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) return [];
    const result = Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
    if (!result || typeof result !== "object") return [];
    const explicitKeys = [
        "acknowledged_event_ids",
        "acknowledged",
        "accepted_event_ids",
        "accepted",
        "duplicate_event_ids",
        "duplicates",
        "rejected_event_ids",
        "rejected",
        "retry_event_ids",
    ];
    const hasExplicitResult = explicitKeys.some(function (key) {
        return Object.prototype.hasOwnProperty.call(result, key);
    });
    if (!hasExplicitResult) return [];
    const acknowledged = result.acknowledged_event_ids || result.acknowledged || [];
    const accepted = result.accepted_event_ids || result.accepted || [];
    const duplicates = result.duplicate_event_ids || result.duplicates || [];
    const rejected = result.rejected_event_ids || result.rejected || [];
    const retry = result.retry_event_ids || [];
    const batchIds = new Set(fallbackIds || []);
    const retryIds = new Set([].concat(retry).map(function (item) {
        return typeof item === "string" ? item : item && item.event_id;
    }).filter(Boolean));
    const ids = unique([].concat(acknowledged, accepted, duplicates, rejected).map(function (item) {
        return typeof item === "string" ? item : item && item.event_id;
    })).filter(function (id) {
        return batchIds.has(id) && !retryIds.has(id);
    });
    return ids;
}

function createTransport(options) {
    const settings = options || {};
    const runtime = settings.runtime || {};
    const fetchImpl = settings.fetch || runtime.fetch;
    const navigatorObject = settings.navigator || runtime.navigator || {};
    const endpoint = settings.endpoint;
    const credentials = settings.credentials || "include";
    const schemaVersion = Number(settings.schemaVersion) || 1;
    const sdkVersion = settings.sdkVersion || "1.0.0";
    const headersProvider = settings.headersProvider;

    function createEnvelope(events) {
        return {
            schema_version: schemaVersion,
            sdk_version: sdkVersion,
            events,
        };
    }

    async function send(events) {
        const ids = events.map(function (event) {
            return event.event_id;
        });
        if (!endpoint || typeof fetchImpl !== "function") {
            return { ok: false, retryable: true, status: 0, confirmedEventIds: [] };
        }

        try {
            let dynamicHeaders = {};
            if (typeof headersProvider === "function") {
                try {
                    dynamicHeaders = headersProvider() || {};
                } catch (error) {
                    dynamicHeaders = {};
                }
            }
            const response = await fetchImpl.call(runtime, endpoint, {
                method: "POST",
                headers: Object.assign({ "Content-Type": "application/json" }, dynamicHeaders),
                credentials,
                body: JSON.stringify(createEnvelope(events)),
            });
            const status = Number(response && response.status) || 0;
            if (response && response.ok) {
                let payload = null;
                try {
                    payload = typeof response.json === "function" ? await response.json() : null;
                } catch (error) {
                    payload = null;
                }
                const confirmedEventIds = collectConfirmedIds(payload, ids);
                const confirmedSet = new Set(confirmedEventIds);
                const complete = ids.every(function (id) {
                    return confirmedSet.has(id);
                });
                return { ok: complete, retryable: !complete, status, confirmedEventIds };
            }
            const retryable = status === 408 || status === 425 || status === 429 || status >= 500 || status === 0;
            return {
                ok: false,
                retryable,
                status,
                confirmedEventIds: retryable ? [] : ids,
            };
        } catch (error) {
            return { ok: false, retryable: true, status: 0, confirmedEventIds: [], error };
        }
    }

    function sendBeacon(events) {
        if (!endpoint || !events.length || typeof navigatorObject.sendBeacon !== "function") return false;
        const text = JSON.stringify(createEnvelope(events));
        try {
            // Use a plain string so cross-origin Beacon stays a simple request.
            // The server must parse the versioned JSON body explicitly.
            return navigatorObject.sendBeacon(endpoint, text) === true;
        } catch (error) {
            return false;
        }
    }

    return { createEnvelope, send, sendBeacon };
}

export { collectConfirmedIds, createTransport };
