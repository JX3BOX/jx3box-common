import { createIdentity } from "../analytics/identity.js";
import { createEventQueue } from "../analytics/queue.js";
import { createQueueStorage } from "../analytics/storage.js";
import { createUuid, getRuntime, nowIso } from "../analytics/utils.js";
import { getTelemetryEventId, linkTelemetryObjects } from "./dedupe.js";
import { createErrorEvent } from "./error.js";
import { createHttpMetricCollector, installAxiosObserver, resolveRequestRoute } from "./http.js";
import { normalizeApiRoute, sanitizeMetadata } from "./privacy.js";
import { createObservabilityTransport } from "./transport.js";
import { installRouterErrorObserver } from "./router.js";
import { installWindowErrorObserver } from "./window.js";

const OBSERVABILITY_SDK_VERSION = "1.0.0";
const DEFAULT_ERROR_ENDPOINT = "/api/cms/system/stat/errors/batch";
const DEFAULT_METRIC_ENDPOINT = "/api/cms/system/stat/api-metrics/batch";

function resolveOption(value, fallback) {
    try {
        const resolved = typeof value === "function" ? value() : value;
        return resolved === undefined || resolved === null ? fallback : resolved;
    } catch (error) {
        return fallback;
    }
}

function createClientObserver(options) {
    const settings = options || {};
    const runtime = getRuntime(settings);
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const errorEndpoint = settings.errorEndpoint || DEFAULT_ERROR_ENDPOINT;
    const metricEndpoint = settings.metricEndpoint || DEFAULT_METRIC_ENDPOINT;
    const disposers = new Set();
    let resources = null;
    let destroyed = false;
    let started = false;
    let routePattern = "/";
    let breadcrumbs = [];

    function isEnabled() {
        return !destroyed && settings.enabled === true;
    }

    function baseMetadata() {
        return sanitizeMetadata({
            project_id: undefined,
            project_key: resolveOption(settings.projectKey || settings.project_key, ""),
            environment: resolveOption(settings.environment, "production"),
            release: resolveOption(settings.release, ""),
            sdk_version: OBSERVABILITY_SDK_VERSION,
            client: resolveOption(settings.client, "unknown"),
            platform: resolveOption(settings.platform, "unknown"),
            app_version: resolveOption(settings.appVersion || settings.app_version, ""),
            app_build: resolveOption(settings.appBuild || settings.app_build, ""),
            web_version: resolveOption(settings.webVersion || settings.web_version, ""),
        });
    }

    function metadataReady(metadata) {
        return !!(metadata && metadata.project_key && metadata.environment && metadata.release && metadata.sdk_version && metadata.client && metadata.platform);
    }

    function canCapture() {
        return isEnabled() && metadataReady(baseMetadata());
    }

    function isNativeTransport() {
        const metadata = baseMetadata();
        return settings.disableBeacon === true
            || settings.transportMode === "native"
            || metadata.client === "app"
            || metadata.platform === "harmony";
    }

    function ensureResources() {
        if (!canCapture()) return null;
        if (resources) return resources;
        const identity = createIdentity({
            runtime,
            now,
            instanceId: resolveOption(settings.instanceId || settings.instance_id, ""),
            sessionTimeoutMs: settings.sessionTimeoutMs,
        });
        const errorTransport = settings.errorTransport || createObservabilityTransport({
            kind: "error",
            runtime,
            endpoint: errorEndpoint,
            fetch: settings.fetch,
            navigator: settings.navigator,
            credentials: settings.credentials,
            headersProvider: settings.headersProvider,
            now,
            transportMode: isNativeTransport() ? "native" : settings.transportMode,
        });
        const metricTransport = settings.metricTransport || createObservabilityTransport({
            kind: "metric",
            runtime,
            endpoint: metricEndpoint,
            fetch: settings.fetch,
            navigator: settings.navigator,
            credentials: settings.credentials,
            headersProvider: settings.headersProvider,
            now,
            transportMode: isNativeTransport() ? "native" : settings.transportMode,
        });
        const errorStorage = createQueueStorage({
            storage: runtime.localStorage,
            key: settings.errorStorageKey || "jx3box:observability:error-queue:v1",
            maxEvents: settings.maxPersistedErrors || 100,
            maxBytes: settings.maxPersistedErrorBytes || 256 * 1024,
            ttlMs: settings.persistTtlMs || 7 * 24 * 60 * 60 * 1000,
            now,
        });
        const metricStorage = createQueueStorage({
            storage: runtime.localStorage,
            key: settings.metricStorageKey || "jx3box:observability:http-queue:v1",
            maxEvents: settings.maxPersistedMetrics || 200,
            maxBytes: settings.maxPersistedMetricBytes || 256 * 1024,
            ttlMs: settings.persistTtlMs || 7 * 24 * 60 * 60 * 1000,
            now,
        });
        const queueOptions = {
            batchSize: Math.min(Number(settings.batchSize) || 20, 20),
            maxBatchBytes: Math.min(Number(settings.maxBatchBytes) || 44 * 1024, 44 * 1024),
            flushIntervalMs: settings.flushIntervalMs || 10000,
            maxRetries: settings.maxRetries === undefined ? 5 : settings.maxRetries,
            retryBaseMs: settings.retryBaseMs || 1000,
            now,
            random: settings.random,
            setTimeout: settings.setTimeout || runtime.setTimeout,
            clearTimeout: settings.clearTimeout || runtime.clearTimeout,
            onDrop: settings.onDrop,
        };
        const errorQueue = createEventQueue(Object.assign({}, queueOptions, {
            storage: errorStorage,
            transport: errorTransport,
            maxEvents: settings.maxQueueErrors || 100,
        }));
        const metricQueue = createEventQueue(Object.assign({}, queueOptions, {
            storage: metricStorage,
            transport: metricTransport,
            maxEvents: settings.maxQueueMetrics || 200,
        }));
        const collector = createHttpMetricCollector({
            runtime,
            now,
            bucketSeconds: settings.bucketSeconds || 60,
            slowThresholdMs: settings.slowThresholdMs,
            maxBuckets: settings.maxMetricBuckets || 200,
            setTimeout: settings.setTimeout || runtime.setTimeout,
            clearTimeout: settings.clearTimeout || runtime.clearTimeout,
            onDrop: settings.onDrop,
            emit: function (metric, metadata) {
                metricQueue.enqueue({
                    event_id: metric.metric_id,
                    _metadata: metadata,
                    metric,
                });
            },
        });
        resources = { collector, errorQueue, identity, metricQueue };
        return resources;
    }

    function metadataSnapshot(identity) {
        return Object.assign({}, baseMetadata(), { instance_id: identity.getInstanceId() });
    }

    function addDisposer(disposer) {
        if (typeof disposer !== "function") return function () {};
        if (destroyed) {
            try {
                disposer();
            } catch (error) {
                // Terminal observers immediately undo late installations.
            }
            return function () {};
        }
        disposers.add(disposer);
        return function () {
            if (!disposers.has(disposer)) return;
            disposers.delete(disposer);
            disposer();
        };
    }

    function setRoute(value) {
        const raw = String(value || "/");
        // `setRoute` accepts a host/router template, never location.pathname.
        const next = normalizeApiRoute(raw, { explicit: true });
        routePattern = next;
        const latest = breadcrumbs[breadcrumbs.length - 1];
        if (!latest || latest.route_pattern !== next) {
            breadcrumbs = breadcrumbs.concat([{ occurred_at: nowIso(now), route_pattern: next }]).slice(-10);
        }
        return next;
    }

    function captureError(error, context) {
        if (settings.captureErrors === false) return null;
        const current = ensureResources();
        if (!current) return null;
        const existing = getTelemetryEventId(error);
        if (existing) return existing;
        const details = context || {};
        const eventId = createUuid(runtime);
        linkTelemetryObjects([error, error && error.response].concat(details.related_objects || []), eventId);
        const event = createErrorEvent(error, Object.assign({}, details, {
            event_id: eventId,
            occurred_at: nowIso(now),
            route_pattern: details.route_pattern
                ? normalizeApiRoute(details.route_pattern, { explicit: true })
                : routePattern,
            breadcrumbs,
        }));
        if (!event) return null;
        current.errorQueue.enqueue({
            event_id: eventId,
            _metadata: metadataSnapshot(current.identity),
            _session_id: current.identity.getSessionId(),
            event,
        });
        return eventId;
    }

    function recordHttp(observation) {
        if (settings.captureHttp === false) return false;
        const current = ensureResources();
        if (!current) return false;
        return current.collector.record(Object.assign({}, observation, {
            metadata: metadataSnapshot(current.identity),
        }));
    }

    function markHttpObserved(values) {
        const id = createUuid(runtime);
        linkTelemetryObjects(values || [], id);
        return id;
    }

    function shouldIgnoreRequest(config) {
        try {
            if (!config || config.telemetry === false || config.skipTelemetry === true) return true;
            const route = resolveRequestRoute(config, {});
            const telemetryRoutes = [errorEndpoint, metricEndpoint].map(function (endpoint) {
                return normalizeApiRoute(endpoint, { explicit: true });
            });
            return telemetryRoutes.indexOf(route) >= 0;
        } catch (error) {
            return true;
        }
    }

    function observeAxios(instance, observerOptions) {
        if (!canCapture()) return function () {};
        ensureResources();
        return addDisposer(installAxiosObserver(instance, api, Object.assign({
            captureRequestErrors: settings.captureRequestErrors === true,
            navigator: settings.navigator || runtime.navigator,
            now,
        }, observerOptions || {})));
    }

    function observeRouter(router) {
        if (!canCapture()) return function () {};
        ensureResources();
        return addDisposer(installRouterErrorObserver(api, router));
    }

    function start() {
        if (started) return true;
        if (!canCapture()) return false;
        ensureResources();
        started = true;
        if (settings.captureWindow !== false) addDisposer(installWindowErrorObserver(api, { runtime }));
        if (settings.router) observeRouter(settings.router);
        if (settings.axios) observeAxios(settings.axios, settings.axiosOptions);

        const documentObject = runtime.document || {};
        const windowObject = runtime.window || runtime;
        function onHidden() {
            if (documentObject.visibilityState === "hidden") flushBeacon();
        }
        function onPageHide() {
            flushBeacon();
        }
        if (typeof documentObject.addEventListener === "function") {
            documentObject.addEventListener("visibilitychange", onHidden);
            addDisposer(function () {
                documentObject.removeEventListener("visibilitychange", onHidden);
            });
        }
        if (windowObject && typeof windowObject.addEventListener === "function") {
            windowObject.addEventListener("pagehide", onPageHide);
            addDisposer(function () {
                windowObject.removeEventListener("pagehide", onPageHide);
            });
        }
        return true;
    }

    function publicTransportResult(result) {
        return {
            ok: !!(result && result.ok),
            retryable: !result || result.retryable !== false,
            status: Number(result && result.status) || 0,
            confirmedEventIds: Array.isArray(result && result.confirmedEventIds)
                ? result.confirmedEventIds.filter(function (id) { return typeof id === "string"; })
                : [],
        };
    }

    function publicQueueResult(result, queue) {
        const state = queue.getState();
        return {
            sent: Math.max(0, Number(result && result.sent) || 0),
            pending: Math.max(0, Number(result && result.pending) || state.pending || 0),
            result: publicTransportResult(result && result.result),
        };
    }

    function safeQueueFlush(queue) {
        return Promise.resolve().then(function () {
            return queue.flush();
        }).then(function (result) {
            return publicQueueResult(result, queue);
        }).catch(function () {
            return publicQueueResult({ sent: 0, result: { ok: false, retryable: true, status: 0 } }, queue);
        });
    }

    function flush() {
        if (!resources) return Promise.resolve({ errors: { sent: 0 }, metrics: { sent: 0 } });
        resources.collector.flush();
        return Promise.all([safeQueueFlush(resources.errorQueue), safeQueueFlush(resources.metricQueue)]).then(function (result) {
            return { errors: result[0], metrics: result[1] };
        });
    }

    function flushBeacon() {
        if (!resources) return false;
        resources.collector.flush();
        if (isNativeTransport()) return false;
        const errorsSent = resources.errorQueue.flushBeacon();
        const metricsSent = resources.metricQueue.flushBeacon();
        return errorsSent || metricsSent;
    }

    function destroy() {
        if (destroyed) return;
        destroyed = true;
        started = false;
        Array.from(disposers).reverse().forEach(function (disposer) {
            try {
                disposer();
            } catch (error) {
                // Cleanup is best effort.
            }
        });
        disposers.clear();
        if (resources) {
            resources.collector.flush();
            resources.collector.destroy();
            resources.errorQueue.destroy();
            resources.metricQueue.destroy();
        }
    }

    function getState() {
        const errorState = resources ? resources.errorQueue.getState() : { pending: 0, dropped: 0, eventIds: [] };
        const metricState = resources ? resources.metricQueue.getState() : { pending: 0, dropped: 0, eventIds: [] };
        return {
            enabled: canCapture(),
            started,
            identityCreated: !!resources,
            routePattern,
            errors: { pending: errorState.pending, dropped: errorState.dropped, eventIds: errorState.eventIds.slice() },
            metrics: { pending: metricState.pending, dropped: metricState.dropped, eventIds: metricState.eventIds.slice() },
            metricBuckets: resources ? resources.collector.getState().buckets : 0,
        };
    }

    const api = {
        captureError,
        destroy,
        flush,
        flushBeacon,
        getRoute: function () { return routePattern; },
        getState,
        markHttpObserved,
        observeAxios,
        observeRouter,
        recordHttp,
        registerDisposer: addDisposer,
        setRoute,
        shouldIgnoreRequest,
        start,
    };
    return api;
}

function createErrorObserver(options) {
    return createClientObserver(Object.assign({}, options || {}, { captureHttp: false }));
}

function createHttpObserver(options) {
    return createClientObserver(Object.assign({}, options || {}, { captureErrors: false, captureWindow: false }));
}

export {
    DEFAULT_ERROR_ENDPOINT,
    DEFAULT_METRIC_ENDPOINT,
    OBSERVABILITY_SDK_VERSION,
    createClientObserver,
    createErrorObserver,
    createHttpObserver,
};
