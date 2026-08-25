const NATIVE_FETCH_ADAPTER = Symbol.for("jx3box.observability.native_fetch_adapter");

function assertRequestCallback(request) {
    if (typeof request !== "function") throw new TypeError("native request adapter requires a callback");
    return request;
}

function markNativeFetchAdapter(fetchAdapter) {
    const adapter = assertRequestCallback(fetchAdapter);
    try {
        Object.defineProperty(adapter, NATIVE_FETCH_ADAPTER, {
            configurable: false,
            enumerable: false,
            writable: false,
            value: true,
        });
    } catch (error) {
        // Frozen wrappers can still opt into `transportMode: "native"` at
        // createClientObserver/createObservabilityTransport.
    }
    return adapter;
}

function isNativeFetchAdapter(value) {
    if (typeof value !== "function") return false;
    try {
        return value[NATIVE_FETCH_ADAPTER] === true;
    } catch (error) {
        return false;
    }
}

function parseJson(value) {
    if (typeof value !== "string") return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return value;
    }
}

function parseRequestBody(value) {
    if (value === undefined || value === null || value === "") return undefined;
    return parseJson(value);
}

async function normalizeNativeResponse(response) {
    const raw = parseJson(response);
    const status = Number(raw && (raw.status || raw.statusCode || raw.responseCode)) || 0;
    let data;

    if (raw && Object.prototype.hasOwnProperty.call(raw, "data")) data = parseJson(raw.data);
    else if (raw && Object.prototype.hasOwnProperty.call(raw, "body")) data = parseJson(raw.body);
    else if (raw && typeof raw.json === "function") data = await raw.json();
    else data = raw;

    const ok = raw && typeof raw.ok === "boolean" ? raw.ok : status >= 200 && status < 300;
    return {
        ok,
        status,
        headers: raw && raw.headers ? raw.headers : {},
        async json() {
            return data;
        },
        async text() {
            return typeof data === "string" ? data : JSON.stringify(data === undefined ? null : data);
        },
    };
}

function createNativeFetchAdapter(request) {
    const requestCallback = assertRequestCallback(request);
    async function nativeFetch(url, options) {
        const settings = options || {};
        const response = await requestCallback({
            url: String(url || ""),
            method: String(settings.method || "GET").toUpperCase(),
            headers: Object.assign({}, settings.headers || {}),
            body: settings.body,
        });
        return normalizeNativeResponse(response);
    }
    return markNativeFetchAdapter(nativeFetch);
}

function createDataTransportAdapter(request) {
    const requestCallback = assertRequestCallback(request);
    return createNativeFetchAdapter(function (options) {
        return requestCallback({
            url: options.url,
            method: options.method,
            headers: options.headers,
            data: parseRequestBody(options.body),
        });
    });
}

function createCapacitorTransportAdapter(request) {
    return createDataTransportAdapter(request);
}

function createHarmonyTransportAdapter(request) {
    return createDataTransportAdapter(request);
}

export {
    NATIVE_FETCH_ADAPTER,
    createCapacitorTransportAdapter,
    createHarmonyTransportAdapter,
    createNativeFetchAdapter,
    isNativeFetchAdapter,
    markNativeFetchAdapter,
};
