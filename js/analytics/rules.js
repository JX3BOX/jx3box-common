import { TARGET_ID_VALIDATORS, normalizeRoutePattern, sanitizeCanonicalPath, sanitizeKey, sanitizePublicTarget } from "./privacy.js";
import { clamp, compactObject } from "./utils.js";

const PUBLIC_TARGET_VALIDATORS = Object.freeze({
    positive_int: function (value) {
        return /^[1-9][0-9]{0,18}$/.test(value);
    },
    nonnegative_int: function (value) {
        return /^(?:0|[1-9][0-9]{0,18})$/.test(value);
    },
    digits: function (value) {
        return /^[0-9]{1,64}$/.test(value);
    },
    digits_underscore: TARGET_ID_VALIDATORS.digits_underscore,
    digits_or_underscore: TARGET_ID_VALIDATORS.digits_or_underscore,
    positive_integer: TARGET_ID_VALIDATORS.positive_integer,
    bounded_slug: function (value) {
        return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value);
    },
    safe_short_id: TARGET_ID_VALIDATORS.safe_short_id,
    safe_slug: TARGET_ID_VALIDATORS.safe_slug,
    safe_key: function (value) {
        return /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value);
    },
    year: function (value) {
        return /^20[0-9]{2}$/.test(value);
    },
});

function normalizeEventTypes(value, fallback) {
    const source = Array.isArray(value) ? value : (fallback || []);
    return source.map(function (type) {
        return sanitizeKey(type, 32);
    }).filter(Boolean);
}

function normalizeSampleRate(rule) {
    if (!rule || typeof rule !== "object") return NaN;
    if (rule.sample_rate_bps === undefined && rule.sample_rate === undefined && rule.sampleRate === undefined) return NaN;
    const raw = rule.sample_rate_bps !== undefined
        ? Number(rule.sample_rate_bps) / 10000
        : Number(rule.sample_rate === undefined ? rule.sampleRate : rule.sample_rate);
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) return NaN;
    return clamp(raw, 0, 1);
}

function normalizeQueryTargetRule(value) {
    const source = value || {};
    const queryKey = sanitizeKey(source.query_key || source.queryKey || source.id_key || source.idKey || source.key, 64);
    const targetType = sanitizeKey(source.target_type || source.targetType || source.type, 64);
    const validator = sanitizeKey(source.validator, 32);
    const typeQueryKey = sanitizeKey(source.type_query_key || source.typeQueryKey || source.type_key || source.typeKey, 64);
    const rawVariants = source.variants || source.target_type_map || source.targetTypeMap || {};
    const variants = {};
    Object.keys(rawVariants).forEach(function (rawVariant) {
        const rawDefinition = rawVariants[rawVariant];
        const definition = typeof rawDefinition === "string" ? { type: rawDefinition } : (rawDefinition || {});
        const name = sanitizeKey(rawVariant, 32);
        const type = sanitizeKey(definition.type || definition.target_type || rawDefinition, 64);
        const namedValidator = sanitizeKey(definition.validator || validator, 32);
        if (!name || !type || !PUBLIC_TARGET_VALIDATORS[namedValidator]) return;
        variants[name] = { type, validator: namedValidator, variant: name };
        (Array.isArray(definition.aliases) ? definition.aliases : []).forEach(function (alias) {
            const safeAlias = sanitizeKey(alias, 32);
            if (safeAlias || alias === "") variants[safeAlias] = { type, validator: namedValidator, variant: name };
        });
    });
    const defaultVariant = sanitizeKey(source.default_variant || source.defaultVariant, 32);
    const transforms = (Array.isArray(source.transforms) ? source.transforms : []).map(function (transform) {
        const when = transform && transform.when || {};
        const suffix = String(when.id_suffix || transform.id_suffix || "");
        const stripSuffix = String(transform.strip_id_suffix || transform.stripIdSuffix || "");
        const variant = sanitizeKey(when.variant || transform.variant, 32);
        const type = sanitizeKey(transform.type || transform.target_type, 64);
        if (!variant || !suffix || !type || suffix.length > 32 || stripSuffix.length > 32) return null;
        return { variant, id_suffix: suffix, strip_id_suffix: stripSuffix, type };
    }).filter(Boolean);
    if (!queryKey || (!targetType && !Object.keys(variants).length) || (!Object.keys(variants).length && !PUBLIC_TARGET_VALIDATORS[validator])) return null;
    return {
        query_key: queryKey,
        target_type: targetType,
        validator,
        type_query_key: typeQueryKey,
        default_variant: defaultVariant,
        variants,
        transforms,
        required: source.required === true,
    };
}

function normalizeSecondaryRule(value) {
    const source = value || {};
    const from = sanitizeKey(source.from, 16);
    if (from !== "query" && from !== "path") return null;
    const field = sanitizeKey(source.field, 32);
    const queryKey = sanitizeKey(source.query_key || source.queryKey || source.key, 64);
    const validator = sanitizeKey(source.validator, 32);
    if (field !== "revision_id" || !queryKey || !PUBLIC_TARGET_VALIDATORS[validator]) return null;
    return { field, from, key: queryKey, validator };
}

function normalizePathTargetRule(value) {
    const source = value || {};
    if (source.from !== "path") return null;
    const key = sanitizeKey(source.key || source.path_key || source.pathKey, 64);
    const type = sanitizeKey(source.type || source.target_type || source.targetType, 64);
    const validator = sanitizeKey(source.validator, 32);
    if (!key || !type || !PUBLIC_TARGET_VALIDATORS[validator]) return null;
    return { from: "path", key, type, validator };
}

function normalizeAllowedPathValues(value) {
    const source = Array.isArray(value) ? value : [];
    return source.map(function (item) {
        const text = String(item === undefined || item === null ? "" : item).trim();
        return /^[a-zA-Z0-9._~-]{1,128}$/.test(text) ? text : "";
    }).filter(Boolean).slice(0, 200);
}

function normalizePathParamDefinition(value, fallbackKey) {
    const source = typeof value === "string" ? { validator: value } : (value || {});
    const key = sanitizeKey(source.key || source.name || fallbackKey, 64);
    const validator = sanitizeKey(source.validator, 32);
    const allowedValues = normalizeAllowedPathValues(source.allowed_values || source.allowedValues || source.values);
    if (!key || (!PUBLIC_TARGET_VALIDATORS[validator] && !allowedValues.length)) return null;
    return {
        key,
        validator: PUBLIC_TARGET_VALIDATORS[validator] ? validator : "",
        allowed_values: allowedValues,
    };
}

function normalizePathParamRules(rule, pathTarget, secondary) {
    const source = rule || {};
    const normalizedPathTarget = pathTarget || normalizePathTargetRule(source.target || source.public_target || source.publicTarget);
    const normalizedSecondary = secondary || normalizeSecondaryRule(source.secondary);
    const byKey = new Map();
    function add(value, fallbackKey, overwrite) {
        const definition = normalizePathParamDefinition(value, fallbackKey);
        if (!definition || (!overwrite && byKey.has(definition.key))) return;
        byKey.set(definition.key, definition);
    }
    const configured = source.path_params || source.pathParams || source.path_param_rules || source.pathParamRules;
    if (Array.isArray(configured)) configured.forEach(function (value) { add(value, "", true); });
    else if (configured && typeof configured === "object") {
        Object.keys(configured).forEach(function (key) { add(configured[key], key, true); });
    }
    const constraints = source.constraints;
    if (constraints && typeof constraints === "object") {
        Object.keys(constraints).forEach(function (key) { add(constraints[key], key, false); });
    }
    if (normalizedPathTarget) {
        add({ key: normalizedPathTarget.key, validator: normalizedPathTarget.validator }, normalizedPathTarget.key, false);
    }
    if (normalizedSecondary && normalizedSecondary.from === "path") {
        add({ key: normalizedSecondary.key, validator: normalizedSecondary.validator }, normalizedSecondary.key, false);
    }
    return Array.from(byKey.values());
}

function readPathValue(rawParams, key) {
    if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) return "";
    const value = rawParams[key];
    if (Array.isArray(value)) return value.length === 1 ? String(value[0] === undefined ? "" : value[0]).trim() : "";
    return value === undefined || value === null ? "" : String(value).trim();
}

function validatePathValue(value, definition) {
    if (!value || !definition) return false;
    if (definition.allowed_values.indexOf(value) >= 0) return true;
    const validator = PUBLIC_TARGET_VALIDATORS[definition.validator];
    return !!validator && validator(value);
}

function resolveCanonicalPath(rawParams, routePattern, pathParamRules) {
    const pattern = normalizeRoutePattern(routePattern);
    if (!pattern) return "";
    const definitions = new Map((Array.isArray(pathParamRules) ? pathParamRules : []).map(function (definition) {
        return [definition.key, definition];
    }));
    const output = [];
    const segments = pattern.split("/").filter(Boolean);
    for (const segment of segments) {
        if (segment === "*" || segment === "**") {
            output.push(segment);
            continue;
        }
        const matched = segment.match(/^:([a-zA-Z_][a-zA-Z0-9_]*)(\?)?$/);
        if (!matched) {
            output.push(segment);
            continue;
        }
        const value = readPathValue(rawParams, matched[1]);
        if (!value && matched[2]) continue;
        const definition = definitions.get(matched[1]);
        if (!validatePathValue(value, definition)) return "";
        output.push(encodeURIComponent(value));
    }
    return sanitizeCanonicalPath("/" + output.join("/"));
}

function resolvePathPublicTarget(rawRoute, rule) {
    const pathTarget = rule && rule.path_target;
    if (!pathTarget) return undefined;
    const params = rawRoute && rawRoute.params;
    const id = readPathValue(params, pathTarget.key);
    if (!PUBLIC_TARGET_VALIDATORS[pathTarget.validator](id)) return undefined;
    const target = sanitizePublicTarget({ key: pathTarget.key, type: pathTarget.type, id });
    const secondary = rule.secondary;
    if (!target || !secondary) return target;
    const secondaryValue = secondary.from === "path"
        ? readPathValue(params, secondary.key)
        : readQueryValue(rawRoute && (rawRoute.query || rawRoute.raw_query), secondary.key).trim();
    if (secondaryValue && PUBLIC_TARGET_VALIDATORS[secondary.validator](secondaryValue)) {
        target.revision_id = secondaryValue;
    }
    return target;
}

function normalizeInteractionTargetRules(rule) {
    const source = rule && (rule.interaction_target_rules || rule.interactionTargetRules || rule.interaction_targets || rule.interactionTargets);
    return (Array.isArray(source) ? source : []).map(function (value) {
        const definition = value || {};
        const validator = sanitizeKey(definition.validator, 32);
        const allowedIds = (Array.isArray(definition.allowed_ids || definition.allowedIds) ? (definition.allowed_ids || definition.allowedIds) : [])
            .map(function (id) { return sanitizeKey(id, 128); }).filter(Boolean);
        if (!allowedIds.length && !TARGET_ID_VALIDATORS[validator]) return null;
        return {
            target_key: sanitizeKey(definition.target_key || definition.targetKey || definition.key, 128),
            target_type: sanitizeKey(definition.target_type || definition.targetType || definition.type, 64),
            validator,
            allowed_ids: allowedIds,
        };
    }).filter(Boolean);
}

function normalizeQueryTargetRules(rule) {
    if (!rule || typeof rule !== "object") return [];
    let source = rule.query_targets || rule.queryTargets || rule.target_query_rules || rule.targetQueryRules;
    if (!source && rule.public_target) source = [rule.public_target];
    if (!source && rule.target && (rule.target.from === "query" || rule.target.from === "query_variant")) {
        source = [Object.assign({}, rule.target, {
            query_key: rule.target.id_key || rule.target.key,
            target_type: rule.target.type,
            type_query_key: rule.target.type_key,
        })];
    }
    if (!source && rule.target_query) {
        source = Object.keys(rule.target_query).map(function (key) {
            return Object.assign({ query_key: key }, rule.target_query[key] || {});
        });
    }
    return (Array.isArray(source) ? source : []).map(normalizeQueryTargetRule).filter(Boolean);
}

function readQueryValue(rawQuery, key) {
    if (!rawQuery) return "";
    if (typeof rawQuery === "string") {
        const query = rawQuery.charAt(0) === "?" ? rawQuery.slice(1) : rawQuery;
        const pairs = query.split("&");
        let found = "";
        pairs.some(function (pair) {
            const separator = pair.indexOf("=");
            const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
            let decodedKey = "";
            try {
                decodedKey = decodeURIComponent(rawKey.replace(/\+/g, " "));
            } catch (error) {
                return false;
            }
            if (decodedKey !== key) return false;
            const rawValue = separator >= 0 ? pair.slice(separator + 1) : "";
            try {
                found = decodeURIComponent(rawValue.replace(/\+/g, " "));
            } catch (error) {
                found = "";
            }
            return true;
        });
        return found;
    }
    if (typeof rawQuery !== "object" || Array.isArray(rawQuery)) return "";
    const value = rawQuery[key];
    if (Array.isArray(value)) return value.length === 1 ? String(value[0] === undefined ? "" : value[0]) : "";
    return value === undefined || value === null ? "" : String(value);
}

function resolvePublicTarget(rawQuery, rule) {
    const definitions = normalizeQueryTargetRules(rule);
    let target;
    let missingRequired = false;
    definitions.some(function (definition) {
        let value = readQueryValue(rawQuery, definition.query_key).trim();
        if (!value) {
            if (definition.required) missingRequired = true;
            return false;
        }
        let targetType = definition.target_type;
        let validator = definition.validator;
        let variantName = "";
        if (Object.keys(definition.variants).length) {
            const rawVariant = definition.type_query_key ? readQueryValue(rawQuery, definition.type_query_key).trim() : "";
            const selected = definition.variants[rawVariant || definition.default_variant || ""];
            if (!selected) {
                if (definition.required) missingRequired = true;
                return false;
            }
            targetType = selected.type;
            validator = selected.validator;
            variantName = selected.variant;
            definition.transforms.some(function (transform) {
                if (transform.variant !== variantName || value.slice(-transform.id_suffix.length) !== transform.id_suffix) return false;
                targetType = transform.type;
                if (transform.strip_id_suffix && value.slice(-transform.strip_id_suffix.length) === transform.strip_id_suffix) {
                    value = value.slice(0, -transform.strip_id_suffix.length);
                }
                return true;
            });
        }
        if (!PUBLIC_TARGET_VALIDATORS[validator] || !PUBLIC_TARGET_VALIDATORS[validator](value)) {
            if (definition.required) missingRequired = true;
            return false;
        }
        target = sanitizePublicTarget({
            key: definition.query_key,
            type: targetType,
            id: value,
            variant: variantName,
        });
        return !!target;
    });
    if (missingRequired) return null;
    if (target && rule && rule.secondary) {
        const secondary = rule.secondary;
        const revisionId = secondary && secondary.from === "query"
            ? readQueryValue(rawQuery, secondary.key).trim()
            : "";
        if (revisionId && PUBLIC_TARGET_VALIDATORS[secondary.validator](revisionId)) {
            target.revision_id = revisionId;
        }
    }
    return target || undefined;
}

function extractRoutePattern(route) {
    const source = route || {};
    const matched = Array.isArray(source.matched) ? source.matched : [];
    const record = matched.length ? matched[matched.length - 1] : null;
    const meta = source.meta && typeof source.meta === "object" ? source.meta : {};
    const analyticsMeta = meta.analytics && typeof meta.analytics === "object" ? meta.analytics : {};
    const raw = analyticsMeta.route_pattern || analyticsMeta.routePattern || (record && record.path) || source.route_pattern || source.routePattern;
    if (!raw) return "";
    return normalizeRoutePattern(raw);
}

function createRuleRequestContext(input) {
    const source = input || {};
    const route = source.route || source;
    const meta = route.meta && typeof route.meta === "object" ? route.meta : {};
    const analyticsMeta = meta.analytics && typeof meta.analytics === "object" ? meta.analytics : {};
    return compactObject({
        page_key: sanitizeKey(source.page_key || source.pageKey || analyticsMeta.page_key || analyticsMeta.pageKey, 128),
        route_name: sanitizeKey(source.route_name || source.routeName || route.name, 128),
        route_pattern: extractRoutePattern(route) || (source.route_pattern || source.routePattern ? normalizeRoutePattern(source.route_pattern || source.routePattern) : ""),
        layout_version: sanitizeKey(source.layout_version || source.layoutVersion || analyticsMeta.layout_version || analyticsMeta.layoutVersion, 64),
        project: sanitizeKey(source.project, 64),
        product: sanitizeKey(source.product, 64),
        surface: sanitizeKey(source.surface || source.client, 32),
        client: sanitizeKey(source.client || source.surface, 32),
        game_client: sanitizeKey(source.game_client || source.gameClient, 16),
        domain: sanitizeKey(source.domain, 128),
    });
}

function normalizeSinkRule(key, raw, request) {
    if (raw && Object.prototype.hasOwnProperty.call(raw, "code") && Number(raw.code) !== 0) return null;
    const source = raw && Object.prototype.hasOwnProperty.call(raw, "data") ? raw.data : raw;
    if (!source || typeof source !== "object" || source.enabled !== true) return null;
    if (key === "traffic" && (!request.project || !request.surface)) return null;
    const eventTypes = normalizeEventTypes(source.event_types || source.eventTypes, []);
    if (eventTypes.indexOf("page_view") < 0) return null;
    const sampleRate = normalizeSampleRate(source);
    if (!Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) return null;
    const routePattern = normalizeRoutePattern(source.route_pattern || source.routePattern || "");
    if (!routePattern || (request.route_pattern && routePattern !== request.route_pattern)) return null;
    const pageKey = sanitizeKey(source.page_key || source.pageKey, 128);
    if (!pageKey || (request.page_key && pageKey !== request.page_key)) return null;
    const ruleVersion = sanitizeKey(source.rule_version || source.ruleVersion, 64);
    if (!ruleVersion) return null;
    const propertyKeys = Array.isArray(source.property_keys || source.propertyKeys)
        ? (source.property_keys || source.propertyKeys).map(function (item) { return sanitizeKey(item, 64); }).filter(Boolean)
        : [];
    const pathTarget = normalizePathTargetRule(source.target || source.public_target || source.publicTarget);
    const secondary = normalizeSecondaryRule(source.secondary);
    return {
        key,
        enabled: true,
        page_key: pageKey,
        route_pattern: routePattern,
        layout_version: sanitizeKey(source.layout_version || source.layoutVersion || request.layout_version, 64),
        event_types: eventTypes,
        property_keys: propertyKeys,
        sample_rate: sampleRate,
        rule_version: ruleVersion,
        require_public_target: source.require_public_target === true || source.requirePublicTarget === true,
        query_targets: normalizeQueryTargetRules(source),
        path_target: pathTarget,
        path_params: normalizePathParamRules(source, pathTarget, secondary),
        secondary,
        interaction_target_rules: normalizeInteractionTargetRules(source),
    };
}

function normalizeResolverEntries(options) {
    const source = Array.isArray(options) ? options : ((options && options.resolvers) || options || {});
    if (Array.isArray(source)) {
        return source.map(function (entry) {
            if (typeof entry === "function") return null;
            return entry && {
                key: sanitizeKey(entry.key || entry.id, 32),
                resolve: entry.resolve || entry.resolver,
            };
        }).filter(function (entry) { return entry && entry.key && typeof entry.resolve === "function"; });
    }
    return Object.keys(source).map(function (key) {
        const value = source[key];
        return {
            key: sanitizeKey(key, 32),
            resolve: typeof value === "function" ? value : value && (value.resolve || value.resolver),
        };
    }).filter(function (entry) { return entry.key && typeof entry.resolve === "function"; });
}

function createCompositeRuleResolver(options) {
    const entries = normalizeResolverEntries(options);

    async function resolve(input) {
        const request = createRuleRequestContext(input);
        if (!request.route_pattern || !entries.length) return null;
        const resolvedEntries = await Promise.all(entries.map(function (entry) {
            return Promise.resolve().then(function () {
                // Sub-resolvers receive only the redacted request. Raw query,
                // params, hash, path and full URL remain in this local closure.
                return entry.resolve(Object.assign({}, request));
            }).then(function (raw) {
                return { key: entry.key, rule: normalizeSinkRule(entry.key, raw, request) };
            }).catch(function () {
                return { key: entry.key, rule: null };
            });
        }));
        const rules = {};
        resolvedEntries.forEach(function (entry) {
            if (entry.rule) rules[entry.key] = entry.rule;
        });
        const sinkKeys = Object.keys(rules);
        if (!sinkKeys.length) return null;
        const pageKeys = new Set(sinkKeys.map(function (key) { return rules[key].page_key; }));
        if (pageKeys.size !== 1) return null;
        const trafficRule = rules.traffic;
        const rawRoute = input && (input.route || input);
        const canonicalPath = trafficRule
            ? resolveCanonicalPath(rawRoute && rawRoute.params, trafficRule.route_pattern, trafficRule.path_params)
            : "";
        const publicTarget = trafficRule
            ? (trafficRule.path_target
                ? resolvePathPublicTarget(rawRoute, trafficRule)
                : resolvePublicTarget(rawRoute && (rawRoute.query || rawRoute.raw_query), trafficRule))
            : undefined;
        if (trafficRule && (!canonicalPath || (trafficRule.require_public_target && !publicTarget))) {
            delete rules.traffic;
        }
        const finalSinkKeys = Object.keys(rules);
        if (!finalSinkKeys.length) return null;
        const trackingRule = rules.tracking;
        const primary = trackingRule || rules.traffic;
        const unionEventTypes = [];
        const unionPropertyKeys = [];
        finalSinkKeys.forEach(function (key) {
            rules[key].event_types.forEach(function (type) {
                if (unionEventTypes.indexOf(type) < 0) unionEventTypes.push(type);
            });
            rules[key].property_keys.forEach(function (propertyKey) {
                if (unionPropertyKeys.indexOf(propertyKey) < 0) unionPropertyKeys.push(propertyKey);
            });
        });
        return {
            enabled: true,
            page_key: primary.page_key || request.page_key || sanitizeKey("route." + request.route_name, 128),
            route_name: request.route_name,
            route_pattern: primary.route_pattern || request.route_pattern,
            // A route template is the only pathname-like value allowed to enter
            // the canonical event. Actual dynamic segments never leave memory.
            route_path: primary.route_pattern || request.route_pattern,
            canonical_path: rules.traffic ? canonicalPath : undefined,
            layout_version: primary.layout_version || request.layout_version,
            event_types: unionEventTypes,
            property_keys: unionPropertyKeys,
            sample_rate: primary.sample_rate,
            sink_keys: finalSinkKeys,
            sink_rules: rules,
            public_target: publicTarget || undefined,
            project: request.project,
            product: request.product,
            surface: request.surface,
            client: request.client,
            game_client: request.game_client,
            domain: request.domain,
        };
    }

    return { resolve };
}

function createRemoteRuleResolver(options) {
    const settings = options || {};
    const runtime = settings.runtime || (typeof window !== "undefined" ? window : {});
    const fetchImpl = settings.fetch || runtime.fetch;
    const endpoint = settings.endpoint;
    const credentials = settings.credentials || "include";
    return async function resolve(requestInput) {
        if (!endpoint || typeof fetchImpl !== "function") return null;
        const request = createRuleRequestContext(requestInput);
        const query = Object.keys(request).sort().map(function (key) {
            return encodeURIComponent(key) + "=" + encodeURIComponent(request[key]);
        }).join("&");
        try {
            const response = await fetchImpl.call(runtime, endpoint + (endpoint.indexOf("?") >= 0 ? "&" : "?") + query, {
                method: "GET",
                credentials,
            });
            if (!response || !response.ok) return null;
            const payload = typeof response.json === "function" ? await response.json() : null;
            if (payload && Object.prototype.hasOwnProperty.call(payload, "code") && Number(payload.code) !== 0) return null;
            return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
        } catch (error) {
            return null;
        }
    };
}

export {
    PUBLIC_TARGET_VALIDATORS,
    createCompositeRuleResolver,
    createRemoteRuleResolver,
    createRuleRequestContext,
    extractRoutePattern,
    normalizeQueryTargetRules,
    normalizePathParamRules,
    resolveCanonicalPath,
    resolvePublicTarget,
};
