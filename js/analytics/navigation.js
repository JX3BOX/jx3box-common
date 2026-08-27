import { sanitizeKey } from "./privacy.js";
import { createRuleRequestContext, extractRoutePattern } from "./rules.js";

const ROUTER_OWNER_KEY = "__jx3boxAnalyticsRouterOwner__";

function readRouteMeta(route) {
    const meta = route && route.meta && typeof route.meta === "object" ? route.meta : {};
    return meta.analytics && typeof meta.analytics === "object" ? meta.analytics : {};
}

function createNavigationInput(route, previousRoute, client, settings) {
    const source = route || {};
    const analyticsMeta = readRouteMeta(source);
    const directiveMetadata = client && typeof client.getPageMetadata === "function" ? client.getPageMetadata() : null;
    const clientContext = client && typeof client.getContextSnapshot === "function" ? client.getContextSnapshot() : {};
    const routePattern = extractRoutePattern(source);
    if (!routePattern) return null;
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : {});
    const domain = runtime.location && runtime.location.hostname ? runtime.location.hostname : (settings.domain || clientContext.domain);
    const request = createRuleRequestContext({
        page_key: directiveMetadata && directiveMetadata.page_key || analyticsMeta.page_key || analyticsMeta.pageKey,
        route_name: source.name,
        route_pattern: routePattern,
        layout_version: directiveMetadata && directiveMetadata.layout_version || analyticsMeta.layout_version || analyticsMeta.layoutVersion,
        project: settings.project || clientContext.project,
        product: settings.product || clientContext.product,
        surface: settings.surface || clientContext.surface,
        client: settings.client || clientContext.client,
        game_client: typeof settings.gameClient === "function" ? settings.gameClient(source) : (settings.gameClient || clientContext.game_client),
        domain,
    });
    // The raw route is retained only until CompositeRuleResolver projects a
    // whitelisted public_target. It is never merged into the canonical page.
    request.route = {
        name: source.name,
        route_pattern: routePattern,
        params: source.params,
        query: source.query,
    };
    request.navigation_type = sanitizeKey(analyticsMeta.navigation_type || analyticsMeta.navigationType || settings.navigationType || "router", 32);
    if (previousRoute) {
        request.from_route_name = sanitizeKey(previousRoute.name, 128);
        request.from_route_pattern = extractRoutePattern(previousRoute);
    }
    return request;
}

function createNavigationController(options) {
    const settings = options && typeof options.enterPage === "function" ? { client: options } : (options || {});
    const client = settings.client || settings.analytics;
    if (!client || typeof client.enterPage !== "function") throw new Error("analytics client is required");
    const ownerToken = {};
    const releaseOwner = typeof client.claimNavigationOwner === "function"
        ? client.claimNavigationOwner("router", ownerToken)
        : function () {};
    let destroyed = false;
    let lastNavigationId = "";
    let lastPromise = null;

    function navigate(route, previousRoute, context) {
        if (destroyed) return Promise.resolve(null);
        const navigationContext = context || {};
        const navigationId = sanitizeKey(navigationContext.navigation_id || navigationContext.navigationId, 128);
        if (navigationId && navigationId === lastNavigationId && lastPromise) return lastPromise;
        const input = createNavigationInput(route, previousRoute, client, settings);
        if (!input) {
            if (typeof client.finalizePage === "function") client.finalizePage({ is_exit: false, reason: "navigation" });
            client.leavePage();
            return Promise.resolve(null);
        }
        if (navigationId) lastNavigationId = navigationId;
        // Close the previous traffic delivery at navigation time, before a
        // potentially slow config request. A navigation to an untracked route
        // is still not a browser exit.
        if (typeof client.finalizePage === "function") client.finalizePage({ is_exit: false, reason: "navigation" });
        // Remove the old capture context before awaiting remote rules. Clicks,
        // exposures and scrolls from the new DOM must fail closed during the
        // transition instead of being attributed to the finalized old page.
        client.leavePage();
        lastPromise = Promise.resolve(client.enterPage(input));
        return lastPromise;
    }

    function finalize(options) {
        if (destroyed) return false;
        return typeof client.finalizePage === "function" ? client.finalizePage(options) : false;
    }

    function destroy() {
        if (destroyed) return;
        finalize({ is_exit: true, reason: "router_destroy" });
        destroyed = true;
        releaseOwner();
    }

    return {
        client,
        destroy,
        finalize,
        navigate,
    };
}

function installVueRouterAnalytics(controllerOrClient, router, options) {
    if (!router || typeof router.afterEach !== "function") throw new Error("Vue Router with afterEach is required");
    const settings = options || {};
    const existing = router[ROUTER_OWNER_KEY];
    if (existing) {
        if (existing.source === controllerOrClient) return existing.handle;
        throw new Error("analytics router owner already installed");
    }
    const controller = controllerOrClient && typeof controllerOrClient.navigate === "function" && controllerOrClient.client
        ? controllerOrClient
        : createNavigationController(Object.assign({}, settings, { client: controllerOrClient }));
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : {});
    const setTimer = runtime.setTimeout ? runtime.setTimeout.bind(runtime) : setTimeout;
    const clearTimer = runtime.clearTimeout ? runtime.clearTimeout.bind(runtime) : clearTimeout;
    let counter = 0;
    let timer = null;
    let destroyed = false;

    function schedule(route, previousRoute) {
        if (destroyed) return;
        counter += 1;
        const navigationId = "router:" + counter;
        if (timer) clearTimer(timer);
        timer = setTimer(function () {
            timer = null;
            controller.navigate(route, previousRoute, { navigation_id: navigationId });
        }, 0);
    }

    const removeAfterEach = router.afterEach(function (to, from, failure) {
        if (failure) return;
        schedule(to, from);
    });

    function currentRoute() {
        const value = router.currentRoute;
        return value && "value" in value ? value.value : value;
    }

    if (settings.captureInitial !== false && router.currentRoute) {
        const capture = function () {
            if (!destroyed && counter === 0) schedule(currentRoute(), null);
        };
        if (typeof router.isReady === "function") Promise.resolve(router.isReady()).then(capture).catch(function () {});
        else capture();
    }

    function pagehide() {
        controller.finalize({ is_exit: true, reason: "pagehide" });
        if (settings.flushBeaconOnPagehide !== false
            && controller.client
            && typeof controller.client.flushBeacon === "function") {
            controller.client.flushBeacon({ reason: "pagehide" });
        }
    }

    if (runtime && typeof runtime.addEventListener === "function") runtime.addEventListener("pagehide", pagehide);

    const handle = {
        controller,
        destroy: function () {
            if (destroyed) return;
            destroyed = true;
            if (timer) clearTimer(timer);
            timer = null;
            if (typeof removeAfterEach === "function") removeAfterEach();
            if (runtime && typeof runtime.removeEventListener === "function") runtime.removeEventListener("pagehide", pagehide);
            controller.destroy();
            try {
                delete router[ROUTER_OWNER_KEY];
            } catch (error) {
                router[ROUTER_OWNER_KEY] = null;
            }
        },
        navigate: controller.navigate,
    };
    router[ROUTER_OWNER_KEY] = { source: controllerOrClient, handle };
    return handle;
}

export {
    ROUTER_OWNER_KEY,
    createNavigationController,
    createNavigationInput,
    installVueRouterAnalytics,
};
