import { getTelemetryEventId } from "./dedupe.js";
import { normalizeRoutePath } from "../analytics/privacy.js";

function safeRead(value, key) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    try {
        return value[key];
    } catch (error) {
        return undefined;
    }
}

function resolveRoutePattern(route) {
    const matched = safeRead(route, "matched");
    let pattern = "";
    if (Array.isArray(matched)) {
        for (let index = matched.length - 1; index >= 0; index -= 1) {
            const candidate = safeRead(matched[index], "path");
            if (typeof candidate === "string" && candidate.trim()) {
                pattern = candidate;
                break;
            }
        }
    }
    return pattern ? normalizeRoutePath(pattern) : "";
}

function callObserver(observer, methodName, args) {
    const method = observer && observer[methodName];
    if (typeof method !== "function") return;
    try {
        const result = method.apply(observer, args);
        if (result && typeof result.catch === "function") result.catch(function () {});
    } catch (error) {
        // Telemetry must never affect navigation.
    }
}

function installRouterErrorObserver(observer, router) {
    if (!router || typeof router !== "object") return function () {};

    let removeAfterEach = null;
    let removeOnError = null;

    function updateRoute(route) {
        const routePattern = resolveRoutePattern(route);
        if (routePattern) callObserver(observer, "setRoute", [routePattern]);
    }

    const currentRoute = safeRead(router, "currentRoute");
    const currentRouteValue = safeRead(currentRoute, "value");
    updateRoute(currentRouteValue || currentRoute);

    if (typeof router.afterEach === "function") {
        removeAfterEach = router.afterEach(function (route) {
            updateRoute(route);
        });
    }

    if (typeof router.onError === "function") {
        removeOnError = router.onError(function (error) {
            if (getTelemetryEventId(error)) return;
            callObserver(observer, "captureError", [error, { source: "router", severity: "error" }]);
        });
    }

    let disposed = false;
    return function disposeRouterErrorObserver() {
        if (disposed) return;
        disposed = true;
        if (typeof removeAfterEach === "function") {
            try {
                removeAfterEach();
            } catch (error) {
                // Router cleanup is best-effort.
            }
        }
        if (typeof removeOnError === "function") {
            try {
                removeOnError();
            } catch (error) {
                // Router cleanup is best-effort.
            }
        }
    };
}

export { installRouterErrorObserver };
