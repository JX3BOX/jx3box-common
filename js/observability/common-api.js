// Common Axios factories remain passive until a host explicitly registers an
// observability client. Keeping this registry dependency-free lets both
// `js/api.js` and `js/observability.js` share the same opt-in switch.
let httpObserver = null;

function setHttpObserver(observer) {
    const next = observer && typeof observer.observeAxios === "function" ? observer : null;
    httpObserver = next;
    return function () {
        if (httpObserver === next) httpObserver = null;
    };
}

function installHttpObserver(target, options, serviceKey, classifyResponse) {
    const settings = options && typeof options === "object" ? options : {};
    if (settings.telemetry === false) return function () {};
    const observer = settings.observer || httpObserver;
    if (!observer || typeof observer.observeAxios !== "function") return function () {};
    try {
        return observer.observeAxios(target, {
            serviceKey,
            classifyResponse,
            resolveRoute: settings.resolveTelemetryRoute,
        });
    } catch (error) {
        // Observability must never prevent construction of a request client.
        return function () {};
    }
}

export { installHttpObserver, setHttpObserver };
