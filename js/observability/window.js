import { getTelemetryEventId } from "./dedupe.js";

function createPrimitiveRejection() {
    return {
        name: "UnhandledRejection",
        message: "Unhandled promise rejection",
    };
}

function createResourceError() {
    return {
        name: "ResourceError",
        message: "Resource failed to load",
    };
}

function safeRead(value, key) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    try {
        return value[key];
    } catch (error) {
        return undefined;
    }
}

function isObjectLike(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
}

function isMarked(value) {
    return isObjectLike(value) && Boolean(getTelemetryEventId(value));
}

function capture(observer, error, context) {
    if (!observer || typeof observer.captureError !== "function") return;
    try {
        const result = observer.captureError(error, context);
        if (result && typeof result.catch === "function") result.catch(function () {});
    } catch (captureError) {
        // Telemetry must never change host error handling.
    }
}

function installWindowErrorObserver(observer, options) {
    const value = options || {};
    const runtime = value.runtime
        || (typeof window !== "undefined" ? window : null);
    if (!runtime || typeof runtime.addEventListener !== "function" || typeof runtime.removeEventListener !== "function") {
        return function () {};
    }

    function onError(event) {
        const nativeError = safeRead(event, "error");
        const target = safeRead(event, "target");
        const resourceError = !isObjectLike(nativeError) && Boolean(target) && target !== runtime;
        const captured = resourceError
            ? createResourceError()
            : (isObjectLike(nativeError)
                ? nativeError
                : {
                    name: "Error",
                    message: typeof safeRead(event, "message") === "string"
                        ? safeRead(event, "message")
                        : "Unknown client error",
                });

        if (isMarked(event) || isMarked(captured)) return;
        capture(observer, captured, {
            source: resourceError ? "resource" : "window_error",
            severity: "error",
        });
    }

    function onUnhandledRejection(event) {
        const reason = safeRead(event, "reason");
        if (isMarked(event) || isMarked(reason)) return;
        const primitiveReason = !isObjectLike(reason);
        capture(observer, primitiveReason ? createPrimitiveRejection() : reason, {
            source: "unhandledrejection",
            severity: "error",
            primitive_reason: primitiveReason,
        });
    }

    runtime.addEventListener("error", onError, true);
    runtime.addEventListener("unhandledrejection", onUnhandledRejection);

    let disposed = false;
    return function disposeWindowErrorObserver() {
        if (disposed) return;
        disposed = true;
        try {
            runtime.removeEventListener("error", onError, true);
        } catch (error) {
            // Runtime cleanup is best-effort.
        }
        try {
            runtime.removeEventListener("unhandledrejection", onUnhandledRejection);
        } catch (error) {
            // Runtime cleanup is best-effort.
        }
    };
}

export { installWindowErrorObserver };
