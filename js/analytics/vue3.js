import { TRACK_META_KEY, installAutoCapture } from "./heatmap.js";
import { installVueRouterAnalytics } from "./navigation.js";
import { sanitizeKey } from "./privacy.js";
import { clamp } from "./utils.js";

const EXPOSURE_STATE_KEY = "__jx3boxAnalyticsExposure__";

function normalizeTrackValue(value) {
    if (typeof value === "string") return { name: value };
    if (!value || typeof value !== "object") return {};
    const interactionTarget = value.interaction_target || value.interactionTarget || {};
    return {
        name: value.name || value.event_name,
        id: value.id || value.target_key || interactionTarget.key,
        target_type: value.target_type || interactionTarget.type,
        target_id: value.target_id || interactionTarget.id,
        props: value.props || value.properties,
    };
}

function normalizePageValue(value, runtime) {
    const source = typeof value === "string" ? { page_key: value } : Object.assign({}, value || {});
    if (!source.page_key) source.page_key = source.id;
    if (!source.route_path && runtime && runtime.location) source.route_path = runtime.location.pathname;
    if (!source.route_pattern) source.route_pattern = source.path || source.route_path;
    return source;
}

function pageSignature(page) {
    const eventTypes = page.event_types || page.eventTypes;
    const propertyKeys = page.property_keys || page.propertyKeys;
    return [
        page.page_key,
        page.route_name,
        page.route_pattern,
        page.route_path,
        page.layout_version || page.layoutVersion,
        page.sample_rate === undefined ? page.sampleRate : page.sample_rate,
        Array.isArray(eventTypes) ? eventTypes.join(",") : "",
        Array.isArray(propertyKeys) ? propertyKeys.join(",") : "",
    ].join("|");
}

function visibleRatio(element, runtime) {
    if (!element || typeof element.getBoundingClientRect !== "function") return 0;
    const rect = element.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return 0;
    const viewportWidth = Math.max(Number(runtime.innerWidth) || 0, Number(runtime.document && runtime.document.documentElement && runtime.document.documentElement.clientWidth) || 0);
    const viewportHeight = Math.max(Number(runtime.innerHeight) || 0, Number(runtime.document && runtime.document.documentElement && runtime.document.documentElement.clientHeight) || 0);
    const width = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    return width * height / (rect.width * rect.height);
}

function destroyExposure(element) {
    const state = element && element[EXPOSURE_STATE_KEY];
    if (!state) return;
    if (state.timer) state.clearTimeout(state.timer);
    if (state.observer) state.observer.disconnect();
    if (state.check) {
        state.runtime.removeEventListener("scroll", state.check);
        state.runtime.removeEventListener("resize", state.check);
    }
    if (state.visibilityHandler && state.runtime.document && typeof state.runtime.document.removeEventListener === "function") {
        state.runtime.document.removeEventListener("visibilitychange", state.visibilityHandler);
    }
    if (state.unsubscribePage) state.unsubscribePage();
    delete element[EXPOSURE_STATE_KEY];
}

function createExposureSignature(definition, binding, threshold, delay) {
    let properties = "";
    try {
        properties = JSON.stringify(definition.props || {}) || "";
    } catch (error) {
        properties = "[unserializable]";
    }
    return [
        definition.name,
        definition.id,
        definition.target_type,
        definition.target_id,
        properties,
        threshold,
        delay,
        !!(binding.modifiers && binding.modifiers.once),
    ].join("|");
}

function installExposure(element, binding, client, runtime, defaults) {
    const definition = normalizeTrackValue(binding.value);
    const threshold = clamp(Number(definition.props && definition.props.visibility_ratio) || defaults.exposureThreshold || 0.5, 0.01, 1);
    const delay = clamp(Number(definition.props && definition.props.duration_ms) || defaults.exposureDurationMs || 1000, 0, 60 * 1000);
    const signature = createExposureSignature(definition, binding, threshold, delay);
    const previousState = element && element[EXPOSURE_STATE_KEY];
    if (previousState && previousState.signature === signature) return;
    const sentPageViews = previousState ? previousState.sentPageViews : new Set();
    destroyExposure(element);
    const setTimer = runtime.setTimeout ? runtime.setTimeout.bind(runtime) : setTimeout;
    const clearTimer = runtime.clearTimeout ? runtime.clearTimeout.bind(runtime) : clearTimeout;
    const state = {
        runtime,
        clearTimeout: clearTimer,
        timer: null,
        observer: null,
        check: null,
        sentPageViews,
        signature,
        unsubscribePage: null,
        visibilityHandler: null,
        visible: false,
    };

    function currentPageViewId() {
        const page = client.getState().page;
        return page && page.page_view_id;
    }

    function cancel() {
        state.visible = false;
        if (state.timer) clearTimer(state.timer);
        state.timer = null;
    }

    function commit() {
        const pageViewId = currentPageViewId();
        if (!state.visible || !pageViewId) return;
        if (runtime.document && runtime.document.visibilityState === "hidden") {
            cancel();
            return;
        }
        if (binding.modifiers && binding.modifiers.once && state.sentPageViews.has(pageViewId)) return;
        const eventId = client.track("exposure", {
            event_name: definition.name || "element_exposure",
            target_key: definition.id || (element.getAttribute && element.getAttribute("data-track-id")),
            target_type: definition.target_type,
            target_id: definition.target_id,
            properties: definition.props,
        });
        if (eventId) state.sentPageViews.add(pageViewId);
    }

    function setVisible(isVisible) {
        if (!isVisible) {
            cancel();
            return;
        }
        if (state.visible && state.timer) return;
        state.visible = true;
        state.timer = setTimer(function () {
            state.timer = null;
            commit();
        }, delay);
    }

    state.visibilityHandler = function () {
        if (runtime.document && runtime.document.visibilityState === "hidden") {
            cancel();
            return;
        }
        setVisible(visibleRatio(element, runtime) >= threshold);
    };
    if (runtime.document && typeof runtime.document.addEventListener === "function") {
        runtime.document.addEventListener("visibilitychange", state.visibilityHandler);
    }
    state.unsubscribePage = client.onPageChange(function (activePage) {
        cancel();
        if (activePage) setVisible(visibleRatio(element, runtime) >= threshold);
    });

    function installFallback() {
        state.check = function () {
            setVisible(visibleRatio(element, runtime) >= threshold);
        };
        runtime.addEventListener("scroll", state.check, { passive: true });
        runtime.addEventListener("resize", state.check);
        state.check();
    }

    if (typeof runtime.IntersectionObserver === "function") {
        try {
            state.observer = new runtime.IntersectionObserver(function (entries) {
                const entry = entries && entries[0];
                setVisible(!!entry && entry.isIntersecting && entry.intersectionRatio >= threshold);
            }, { threshold: [threshold] });
            state.observer.observe(element);
        } catch (error) {
            state.observer = null;
            installFallback();
        }
    } else {
        installFallback();
    }

    element[EXPOSURE_STATE_KEY] = state;
}

function createVue3AnalyticsPlugin(client, options) {
    if (!client || typeof client.track !== "function") throw new Error("analytics client is required");
    const settings = options || {};
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : {});
    const routerHandle = settings.router
        ? installVueRouterAnalytics(settings.navigationController || client, settings.router, Object.assign({}, settings, {
            // Router owns pagehide finalization and its subsequent Beacon.
            runtime,
        }))
        : null;
    const autoCapture = installAutoCapture(client, {
        // Keep visibilitychange fallback, but do not install a second pagehide
        // listener when Router already owns finalization + Beacon ordering.
        flushBeaconOnPagehide: !routerHandle,
        runtime,
        scrollThresholds: settings.scrollThresholds,
    });

    function isRouterMode() {
        if (settings.routerMode === true || settings.navigationMode === "router" || settings.router) return true;
        return typeof client.getNavigationOwner === "function" && client.getNavigationOwner() === "router";
    }

    function bindPageMetadata(element, page) {
        if (typeof client.setPageMetadata === "function") client.setPageMetadata(element, page);
    }

    function unbindPageMetadata(element) {
        if (typeof client.removePageMetadata === "function") client.removePageMetadata(element);
    }

    const trackPageDirective = {
        mounted: function (element, binding) {
            const page = normalizePageValue(binding.value, runtime);
            element.__jx3boxAnalyticsPageSignature__ = pageSignature(page);
            element.__jx3boxAnalyticsPageKey__ = page.page_key;
            if (isRouterMode()) bindPageMetadata(element, page);
            else client.enterPage(page);
        },
        updated: function (element, binding) {
            const page = normalizePageValue(binding.value, runtime);
            const signature = pageSignature(page);
            if (signature === element.__jx3boxAnalyticsPageSignature__) return;
            element.__jx3boxAnalyticsPageSignature__ = signature;
            element.__jx3boxAnalyticsPageKey__ = page.page_key;
            if (isRouterMode()) bindPageMetadata(element, page);
            else client.enterPage(page);
        },
        beforeUnmount: function (element) {
            if (isRouterMode()) unbindPageMetadata(element);
            else client.leavePage(element.__jx3boxAnalyticsPageKey__);
            delete element.__jx3boxAnalyticsPageSignature__;
            delete element.__jx3boxAnalyticsPageKey__;
        },
    };

    const trackIdDirective = {
        mounted: function (element, binding) {
            const value = sanitizeKey(binding.value, 128);
            if (value) element.setAttribute("data-track-id", value);
        },
        updated: function (element, binding) {
            const value = sanitizeKey(binding.value, 128);
            if (value) element.setAttribute("data-track-id", value);
            else element.removeAttribute("data-track-id");
        },
        beforeUnmount: function (element) {
            element.removeAttribute("data-track-id");
        },
    };

    const trackDirective = {
        mounted: function (element, binding) {
            const type = binding.arg || "click";
            if (type === "exposure") {
                installExposure(element, binding, client, runtime, settings);
                return;
            }
            if (!element[TRACK_META_KEY]) element[TRACK_META_KEY] = {};
            element[TRACK_META_KEY][type] = Object.assign(normalizeTrackValue(binding.value), {
                once: !!(binding.modifiers && binding.modifiers.once),
            });
        },
        updated: function (element, binding) {
            const type = binding.arg || "click";
            if (type === "exposure") {
                installExposure(element, binding, client, runtime, settings);
                return;
            }
            if (!element[TRACK_META_KEY]) element[TRACK_META_KEY] = {};
            const previous = element[TRACK_META_KEY][type];
            const next = Object.assign(normalizeTrackValue(binding.value), {
                once: !!(binding.modifiers && binding.modifiers.once),
            });
            if (previous && previous.__sent && next.once) next.__sent = true;
            element[TRACK_META_KEY][type] = next;
        },
        beforeUnmount: function (element, binding) {
            const type = binding.arg || "click";
            if (type === "exposure") destroyExposure(element);
            if (element[TRACK_META_KEY]) {
                delete element[TRACK_META_KEY][type];
                if (!Object.keys(element[TRACK_META_KEY]).length) delete element[TRACK_META_KEY];
            }
        },
    };

    return {
        install: function (app) {
            app.directive("track-page", trackPageDirective);
            app.directive("track-id", trackIdDirective);
            app.directive("track", trackDirective);
            if (app.config && app.config.globalProperties) app.config.globalProperties.$analytics = client;
            if (typeof app.provide === "function") app.provide("analytics", client);
        },
        destroy: function () {
            if (routerHandle) routerHandle.destroy();
            autoCapture.destroy();
            client.destroy();
        },
        directives: {
            trackPage: trackPageDirective,
            trackId: trackIdDirective,
            track: trackDirective,
        },
    };
}

export { createVue3AnalyticsPlugin, destroyExposure, installExposure, normalizePageValue, normalizeTrackValue };
