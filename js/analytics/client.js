import { createIdentity } from "./identity.js";
import { getReferrerDomain, sanitizeEventDetails, sanitizeKey, sanitizePage, sanitizePublicTarget } from "./privacy.js";
import { createEventQueue } from "./queue.js";
import { createPageRegistry, normalizePageDefinition } from "./registry.js";
import { createQueueStorage } from "./storage.js";
import { createTransport } from "./transport.js";
import { createCompositeRuleResolver } from "./rules.js";
import { compactObject, createUuid, getRuntime, nowIso, shouldSample, timezoneOffset } from "./utils.js";

const SDK_VERSION = "1.1.0";
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
    const ruleResolver = settings.ruleResolver;
    const pageListeners = new Set();
    const pageMetadata = new Map();
    const enabled = settings.enabled === undefined ? true : settings.enabled;
    let identity = null;
    let queue = null;
    let currentPage = null;
    let previousPage = null;
    let pageRequestToken = 0;
    let pendingPageKey = "";
    let navigationOwner = "";
    let navigationOwnerToken = null;
    let lastCanonicalEventId = "";
    let lastCanonicalSessionId = "";
    let lastTrafficPageViewEventId = "";
    let lastTrafficPageViewSessionId = "";
    let destroyed = false;

    function getContextSnapshot() {
        const location = runtime.location || {};
        const product = sanitizeKey(resolveOption(settings.product, "jx3box"), 64);
        const client = sanitizeKey(resolveOption(settings.client, ""), 32);
        return {
            project: sanitizeKey(resolveOption(settings.project, settings.strictContext ? "" : product), 64),
            product,
            surface: sanitizeKey(resolveOption(settings.surface, settings.strictContext ? "" : client), 32),
            client,
            game_client: sanitizeKey(resolveOption(settings.gameClient, ""), 16),
            domain: sanitizeKey(location.hostname || resolveOption(settings.domain, ""), 128),
        };
    }

    function ensureResources() {
        if (!identity) {
            identity = settings.identity || createIdentity({
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
            queue = settings.queue || createEventQueue({
                storage,
                transport,
                sinks: settings.sinks,
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
                beforeFlush: settings.beforeFlush,
                retryPolicy: settings.retryPolicy,
                runtime,
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

    function getEventSinkKeys(type, page) {
        if (!page || !page.sampled) return [];
        const sinkRules = page.sink_rules;
        if (!sinkRules || typeof sinkRules !== "object") {
            return page.event_types.indexOf(type) >= 0 ? ["tracking"] : [];
        }
        return Object.keys(sinkRules).filter(function (key) {
            const state = sinkRules[key];
            return state && state.sampled && state.event_types.indexOf(type) >= 0;
        });
    }

    function isTypeAllowed(type) {
        return getEventSinkKeys(type, currentPage).length > 0;
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
        const eventId = createUuid(runtime);
        const previousCanonicalEventId = lastCanonicalSessionId === identitySnapshot.session_id ? lastCanonicalEventId : "";
        const sinkKeys = getEventSinkKeys(eventType, page);
        const hasTrafficDelivery = eventType === "page_view" && sinkKeys.indexOf("traffic") >= 0;
        const previousTrafficPageViewEventId = hasTrafficDelivery
            && lastTrafficPageViewSessionId === identitySnapshot.session_id
            ? lastTrafficPageViewEventId
            : "";
        const referrerDomain = getReferrerDomain(documentObject.referrer, baseUrl);
        const event = compactObject({
            schema_version: SCHEMA_VERSION,
            event_id: eventId,
            // Traffic paths chain page views only. The independent canonical
            // chain remains available for diagnostics and ordering all events.
            previous_event_id: previousTrafficPageViewEventId,
            previous_canonical_event_id: previousCanonicalEventId,
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
            canonical_path: page.canonical_path,
            from_page_key: page.from_page_key,
            from_route_name: page.from_route_name,
            from_route_pattern: page.from_route_pattern,
            navigation_type: page.navigation_type,
            is_entry: hasTrafficDelivery ? !previousTrafficPageViewEventId : page.is_entry,
            layout_version: page.layout_version,
            public_target: sanitizePublicTarget(page.public_target),
            interaction_target: eventDetails.interaction_target,
            target_key: eventDetails.target_key,
            target_type: eventDetails.target_type,
            target_id: eventDetails.target_id,
            product: page.product,
            project: page.project,
            surface: page.surface,
            client: page.client,
            game_client: page.game_client,
            platform: sanitizeKey(resolveOption(settings.platform, ""), 32),
            domain: page.domain,
            channel: sanitizeKey(resolveOption(settings.channel, ""), 64),
            app_version: sanitizeKey(resolveOption(settings.appVersion, ""), 128),
            app_build: sanitizeKey(resolveOption(settings.appBuild, ""), 128),
            web_version: sanitizeKey(resolveOption(settings.webVersion, ""), 128),
            referrer_domain: referrerDomain,
            entry_source: referrerDomain ? { referrer_domain: referrerDomain } : undefined,
            display_mode: sanitizeKey(resolveOption(settings.displayMode, "browser"), 32),
            sample_rate: page.sample_rate,
            properties: eventDetails.properties,
        });
        if (eventDetails.position) Object.assign(event, eventDetails.position);
        return event;
    }

    function commitEventChain(event, eventType, sinkKeys) {
        lastCanonicalSessionId = event.session_id;
        lastCanonicalEventId = event.event_id;
        if (eventType === "page_view" && sinkKeys.indexOf("traffic") >= 0) {
            lastTrafficPageViewSessionId = event.session_id;
            lastTrafficPageViewEventId = event.event_id;
        }
    }

    function enqueueEvent(event, eventType) {
        const resources = ensureResources();
        const sinkKeys = getEventSinkKeys(eventType, currentPage);
        if (!sinkKeys.length) return false;
        const deferredSinkKeys = settings.deferTrafficPageView !== false
            && eventType === "page_view"
            && sinkKeys.indexOf("traffic") >= 0
            ? ["traffic"]
            : [];
        if (!currentPage.sink_rules && !Array.isArray(settings.sinks)) {
            const legacyResult = resources.queue.enqueue(event);
            if (legacyResult === false) return false;
            commitEventChain(event, eventType, sinkKeys);
            return true;
        }
        const enqueueResult = resources.queue.enqueue(event, {
            sinkKeys,
            deferredSinkKeys,
            context: {
                rule_versions: currentPage.rule_versions,
            },
        });
        if (enqueueResult === false) return false;
        commitEventChain(event, eventType, sinkKeys);
        return true;
    }

    function track(eventType, details) {
        if (destroyed) return null;
        if (!isTypeAllowed(eventType)) return null;
        const resources = ensureResources();
        let eventIdentity = resources.identity.nextEvent();
        if (eventIdentity.session_rotated && eventType !== "page_view" && currentPage) {
            finalizePage({ is_exit: true, reason: "session_timeout" });
            currentPage = Object.assign({}, currentPage, {
                page_view_id: createUuid(runtime),
                from_page_key: undefined,
                from_route_name: undefined,
                from_route_pattern: undefined,
                navigation_type: "session_resume",
                is_entry: true,
                entered_at: now(),
                finalized: false,
            });
            notifyPage();
            if (isTypeAllowed("page_view")) {
                const resumedPageView = createEvent("page_view", { name: "page_view" }, eventIdentity);
                if (resumedPageView && enqueueEvent(resumedPageView, "page_view")) {
                    currentPage.page_view_event_id = resumedPageView.event_id;
                }
                eventIdentity = resources.identity.nextEvent();
            }
        }
        const event = createEvent(eventType, details, eventIdentity);
        if (!event) return null;
        if (!enqueueEvent(event, eventType)) return null;
        return event.event_id;
    }

    function buildSinkRules(pageInput, instanceId) {
        const source = pageInput && pageInput.sink_rules;
        if (!source || typeof source !== "object") return null;
        const output = {};
        Object.keys(source).forEach(function (key) {
            const rule = source[key];
            if (!rule || rule.enabled === false || !Array.isArray(rule.event_types)) return;
            const rate = rule.sample_rate === undefined ? 0 : rule.sample_rate;
            output[key] = Object.assign({}, rule, {
                sampled: shouldSample(instanceId, rate, settings.sampleSalt),
            });
        });
        return Object.keys(output).length ? output : null;
    }

    function finalizePage(options) {
        const page = currentPage;
        const finalizeOptions = options || {};
        if (!page || page.finalized || !page.page_view_event_id) return false;
        const resources = ensureResources();
        const duration = Math.max(0, now() - Number(page.entered_at || now()));
        if (typeof resources.queue.finalize === "function") {
            resources.queue.finalize(page.page_view_event_id, "traffic", {
                duration_ms: Math.min(Math.round(duration), 24 * 60 * 60 * 1000),
                is_exit: finalizeOptions.is_exit === true,
                finalize_reason: sanitizeKey(finalizeOptions.reason || "navigation", 32),
            }, {
                // pagehide is synchronous: a strictly bounded SDK-generated
                // finalization may retain the last successful guard grant.
                preserveBeaconAuthorization: finalizeOptions.reason === "pagehide",
            });
        }
        page.finalized = true;
        return true;
    }

    function activatePage(pageInput) {
        if (destroyed || !isEnabled()) return null;
        const page = normalizePageDefinition(pageInput);
        if (!page.page_key || page.enabled === false) return null;
        const resources = ensureResources();
        const sinkRules = buildSinkRules(pageInput, resources.identity.getInstanceId());
        const sampled = sinkRules
            ? Object.keys(sinkRules).some(function (key) { return sinkRules[key].sampled; })
            : shouldSample(resources.identity.getInstanceId(), page.sample_rate, settings.sampleSalt);
        const previous = currentPage || previousPage;
        if (currentPage) finalizePage({ is_exit: false, reason: "navigation" });
        const ruleVersions = {};
        const context = getContextSnapshot();
        if (sinkRules) {
            Object.keys(sinkRules).forEach(function (key) {
                if (sinkRules[key].rule_version) ruleVersions[key] = sinkRules[key].rule_version;
            });
        }
        currentPage = Object.assign({}, page, {
            page_view_id: createUuid(runtime),
            sampled,
            sink_keys: Array.isArray(pageInput.sink_keys) ? pageInput.sink_keys.slice() : (sinkRules ? Object.keys(sinkRules) : ["tracking"]),
            sink_rules: sinkRules,
            rule_versions: Object.keys(ruleVersions).length ? ruleVersions : undefined,
            public_target: sanitizePublicTarget(pageInput.public_target),
            project: sanitizeKey(pageInput.project, 64) || context.project,
            product: sanitizeKey(pageInput.product, 64) || context.product,
            surface: sanitizeKey(pageInput.surface, 32) || context.surface,
            client: sanitizeKey(pageInput.client, 32) || context.client,
            game_client: sanitizeKey(pageInput.game_client || pageInput.gameClient, 16) || context.game_client,
            domain: sanitizeKey(pageInput.domain, 128) || context.domain,
            from_page_key: previous && previous.page_key,
            from_route_name: previous && previous.route_name,
            from_route_pattern: previous && previous.route_pattern,
            is_entry: !previous,
            entered_at: now(),
        });
        notifyPage();
        if (sampled) {
            currentPage.page_view_event_id = track("page_view", { name: "page_view" });
            if (!currentPage.page_view_event_id) {
                // A missing/misconfigured sink or a blocked Journal must not
                // leave auto-capture appearing active without its canonical PV.
                currentPage.sampled = false;
                notifyPage();
            }
        }
        return currentPage;
    }

    function resolveConfiguredPage(pageInput) {
        if (ruleResolver) {
            const resolver = typeof ruleResolver === "function" ? ruleResolver : ruleResolver.resolve;
            if (typeof resolver !== "function") return Promise.resolve(null);
            const resolverInput = Object.assign({}, pageInput || {});
            const context = getContextSnapshot();
            ["project", "product", "surface", "client", "game_client", "domain"].forEach(function (key) {
                if (!resolverInput[key] && context[key]) resolverInput[key] = context[key];
            });
            // Core owns the stable page context. Router adapters may override a
            // field explicitly, but consumers need not duplicate these options.
            return Promise.resolve(resolver.call(ruleResolver, resolverInput));
        }
        if (typeof resolvePage === "function") return Promise.resolve(resolvePage(pageInput));
        return Promise.resolve(pageInput);
    }

    function enterPage(pageInput) {
        const page = sanitizePage(pageInput);
        const token = ++pageRequestToken;
        const route = pageInput && pageInput.route;
        const requestKey = page.page_key || sanitizeKey(pageInput && (pageInput.route_name || pageInput.routeName) || route && route.name, 128);
        pendingPageKey = requestKey;
        if (!isEnabled() || (!page.page_key && !ruleResolver)) {
            leavePage();
            return Promise.resolve(null);
        }
        if (!ruleResolver && typeof resolvePage !== "function") {
            pendingPageKey = "";
            return Promise.resolve(activatePage(pageInput));
        }
        return resolveConfiguredPage(pageInput).then(function (resolved) {
            if (destroyed || token !== pageRequestToken) return null;
            pendingPageKey = "";
            if (!resolved) {
                leavePage();
                return null;
            }
            // Only normalized rule output is merged into the canonical page.
            // Raw route/query objects from pageInput are intentionally dropped.
            return activatePage(Object.assign({}, page, resolved));
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
        finalizePage({ is_exit: true, reason: "leave" });
        previousPage = currentPage;
        currentPage = null;
        notifyPage();
    }

    function flush(options) {
        return queue ? queue.flush(options) : Promise.resolve({ sent: 0 });
    }

    function flushBeacon(options) {
        return queue ? queue.flushBeacon(options) : false;
    }

    function clear(reason, predicate) {
        return queue && typeof queue.clear === "function" ? queue.clear(reason, predicate) : 0;
    }

    function block(reason, options) {
        ensureResources();
        return typeof queue.block === "function" ? queue.block(reason, options) : false;
    }

    function unblock() {
        return queue && typeof queue.unblock === "function" ? queue.unblock() : false;
    }

    function cancelInflight(reason) {
        return queue && typeof queue.cancelInflight === "function" ? queue.cancelInflight(reason) : false;
    }

    function claimNavigationOwner(owner, token) {
        const nextOwner = sanitizeKey(owner, 32);
        if (!nextOwner) throw new Error("analytics navigation owner is required");
        if (navigationOwnerToken && navigationOwnerToken !== token) {
            throw new Error("analytics navigation owner already installed: " + navigationOwner);
        }
        navigationOwner = nextOwner;
        navigationOwnerToken = token || navigationOwnerToken || {};
        const claimedToken = navigationOwnerToken;
        return function releaseNavigationOwner() {
            if (navigationOwnerToken !== claimedToken) return;
            navigationOwner = "";
            navigationOwnerToken = null;
        };
    }

    function getNavigationOwner() {
        return navigationOwner;
    }

    function setPageMetadata(key, value) {
        const source = value || {};
        const metadata = {
            page_key: sanitizeKey(source.page_key || source.id, 128),
            layout_version: sanitizeKey(source.layout_version || source.layoutVersion, 64),
        };
        if (!metadata.page_key && !metadata.layout_version) return null;
        pageMetadata.set(key || "default", metadata);
        if (currentPage && (!metadata.page_key || currentPage.page_key === metadata.page_key)) {
            currentPage = Object.assign({}, currentPage, metadata);
            notifyPage();
        }
        return metadata;
    }

    function removePageMetadata(key) {
        pageMetadata.delete(key || "default");
    }

    function getPageMetadata() {
        let latest = null;
        pageMetadata.forEach(function (metadata) {
            latest = metadata;
        });
        return latest ? Object.assign({}, latest) : null;
    }

    function onPageChange(listener) {
        pageListeners.add(listener);
        return function () {
            pageListeners.delete(listener);
        };
    }

    function destroy() {
        finalizePage({ is_exit: true, reason: "destroy" });
        destroyed = true;
        currentPage = null;
        pageRequestToken += 1;
        pendingPageKey = "";
        pageListeners.clear();
        pageMetadata.clear();
        if (queue) queue.destroy();
    }

    function getState() {
        return {
            active: !!(currentPage && currentPage.sampled),
            page: currentPage ? Object.assign({}, currentPage) : null,
            queue: queue ? queue.getState() : { pending: 0, dropped: 0, eventIds: [], entries: [] },
            identityCreated: !!identity,
            navigationOwner,
        };
    }

    return {
        activatePath,
        block,
        cancelInflight,
        claimNavigationOwner,
        clear,
        destroy,
        enterPage,
        finalizePage,
        flush,
        flushBeacon,
        getNavigationOwner,
        getContextSnapshot,
        getPageMetadata,
        getState,
        isActive: function () {
            return !!(currentPage && currentPage.sampled);
        },
        leavePage,
        onPageChange,
        removePageMetadata,
        registerPage: registry.register,
        setPageMetadata,
        track,
        unblock,
        unregisterPage: registry.unregister,
    };
}

function createAnalyticsCore(options) {
    const settings = Object.assign({}, options || {});
    settings.strictContext = true;
    if (!settings.ruleResolver) {
        settings.ruleResolver = createCompositeRuleResolver(settings.resolvers || settings.rules || {});
    }
    return createAnalytics(settings);
}

export { SCHEMA_VERSION, SDK_VERSION, createAnalytics, createAnalyticsCore };
