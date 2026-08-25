export { SCHEMA_VERSION, SDK_VERSION, createAnalytics, createAnalyticsCore } from "./analytics/client.js";
export { createIdentity, normalizeInstanceId, resolveInstanceId } from "./analytics/identity.js";
export { DEFAULT_SCROLL_THRESHOLDS, TRACK_META_KEY, getClickPosition, installAutoCapture } from "./analytics/heatmap.js";
export { createPageRegistry, createRemotePageResolver, normalizePageDefinition } from "./analytics/registry.js";
export { ROUTER_OWNER_KEY, createNavigationController, createNavigationInput, installVueRouterAnalytics } from "./analytics/navigation.js";
export { DELIVERY_STATES, createEventQueue } from "./analytics/queue.js";
export { createQueueStorage } from "./analytics/storage.js";
export {
    createHttpSink,
    createTrackingSink,
    createTrafficSink,
    defaultAckDecoder,
    defaultRetryPolicy,
    projectTrackingEvent,
    projectTrafficEvent,
    trafficPartition,
} from "./analytics/sinks.js";
export { createTransport } from "./analytics/transport.js";
export { normalizeRoutePath as sanitizeRoutePath, normalizeRoutePattern as sanitizeRoutePattern, sanitizeCanonicalPath, sanitizeInteractionTarget, sanitizeProperties, sanitizePublicTarget, shouldIgnoreElement } from "./analytics/privacy.js";
export { PUBLIC_TARGET_VALIDATORS, createCompositeRuleResolver, createRemoteRuleResolver, createRuleRequestContext, extractRoutePattern, normalizePathParamRules, normalizeQueryTargetRules, resolveCanonicalPath, resolvePublicTarget } from "./analytics/rules.js";
export { createUuid, normalizeSampleRate, shouldSample, stableSampleScore } from "./analytics/utils.js";
export { createVue3AnalyticsPlugin } from "./analytics/vue3.js";
