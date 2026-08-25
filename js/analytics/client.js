import { createIdentity } from "./identity.js";
import { getReferrerDomain, sanitizeEventDetails, sanitizeKey, sanitizePage } from "./privacy.js";
import { createEventQueue } from "./queue.js";
import { createPageRegistry, normalizePageDefinition } from "./registry.js";
import { createQueueStorage } from "./storage.js";
import { createTransport } from "./transport.js";
import { compactObject, createUuid, getRuntime, nowIso, shouldSample, timezoneOffset } from "./utils.js";

const SDK_VERSION = "1.0.0";
const SCHEMA_VERSION = 1;

function resolveOption(value, fallback) {
    try {
        const resolved = typeof value === "function" ? value() : value;
        return resolved === undefined || resolved === null ? fallback : resolved;
    } catch (error) {
        return fallback;
    }
}

function createAnalytics(options) {
    const settings = options || {};
    const runtime = getRuntime(settings);
    const now = typeof settings.now === "function" ? settings.now : Date.now;
    const registry = settings.registry || createPageRegistry(settings.pages || []);
    const resolvePage = settings.resolvePage;
    const pageListeners = new Set();
    const enabled = settings.enabled === undefined ? true : settings.enabled;
    let identity = null;
    let queue = null;
    let currentPage = null;
    let previousPage = null;
    let pageRequestToken = 0;
    let pendingPageKey = "";
    let destroyed = false;

    function ensureResources() {
        if (!identity) {
            identity = createIdentity({
                runtime,
                now,
                instanceId: resolveOption(settings.instanceId, ""),
                sessionTimeoutMs: settings.sessionTimeoutMs,
            });
        }
        if (!queue) {
            const storage = createQueueStorage({
                storage: runtime.localStorage,
                maxEvents: settings.maxPersistedEvents || 200,
                maxBytes: settings.maxPersistedBytes || 256 * 1024,
                ttlMs: settings.persistTtlMs || 7 * 24 * 60 * 60 * 1000,
                now,
            });
            const transport = createTransport({
                runtime,
                endpoint: settings.endpoint || "/api/cms/system/stat/tracking/batch",
                fetch: settings.fetch,
                navigator: settings.navigator,
                credentials: settings.credentials,
                headersProvider: settings.headersProvider,
                schemaVersion: SCHEMA_VERSION,
                sdkVersion: SDK_VERSION,
            });
            queue = createEventQueue({
                storage,
                transport,
                batchSize: settings.batchSize || 20,
                maxEvents: settings.maxQueueEvents || 200,
                maxBatchBytes: settings.maxBatchBytes || 60 * 1024,
                flushIntervalMs: settings.flushIntervalMs || 10000,
                maxRetries: settings.maxRetries === undefined ? 5 : settings.maxRetries,
                retryBaseMs: settings.retryBaseMs || 1000,
                now,
                random: settings.random,
                setTimeout: settings.setTimeout,
                clearTimeout: settings.clearTimeout,
                onDrop: settings.onDrop,
            });
        }
        return { identity, queue };
    }

    function notifyPage() {
        pageListeners.forEach(function (listener) {
            listener(currentPage);
        });
    }

    function isEnabled() {
        return resolveOption(enabled, false) === true;
    }

    function isTypeAllowed(type) {
        return currentPage && currentPage.sampled && currentPage.event_types.indexOf(type) >= 0;
    }

    function createEvent(eventType, details, eventIdentity) {
        if (!isTypeAllowed(eventType)) return null;
        const resources = ensureResources();
        const identitySnapshot = eventIdentity || resources.identity.nextEvent();
        const page = currentPage;
        const eventDetails = sanitizeEventDetails(details, page);
        const location = runtime.location || {};
        const documentObject = runtime.document || {};
        const baseUrl = location.href || undefined;
        const event = compactObject({
            schema_version: SCHEMA_VERSION,
            event_id: createUuid(runtime),
            instance_id: identitySnapshot.instance_id,
            session_id: identitySnapshot.session_id,
            sequence_no: identitySnapshot.sequence_no,
            page_view_id: page.page_view_id,
            occurred_at: nowIso(now),
            timezone_offset: timezoneOffset(now),
            event_type: sanitizeKey(eventType, 32),
            event_name: eventDetails.event_name,
            page_key: page.page_key,
            route_name: page.route_name,
            route_pattern: page.route_pattern,
            route_path: page.route_path,
            from_page_key: page.from_page_key,
            from_route_name: page.from_route_name,
            from_route_pattern: page.from_route_pattern,
            navigation_type: page.navigation_type,
            is_entry: page.is_entry,
            layout_version: page.layout_version,
            target_key: eventDetails.target_key,
            target_type: eventDetails.target_type,
            target_id: eventDetails.target_id,
            product: sanitizeKey(resolveOption(settings.product, "jx3box"), 64),
            client: sanitizeKey(resolveOption(settings.client, ""), 32),
            game_client: sanitizeKey(resolveOption(settings.gameClient, ""), 16),
            platform: sanitizeKey(resolveOption(settings.platform, ""), 32),
            domain: sanitizeKey(location.hostname || resolveOption(settings.domain, ""), 128),
            channel: sanitizeKey(resolveOption(settings.channel, ""), 64),
            app_version: sanitizeKey(resolveOption(settings.appVersion, ""), 128),
            app_build: sanitizeKey(resolveOption(settings.appBuild, ""), 128),
            web_version: sanitizeKey(resolveOption(settings.webVersion, ""), 128),
            referrer_domain: getReferrerDomain(documentObject.referrer, baseUrl),
            display_mode: sanitizeKey(resolveOption(settings.displayMode, "browser"), 32),
            sample_rate: page.sample_rate,
            properties: eventDetails.properties,
        });
        if (eventDetails.position) Object.assign(event, eventDetails.position);
        return event;
    }

    function track(eventType, details) {
        if (destroyed) return null;
        if (!isTypeAllowed(eventType)) return null;
        const resources = ensureResources();
        let eventIdentity = resources.identity.nextEvent();
        if (eventIdentity.session_rotated && eventType !== "page_view" && currentPage) {
            currentPage = Object.assign({}, currentPage, {
                page_view_id: createUuid(runtime),
                from_page_key: undefined,
                from_route_name: undefined,
                from_route_pattern: undefined,
                navigation_type: "session_resume",
                is_entry: true,
                entered_at: now(),
            });
            notifyPage();
            if (isTypeAllowed("page_view")) {
                const resumedPageView = createEvent("page_view", { name: "page_view" }, eventIdentity);
                if (resumedPageView) resources.queue.enqueue(resumedPageView);
                eventIdentity = resources.identity.nextEvent();
            }
        }
        const event = createEvent(eventType, details, eventIdentity);
        if (!event) return null;
        resources.queue.enqueue(event);
        return event.event_id;
    }

    function activatePage(pageInput) {
        if (destroyed || !isEnabled()) return null;
        const page = normalizePageDefinition(pageInput);
        if (!page.page_key || page.enabled === false) return null;
        const resources = ensureResources();
        const sampled = shouldSample(resources.identity.getInstanceId(), page.sample_rate, settings.sampleSalt);
        const previous = currentPage || previousPage;
        currentPage = Object.assign({}, page, {
            page_view_id: createUuid(runtime),
            sampled,
            from_page_key: previous && previous.page_key,
            from_route_name: previous && previous.route_name,
            from_route_pattern: previous && previous.route_pattern,
            is_entry: !previous,
            entered_at: now(),
        });
        notifyPage();
        if (sampled) track("page_view", { name: "page_view" });
        return currentPage;
    }

    function enterPage(pageInput) {
        const page = sanitizePage(pageInput);
        const token = ++pageRequestToken;
        pendingPageKey = page.page_key;
        if (!isEnabled() || !page.page_key) {
            leavePage();
            return Promise.resolve(null);
        }
        if (typeof resolvePage !== "function") {
            pendingPageKey = "";
            return Promise.resolve(activatePage(pageInput));
        }
        return Promise.resolve(resolvePage(pageInput)).then(function (resolved) {
            if (destroyed || token !== pageRequestToken) return null;
            pendingPageKey = "";
            if (!resolved) {
                leavePage();
                return null;
            }
            return activatePage(Object.assign({}, pageInput, resolved));
        }).catch(function () {
            if (token === pageRequestToken) {
                pendingPageKey = "";
                leavePage();
            }
            return null;
        });
    }

    function activatePath(routePath, extra) {
        const page = registry.match(routePath);
        if (!page) {
            leavePage();
            return Promise.resolve(null);
        }
        return enterPage(Object.assign({}, page, extra || {}, { route_path: routePath }));
    }

    function leavePage(pageKey) {
        const matchesCurrent = !!(currentPage && (!pageKey || currentPage.page_key === pageKey));
        const matchesPending = !!(pendingPageKey && (!pageKey || pendingPageKey === pageKey));
        if (!matchesCurrent && !matchesPending && pageKey) return;
        if (!pageKey || matchesPending) {
            pageRequestToken += 1;
            pendingPageKey = "";
        }
        if (!matchesCurrent) return;
        previousPage = currentPage;
        currentPage = null;
        notifyPage();
    }

    function flush() {
        return queue ? queue.flush() : Promise.resolve({ sent: 0 });
    }

    function flushBeacon() {
        return queue ? queue.flushBeacon() : false;
    }

    function onPageChange(listener) {
        pageListeners.add(listener);
        return function () {
            pageListeners.delete(listener);
        };
    }

    function destroy() {
        destroyed = true;
        currentPage = null;
        pageRequestToken += 1;
        pendingPageKey = "";
        pageListeners.clear();
        if (queue) queue.destroy();
    }

    function getState() {
        return {
            active: !!(currentPage && currentPage.sampled),
            page: currentPage ? Object.assign({}, currentPage) : null,
            queue: queue ? queue.getState() : { pending: 0, dropped: 0, eventIds: [], entries: [] },
            identityCreated: !!identity,
        };
    }

    return {
        activatePath,
        destroy,
        enterPage,
        flush,
        flushBeacon,
        getState,
        isActive: function () {
            return !!(currentPage && currentPage.sampled);
        },
        leavePage,
        onPageChange,
        registerPage: registry.register,
        track,
        unregisterPage: registry.unregister,
    };
}

export { SCHEMA_VERSION, SDK_VERSION, createAnalytics };
