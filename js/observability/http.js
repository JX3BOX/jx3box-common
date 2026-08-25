import { createUuid } from "../analytics/utils.js";
import { sanitizeKey } from "../analytics/privacy.js";
import { normalizeApiRoute } from "./privacy.js";

const REQUEST_STARTED_AT = Symbol("jx3box.telemetry.request_started_at");
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const SERVICE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const MAX_METRIC_COUNT = 1_000_000_000;
const axiosInstallations = new WeakMap();
const RESULT_FIELDS = {
    success: "success_count",
    business_error: "business_error_count",
    http_4xx: "http_4xx_count",
    http_5xx: "http_5xx_count",
    timeout: "timeout_count",
    network: "network_error_count",
    offline: "offline_count",
    cancelled: "cancelled_count",
};

function boundedLatency(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(Math.round(number), 86_400_000);
}

function safeRead(value, key) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return undefined;
    try {
        return value[key];
    } catch (error) {
        return undefined;
    }
}

function normalizeServiceKey(value) {
    const key = sanitizeKey(value || "unknown", 64);
    return SERVICE_KEY_PATTERN.test(key) ? key : "";
}

function normalizeHttpMethod(value) {
    const method = String(value || "GET").toUpperCase();
    return ALLOWED_METHODS.has(method) ? method : "";
}

function createEmptyMetric(input, bucketStart, bucketSeconds) {
    const apiRouteTemplate = input._api_route_template === true;
    return {
        bucket_start: new Date(bucketStart).toISOString(),
        bucket_seconds: bucketSeconds,
        service_key: normalizeServiceKey(input.service_key || "unknown"),
        http_method: normalizeHttpMethod(input.http_method || "GET"),
        api_route: normalizeApiRoute(input.api_route || "/", { explicit: apiRouteTemplate }),
        _api_route_template: apiRouteTemplate,
        request_count: 0,
        success_count: 0,
        business_error_count: 0,
        http_4xx_count: 0,
        http_5xx_count: 0,
        timeout_count: 0,
        network_error_count: 0,
        offline_count: 0,
        cancelled_count: 0,
        slow_count: 0,
        latency_lt_300_count: 0,
        latency_300_999_count: 0,
        latency_1000_2999_count: 0,
        latency_3000_9999_count: 0,
        latency_gte_10000_count: 0,
        latency_sum_ms: 0,
        max_latency_ms: 0,
    };
}

function latencyCountField(latency) {
    if (latency < 300) return "latency_lt_300_count";
    if (latency < 1000) return "latency_300_999_count";
    if (latency < 3000) return "latency_1000_2999_count";
    if (latency < 10000) return "latency_3000_9999_count";
    return "latency_gte_10000_count";
}

function addLatency(metric, latency) {
    metric[latencyCountField(latency)] += 1;
    metric.latency_sum_ms += latency;
    metric.max_latency_ms = Math.max(metric.max_latency_ms, latency);
}

function wouldOverflowMetric(metric, outcomeField, latency, slow) {
    return metric.request_count >= MAX_METRIC_COUNT
        || metric[outcomeField] >= MAX_METRIC_COUNT
        || metric[latencyCountField(latency)] >= MAX_METRIC_COUNT
        || slow && metric.slow_count >= MAX_METRIC_COUNT
        || metric.latency_sum_ms + latency > MAX_METRIC_COUNT;
}

function createHttpMetricCollector(options) {
    const settings = options || {};
    const runtime = settings.runtime || {};
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const emit = typeof settings.emit === "function" ? settings.emit : function () {};
    const bucketSeconds = Math.max(10, Math.min(Math.floor(Number(settings.bucketSeconds) || 60), 300));
    const bucketMs = bucketSeconds * 1000;
    const slowThresholdMs = settings.slowThresholdMs === false
        ? 0
        : Math.max(0, Number(settings.slowThresholdMs) || 3000);
    const setTimer = settings.setTimeout || runtime.setTimeout || (typeof setTimeout === "function" ? setTimeout : null);
    const clearTimer = settings.clearTimeout || runtime.clearTimeout || (typeof clearTimeout === "function" ? clearTimeout : null);
    const autoClose = settings.autoClose !== false;
    const maxBuckets = Math.max(1, Math.min(Math.floor(Number(settings.maxBuckets) || 200), 1000));
    const onDrop = typeof settings.onDrop === "function" ? settings.onDrop : function () {};
    const buckets = new Map();
    let timer = null;
    let destroyed = false;

    function metadataSignature(metadata) {
        const value = metadata || {};
        return [
            value.instance_id,
            value.project_key,
            value.environment,
            value.release,
            value.sdk_version,
            value.client,
            value.platform,
            value.app_version,
            value.app_build,
            value.web_version,
        ].map(function (item) {
            return String(item === undefined || item === null ? "" : item);
        }).join("\u001f");
    }

    function schedule() {
        if (!autoClose || destroyed || timer || !buckets.size || typeof setTimer !== "function") return;
        let nextBoundary = Infinity;
        buckets.forEach(function (entry) {
            nextBoundary = Math.min(nextBoundary, entry.bucketStart + bucketMs);
        });
        timer = setTimer(function () {
            timer = null;
            closeExpired();
            schedule();
        }, Math.max(1, nextBoundary - now() + 1));
    }

    function emitEntry(key, entry) {
        buckets.delete(key);
        const metric = Object.assign({ metric_id: createUuid(runtime) }, entry.metric);
        try {
            emit(metric, Object.assign({}, entry.metadata));
        } catch (error) {
            try {
                onDrop("metric_emit_failed", {
                    service_key: metric.service_key,
                    http_method: metric.http_method,
                    api_route: metric.api_route,
                });
            } catch (dropError) {
                // Diagnostics must not escape the collector.
            }
        }
        return metric;
    }

    function closeExpired(at) {
        const current = Number(at === undefined ? now() : at);
        const emitted = [];
        Array.from(buckets.entries()).forEach(function (pair) {
            const key = pair[0];
            const entry = pair[1];
            if (entry.bucketStart + bucketMs <= current) emitted.push(emitEntry(key, entry));
        });
        return emitted;
    }

    function record(input) {
        if (destroyed || !input) return false;
        closeExpired();
        const occurredAt = Number(input.occurred_at_ms);
        const timestamp = Number.isFinite(occurredAt) ? occurredAt : now();
        const bucketStart = Math.floor(timestamp / bucketMs) * bucketMs;
        const normalized = {
            service_key: input.service_key,
            http_method: input.http_method,
            api_route: input.api_route,
            _api_route_template: input._api_route_template === true,
        };
        const metric = createEmptyMetric(normalized, bucketStart, bucketSeconds);
        if (!metric.service_key || !metric.http_method || !metric.api_route) return false;
        const metadata = input.metadata || {};
        const key = [
            metadataSignature(metadata),
            metric.service_key,
            metric.http_method,
            metric.api_route,
            metric._api_route_template ? "template" : "fallback",
            bucketStart,
        ].join("\u001e");
        let entry = buckets.get(key);
        if (!entry) {
            if (buckets.size >= maxBuckets) {
                try {
                    onDrop("metric_dimension_limit", {
                        service_key: metric.service_key,
                        http_method: metric.http_method,
                        api_route: metric.api_route,
                    });
                } catch (error) {
                    // Diagnostics must not affect request handling.
                }
                return false;
            }
            entry = { bucketStart, metadata: Object.assign({}, metadata), metric };
            buckets.set(key, entry);
        }
        const outcome = Object.prototype.hasOwnProperty.call(RESULT_FIELDS, input.outcome) ? input.outcome : "network";
        const latency = boundedLatency(input.latency_ms);
        const outcomeField = RESULT_FIELDS[outcome];
        const slow = slowThresholdMs > 0 && latency >= slowThresholdMs;
        if (wouldOverflowMetric(entry.metric, outcomeField, latency, slow)) {
            emitEntry(key, entry);
            entry = {
                bucketStart,
                metadata: Object.assign({}, metadata),
                metric: createEmptyMetric(normalized, bucketStart, bucketSeconds),
            };
            buckets.set(key, entry);
        }
        entry.metric.request_count += 1;
        entry.metric[outcomeField] += 1;
        if (slow) entry.metric.slow_count += 1;
        addLatency(entry.metric, latency);
        schedule();
        return true;
    }

    function flush() {
        if (timer && typeof clearTimer === "function") clearTimer(timer);
        timer = null;
        return Array.from(buckets.entries()).map(function (pair) {
            return emitEntry(pair[0], pair[1]);
        });
    }

    function destroy() {
        destroyed = true;
        if (timer && typeof clearTimer === "function") clearTimer(timer);
        timer = null;
        buckets.clear();
    }

    function getState() {
        return { buckets: buckets.size };
    }

    return { closeExpired, destroy, flush, getState, record };
}

function resolveOutcome(response, error, options) {
    const settings = options || {};
    const status = Number(safeRead(response, "status")) || 0;
    if (error) {
        const code = String(safeRead(error, "code") || "").toUpperCase();
        const message = String(safeRead(error, "message") || "").toLowerCase();
        if (code === "ERR_CANCELED" || code === "ECONNABORTED" && message.indexOf("cancel") >= 0 || safeRead(error, "__CANCEL__")) return "cancelled";
        if (code === "ECONNABORTED" || code === "ETIMEDOUT" || message.indexOf("timeout") >= 0) return "timeout";
        const navigatorObject = settings.navigator || {};
        if (navigatorObject.onLine === false) return "offline";
    }
    if (status >= 500) return "http_5xx";
    if (status >= 400) return "http_4xx";
    if (error) return "network";
    if (typeof settings.classifyResponse === "function") {
        try {
            const classified = settings.classifyResponse(response);
            if (classified === false || classified === "business_error") return "business_error";
            if (Object.prototype.hasOwnProperty.call(RESULT_FIELDS, classified)) return classified;
        } catch (classificationError) {
            // Classification must never change request behavior.
        }
    }
    return "success";
}

function resolveRequestRouteInfo(config, options) {
    const settings = options || {};
    const explicitRoute = safeRead(config, "telemetryRoute");
    if (explicitRoute) return { route: normalizeApiRoute(explicitRoute, { explicit: true }), template: true };
    if (typeof settings.resolveRoute === "function") {
        try {
            const resolved = settings.resolveRoute(config || {});
            if (resolved) return { route: normalizeApiRoute(resolved, { explicit: true }), template: true };
        } catch (error) {
            // Fall through to automatic path normalization.
        }
    }
    const rawUrl = String(safeRead(config, "url") || "/");
    const urlRoute = normalizeApiRoute(rawUrl, { explicit: false });
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(rawUrl)) return { route: urlRoute, template: false };
    const rawBaseUrl = String(safeRead(config, "baseURL") || "");
    if (!rawBaseUrl) return { route: urlRoute, template: false };
    const baseRoute = normalizeApiRoute(rawBaseUrl, { explicit: false });
    if (baseRoute === "/" || urlRoute === baseRoute || urlRoute.indexOf(baseRoute + "/") === 0) {
        return { route: urlRoute, template: false };
    }
    return {
        route: normalizeApiRoute(baseRoute + "/" + urlRoute.replace(/^\/+/, ""), { explicit: false }),
        template: false,
    };
}

function resolveRequestRoute(config, options) {
    return resolveRequestRouteInfo(config, options).route;
}

function installAxiosObserver(instance, observer, options) {
    const settings = options || {};
    if (!instance || !instance.interceptors || !instance.interceptors.request || !instance.interceptors.response) return function () {};
    if (!observer || typeof observer.recordHttp !== "function") return function () {};
    let observerEntries = axiosInstallations.get(instance);
    if (!observerEntries) {
        observerEntries = new Map();
        axiosInstallations.set(instance, observerEntries);
    }
    const existing = observerEntries.get(observer);
    if (existing) {
        existing.references += 1;
        return existing.createRelease();
    }
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const starts = new WeakMap();
    const serviceKey = normalizeServiceKey(settings.serviceKey || settings.service_key || "unknown");

    function shouldSkip(config) {
        try {
            if (!config || safeRead(config, "telemetry") === false || safeRead(config, "skipTelemetry") === true) return true;
            return typeof observer.shouldIgnoreRequest === "function" && observer.shouldIgnoreRequest(config);
        } catch (error) {
            return true;
        }
    }

    const requestInterceptor = instance.interceptors.request.use(function (config) {
        try {
            if (!shouldSkip(config) && config && typeof config === "object") {
                const snapshot = { startedAt: now() };
                starts.set(config, snapshot);
                Object.defineProperty(config, REQUEST_STARTED_AT, { configurable: true, value: snapshot.startedAt });
            }
        } catch (error) {
            // WeakMap and timing are best effort only.
        }
        return config;
    });

    function absorbAsync(result) {
        if (result && typeof result.catch === "function") result.catch(function () {});
    }

    function observe(response, error) {
        try {
            const responseFromError = safeRead(error, "response");
            const responseShapedError = !responseFromError && safeRead(error, "config") && safeRead(error, "status") !== undefined;
            const observedResponse = response || responseFromError || (responseShapedError ? error : null);
            const observedError = responseShapedError ? null : error;
            const config = safeRead(observedResponse, "config") || safeRead(observedError, "config") || {};
            if (shouldSkip(config) || !serviceKey) return;
            const snapshot = starts.get(config);
            const fallbackStart = Number(safeRead(config, REQUEST_STARTED_AT));
            const startedAt = snapshot ? snapshot.startedAt : Number.isFinite(fallbackStart) ? fallbackStart : now();
            const routeInfo = resolveRequestRouteInfo(config, settings);
            const route = routeInfo.route;
            const method = normalizeHttpMethod(safeRead(config, "method") || "GET");
            if (!method) return;
            const outcome = resolveOutcome(observedResponse, observedError, {
                classifyResponse: settings.classifyResponse,
                navigator: settings.navigator,
            });
            const observation = {
                occurred_at_ms: startedAt,
                service_key: serviceKey,
                http_method: method,
                api_route: route,
                _api_route_template: routeInfo.template,
                outcome,
                latency_ms: Math.max(0, now() - startedAt),
            };
            absorbAsync(observer.recordHttp(observation));
            if (observedError && settings.captureRequestErrors === true && typeof observer.captureError === "function") {
                const captured = observer.captureError(observedError, {
                    source: "request_unhandled",
                    error_name: "HttpRequestError",
                    message: "HTTP request failed: " + outcome + " " + method + " " + route,
                    route_pattern: typeof observer.getRoute === "function" ? observer.getRoute() : undefined,
                    related_objects: [observedResponse, responseFromError],
                });
                absorbAsync(captured);
                if (!captured && typeof observer.markHttpObserved === "function") {
                    absorbAsync(observer.markHttpObserved([observedError, observedResponse, responseFromError]));
                }
            } else if (typeof observer.markHttpObserved === "function") {
                absorbAsync(observer.markHttpObserved([observedError, observedResponse, responseFromError]));
            }
        } catch (observationError) {
            // Observation is best effort and must never change Axios semantics.
        }
    }

    const responseInterceptor = instance.interceptors.response.use(function (response) {
        observe(response, null);
        return response;
    }, function (error) {
        observe(error && error.response, error);
        return Promise.reject(error);
    });

    function eject() {
        if (instance.interceptors.request && typeof instance.interceptors.request.eject === "function") {
            instance.interceptors.request.eject(requestInterceptor);
        }
        if (instance.interceptors.response && typeof instance.interceptors.response.eject === "function") {
            instance.interceptors.response.eject(responseInterceptor);
        }
    }

    const entry = {
        references: 1,
        createRelease: function () {
            let released = false;
            return function () {
                if (released) return;
                released = true;
                entry.references -= 1;
                if (entry.references > 0) return;
                observerEntries.delete(observer);
                if (!observerEntries.size) axiosInstallations.delete(instance);
                try {
                    eject();
                } catch (error) {
                    // Eject is best effort.
                }
            };
        },
    };
    observerEntries.set(observer, entry);
    return entry.createRelease();
}

export {
    RESULT_FIELDS,
    createHttpMetricCollector,
    installAxiosObserver,
    resolveOutcome,
    resolveRequestRoute,
};
