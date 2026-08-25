import { shouldIgnoreElement } from "./privacy.js";
import { clamp } from "./utils.js";

const TRACK_META_KEY = "__jx3boxAnalyticsTrack__";
const DEFAULT_SCROLL_THRESHOLDS = [25, 50, 75, 90, 100];

function findTrackElement(element) {
    let current = element;
    while (current && current.nodeType === 1) {
        if (current[TRACK_META_KEY] || (typeof current.hasAttribute === "function" && current.hasAttribute("data-track-id"))) return current;
        current = current.parentElement;
    }
    return null;
}

function readTrackDefinition(element, type) {
    const tracked = findTrackElement(element);
    if (!tracked) return { element: null, definition: null, targetKey: "" };
    const definitions = tracked[TRACK_META_KEY] || {};
    return {
        element: tracked,
        definition: definitions[type] || null,
        targetKey: typeof tracked.getAttribute === "function" ? tracked.getAttribute("data-track-id") || "" : "",
    };
}

function getDocumentMetrics(runtime) {
    const documentObject = runtime.document;
    const root = documentObject && documentObject.documentElement;
    const body = documentObject && documentObject.body;
    return {
        viewportWidth: Math.max(Number(runtime.innerWidth) || 0, Number(root && root.clientWidth) || 0, 1),
        viewportHeight: Math.max(Number(runtime.innerHeight) || 0, Number(root && root.clientHeight) || 0, 1),
        documentWidth: Math.max(Number(root && root.scrollWidth) || 0, Number(body && body.scrollWidth) || 0, 1),
        documentHeight: Math.max(Number(root && root.scrollHeight) || 0, Number(body && body.scrollHeight) || 0, 1),
        scrollX: Math.max(Number(runtime.scrollX || runtime.pageXOffset) || 0, 0),
        scrollY: Math.max(Number(runtime.scrollY || runtime.pageYOffset) || 0, 0),
    };
}

function getClickPosition(event, trackedElement, runtime) {
    const metrics = getDocumentMetrics(runtime);
    const clientX = Number(event.clientX) || 0;
    const clientY = Number(event.clientY) || 0;
    const position = {
        viewport_x_ratio: clamp(clientX / metrics.viewportWidth, 0, 1),
        viewport_y_ratio: clamp(clientY / metrics.viewportHeight, 0, 1),
        page_x_ratio: clamp((clientX + metrics.scrollX) / metrics.documentWidth, 0, 1),
        page_y_ratio: clamp((clientY + metrics.scrollY) / metrics.documentHeight, 0, 1),
        viewport_width: metrics.viewportWidth,
        viewport_height: metrics.viewportHeight,
        document_width: metrics.documentWidth,
        document_height: metrics.documentHeight,
        scroll_x: metrics.scrollX,
        scroll_y: metrics.scrollY,
    };
    if (trackedElement && typeof trackedElement.getBoundingClientRect === "function") {
        const rect = trackedElement.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
            position.target_x_ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
            position.target_y_ratio = clamp((clientY - rect.top) / rect.height, 0, 1);
        }
    }
    return position;
}

function installAutoCapture(client, options) {
    const settings = options || {};
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : null);
    const documentObject = runtime && runtime.document;
    if (!runtime || !documentObject || typeof documentObject.addEventListener !== "function") {
        return { destroy: function () {}, resetScroll: function () {} };
    }
    const thresholds = settings.scrollThresholds || DEFAULT_SCROLL_THRESHOLDS;
    let reached = new Set();
    let lastBeaconAt = 0;

    function handleClick(event) {
        if (!client.isActive() || shouldIgnoreElement(event.target)) return;
        const tracked = readTrackDefinition(event.target, "click");
        const definition = tracked.definition || {};
        const keyboardTriggered = Number(event.detail) === 0 && Number(event.clientX) === 0 && Number(event.clientY) === 0;
        const position = keyboardTriggered ? undefined : getClickPosition(event, tracked.element, runtime);
        if (definition.once && definition.__sent) {
            client.track("click", {
                target_key: tracked.targetKey,
                position,
            });
            return;
        }
        const eventId = client.track("click", {
            event_name: definition.name,
            target_key: definition.id || tracked.targetKey,
            target_type: definition.target_type,
            target_id: definition.target_id,
            properties: definition.props || definition.properties,
            position,
        });
        if (eventId && definition.once) definition.__sent = true;
    }

    function handleScroll() {
        if (!client.isActive()) return;
        const metrics = getDocumentMetrics(runtime);
        const scrollable = Math.max(metrics.documentHeight - metrics.viewportHeight, 0);
        if (scrollable <= 0) return;
        const depth = clamp(((metrics.scrollY + metrics.viewportHeight) / metrics.documentHeight) * 100, 0, 100);
        thresholds.forEach(function (threshold) {
            if (depth >= threshold && !reached.has(threshold)) {
                reached.add(threshold);
                client.track("scroll_depth", {
                    event_name: "scroll_depth",
                    properties: { depth_percent: threshold },
                    position: {
                        viewport_width: metrics.viewportWidth,
                        viewport_height: metrics.viewportHeight,
                        document_width: metrics.documentWidth,
                        document_height: metrics.documentHeight,
                        scroll_x: metrics.scrollX,
                        scroll_y: metrics.scrollY,
                    },
                });
            }
        });
    }

    function flushBeacon() {
        const current = Date.now();
        if (current - lastBeaconAt < 1000) return;
        lastBeaconAt = current;
        client.flushBeacon();
    }

    function handleVisibility() {
        if (documentObject.visibilityState === "hidden") flushBeacon();
    }

    function resetScroll() {
        reached = new Set();
    }

    documentObject.addEventListener("click", handleClick, true);
    runtime.addEventListener("scroll", handleScroll, { passive: true });
    runtime.addEventListener("pagehide", flushBeacon);
    documentObject.addEventListener("visibilitychange", handleVisibility);
    const unsubscribe = client.onPageChange(resetScroll);

    return {
        destroy: function () {
            documentObject.removeEventListener("click", handleClick, true);
            runtime.removeEventListener("scroll", handleScroll, { passive: true });
            runtime.removeEventListener("pagehide", flushBeacon);
            documentObject.removeEventListener("visibilitychange", handleVisibility);
            unsubscribe();
        },
        resetScroll,
    };
}

export { DEFAULT_SCROLL_THRESHOLDS, TRACK_META_KEY, getClickPosition, installAutoCapture, readTrackDefinition };
