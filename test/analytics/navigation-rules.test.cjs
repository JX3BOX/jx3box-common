const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../temp/analytics.cjs");
const { createElement, createRuntime } = require("./helpers.cjs");

function createJournal() {
    const entries = [];
    const finalizations = [];
    return {
        entries,
        finalizations,
        enqueue(event, options) {
            entries.push({ event, options });
            return event.event_id;
        },
        finalize(eventId, sinkKey, patch) {
            finalizations.push({ eventId, sinkKey, patch });
            return true;
        },
        flush() {
            return Promise.resolve({ sent: 0 });
        },
        flushBeacon() {
            return false;
        },
        destroy() {},
        getState() {
            return {
                pending: entries.length,
                dropped: 0,
                eventIds: entries.map((entry) => entry.event.event_id),
                entries,
            };
        },
    };
}

function createRules(spy) {
    return analytics.createCompositeRuleResolver({
        tracking: async (request) => {
            spy.push({ sink: "tracking", request });
            return {
                enabled: true,
                page_key: request.page_key,
                route_pattern: request.route_pattern,
                sample_rate: 1,
                event_types: ["page_view", "click"],
                property_keys: [],
                interaction_target_rules: [
                    { target_key: "post.favorite", target_type: "button", allowed_ids: ["favorite"] },
                ],
                rule_version: "tracking-v1",
            };
        },
        traffic: async (request) => {
            spy.push({ sink: "traffic", request });
            return {
                enabled: true,
                page_key: request.page_key,
                route_pattern: request.route_pattern,
                sample_rate: 1,
                event_types: ["page_view"],
                rule_version: "traffic-v1",
                require_public_target: true,
                path_params: [{ key: "id", validator: "positive_integer" }],
                query_targets: [
                    { query_key: "id", target_type: "post", validator: "positive_int", required: true },
                ],
            };
        },
    });
}

test("composite rules expose only a safe request and project a whitelisted public target", async () => {
    const requests = [];
    const resolver = createRules(requests);
    const resolved = await resolver.resolve({
        page_key: "post.view",
        project: "jx3box",
        surface: "web",
        route: {
            name: "post-view",
            path: "/post/918273",
            fullPath: "/post/918273?id=42&token=secret#private",
            hash: "#private",
            params: { id: "918273", unknown_id: "do-not-send" },
            query: { id: "42", token: "secret" },
            matched: [{ path: "/post/:id" }],
        },
    });

    assert.equal(resolved.route_path, "/post/:id");
    assert.equal(resolved.canonical_path, "/post/918273");
    assert.deepEqual(resolved.public_target, { key: "id", type: "post", id: "42" });
    assert.deepEqual(resolved.sink_keys.sort(), ["tracking", "traffic"]);
    requests.forEach(({ request }) => {
        const serialized = JSON.stringify(request);
        assert.equal(serialized.includes("918273"), false);
        assert.equal(serialized.includes("do-not-send"), false);
        assert.equal(serialized.includes("secret"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(request, "query"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(request, "path"), false);
        assert.equal(Object.prototype.hasOwnProperty.call(request, "fullPath"), false);
    });
});

test("invalid or unknown dynamic targets fail traffic closed without disabling tracking", async () => {
    const resolver = createRules([]);
    const resolved = await resolver.resolve({
        page_key: "post.view",
        route: {
            name: "post-view",
            params: { id: "not-valid", unknown_id: "918273" },
            query: { id: "../../private", unknown_id: "918273" },
            matched: [{ path: "/post/:id" }],
        },
    });
    assert.deepEqual(resolved.sink_keys, ["tracking"]);
    assert.equal(resolved.public_target, undefined);
    assert.equal(JSON.stringify(resolved).includes("918273"), false);
    assert.equal(JSON.stringify(resolved).includes("../../private"), false);
});

test("traffic config cannot widen the tracking property allowlist", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const rule = {
        enabled: true,
        page_key: "index.home",
        route_pattern: "/index",
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "rule-v1",
    };
    const client = analytics.createAnalyticsCore({
        runtime,
        queue: journal,
        project: "index",
        surface: "pc_web",
        ruleResolver: analytics.createCompositeRuleResolver({
            tracking: async () => ({
                ...rule,
                event_types: ["page_view", "click"],
                property_keys: [],
            }),
            traffic: async () => ({
                ...rule,
                property_keys: ["traffic_only_module"],
            }),
        }),
    });
    const controller = analytics.createNavigationController({ client, runtime });
    await controller.navigate({
        name: "index",
        meta: { analytics: { page_key: "index.home" } },
        matched: [{ path: "/index" }],
    }, null, { navigation_id: "property-allowlist" });

    client.track("click", {
        name: "index_click",
        properties: { traffic_only_module: "must-stay-local" },
    });
    const click = journal.entries[1].event;
    assert.equal(click.properties, undefined);
    assert.equal(analytics.projectTrackingEvent(click).properties, undefined);
    assert.equal(JSON.stringify(journal.entries).includes("must-stay-local"), false);
    controller.destroy();
    client.destroy();
});

test("router owns navigation, v-track-page adds metadata, and one canonical page view serves two sinks", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const requests = [];
    const client = analytics.createAnalyticsCore({
        runtime,
        queue: journal,
        ruleResolver: createRules(requests),
        sampleSalt: "navigation-test",
        product: "jx3box",
        project: "index",
        client: "heartbeat_web",
        surface: "pc_web",
    });
    const controller = analytics.createNavigationController({ client, runtime });
    const plugin = analytics.createVue3AnalyticsPlugin(client, { runtime, routerMode: true });
    const directives = {};
    plugin.install({
        config: { globalProperties: {} },
        directive(name, value) {
            directives[name] = value;
        },
        provide() {},
    });

    const root = createElement();
    directives["track-page"].mounted(root, {
        value: { page_key: "post.view", layout_version: "post-v2" },
    });
    assert.equal(journal.entries.length, 0);

    const route = {
        name: "post-view",
        path: "/post/918273",
        fullPath: "/post/918273?id=42&token=secret#private",
        params: { id: "918273", unknown_id: "do-not-send" },
        query: { id: "42", token: "secret" },
        matched: [{ path: "/post/:id" }],
    };
    const firstId = await controller.navigate(route, null, { navigation_id: "navigation-1" });
    const duplicateId = await controller.navigate(route, null, { navigation_id: "navigation-1" });
    assert.equal(firstId.page_view_event_id, duplicateId.page_view_event_id);
    assert.equal(journal.entries.length, 1);

    const first = journal.entries[0];
    assert.equal(first.event.event_type, "page_view");
    assert.equal(first.event.previous_event_id, undefined);
    assert.equal(first.event.route_path, "/post/:id");
    assert.equal(first.event.canonical_path, "/post/918273");
    assert.equal(first.event.layout_version, "post-v2");
    assert.equal(first.event.project, "index");
    assert.equal(first.event.surface, "pc_web");
    assert.deepEqual(first.event.public_target, { key: "id", type: "post", id: "42" });
    assert.deepEqual(first.options.sinkKeys.sort(), ["tracking", "traffic"]);
    assert.deepEqual(first.options.deferredSinkKeys, ["traffic"]);
    assert.equal(JSON.stringify(first).includes("secret"), false);
    assert.equal(JSON.stringify(first).includes("do-not-send"), false);
    const trafficEvent = analytics.projectTrafficEvent(first.event);
    const trafficGroup = analytics.trafficPartition([first.event], {})[0];
    assert.equal(trafficEvent.project, "index");
    assert.equal(trafficEvent.path, "/post/918273");
    assert.equal(trafficGroup.context.surface, "pc_web");

    const clickId = client.track("click", {
        interaction_target: { key: "post.favorite", type: "button", id: "favorite" },
    });
    const click = journal.entries[1];
    assert.equal(click.event.previous_event_id, undefined);
    assert.equal(click.event.event_id, clickId);
    assert.deepEqual(click.event.interaction_target, { key: "post.favorite", type: "button", id: "favorite" });
    assert.deepEqual(click.options.sinkKeys, ["tracking"]);

    await controller.navigate(Object.assign({}, route, { query: { id: "43" } }), route, { navigation_id: "navigation-2" });
    const secondPageView = journal.entries[2].event;
    assert.equal(secondPageView.previous_event_id, first.event.event_id);
    assert.equal(secondPageView.previous_canonical_event_id, click.event.event_id);
    assert.equal(secondPageView.sequence_no, click.event.sequence_no + 1);
    assert.equal(journal.finalizations.length, 1);
    assert.equal(journal.finalizations[0].eventId, first.event.event_id);
    assert.equal(journal.finalizations[0].sinkKey, "traffic");
    assert.equal(journal.finalizations[0].patch.is_exit, false);

    directives["track-page"].beforeUnmount(root);
    assert.equal(journal.entries.length, 3);
    controller.destroy();
    plugin.destroy();
});

test("router pagehide finalizes Traffic before the single lifecycle Beacon", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const beaconCalls = [];
    journal.flushBeacon = function (options) {
        beaconCalls.push(options);
        return true;
    };
    let afterEach;
    const router = {
        afterEach(handler) {
            afterEach = handler;
            return function () {};
        },
    };
    const client = analytics.createAnalyticsCore({
        runtime,
        queue: journal,
        project: "index",
        surface: "pc_web",
        ruleResolver: createRules([]),
    });
    const plugin = analytics.createVue3AnalyticsPlugin(client, {
        runtime,
        router,
        captureInitial: false,
    });
    plugin.install({
        config: { globalProperties: {} },
        directive() {},
        provide() {},
    });
    afterEach({
        name: "post-view",
        meta: { analytics: { page_key: "post.view" } },
        params: { id: "918273" },
        query: { id: "42" },
        matched: [{ path: "/post/:id" }],
    }, null, null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(journal.entries.length, 1);
    runtime.__windowListeners.pagehide();
    assert.equal(journal.finalizations.length, 1);
    assert.equal(journal.finalizations[0].patch.is_exit, true);
    assert.equal(journal.finalizations[0].patch.finalize_reason, "pagehide");
    assert.deepEqual(beaconCalls, [{ reason: "pagehide" }]);
    plugin.destroy();
});

test("game query variants and revision ids require explicit named rules", async () => {
    const resolver = analytics.createCompositeRuleResolver({
        traffic: async () => ({
            enabled: true,
            page_key: "game.wiki.detail",
            route_pattern: "/wiki",
            sample_rate: 1,
            event_types: ["page_view"],
            rule_version: "game-traffic-v1",
            require_public_target: true,
            target: {
                from: "query_variant",
                type_key: "type",
                id_key: "id",
                default_variant: "achievement",
                variants: {
                    achievement: { type: "achievement", validator: "positive_integer", aliases: ["cj"] },
                    item: { type: "item", validator: "digits_or_underscore" },
                },
            },
            secondary: { field: "revision_id", from: "query", key: "post_id", validator: "positive_integer" },
        }),
    });
    const resolved = await resolver.resolve({
        project: "game",
        surface: "pc_game",
        route: {
            name: "game-wiki",
            query: { type: "item", id: "123_45", post_id: "998", private_id: "do-not-send" },
            matched: [{ path: "/wiki" }],
        },
    });
    assert.deepEqual(resolved.public_target, {
        key: "id",
        type: "item",
        id: "123_45",
        variant: "item",
        revision_id: "998",
    });
    assert.equal(JSON.stringify(resolved).includes("do-not-send"), false);

    const rejected = await resolver.resolve({
        project: "game",
        surface: "pc_game",
        route: {
            name: "game-wiki",
            query: { type: "unknown", id: "123_45", post_id: "private" },
            matched: [{ path: "/wiki" }],
        },
    });
    assert.equal(rejected, null);
});

test("path targets rebuild only explicitly validated route params", async () => {
    const resolver = analytics.createCompositeRuleResolver({
        traffic: async () => ({
            enabled: true,
            page_key: "wiki.item.detail",
            route_pattern: "/item/view/:item_id/:post_id?",
            sample_rate: 1,
            event_types: ["page_view"],
            rule_version: "wiki-traffic-v1",
            require_public_target: true,
            target: {
                from: "path",
                key: "item_id",
                type: "item",
                validator: "digits_or_underscore",
            },
            secondary: {
                field: "revision_id",
                from: "path",
                key: "post_id",
                validator: "positive_integer",
            },
        }),
    });
    const resolved = await resolver.resolve({
        project: "wiki",
        surface: "pc_web",
        route: {
            name: "wiki-item",
            params: { item_id: "123_45", post_id: "998", private_id: "never-send" },
            matched: [{ path: "/item/view/:item_id/:post_id?" }],
        },
    });
    assert.equal(resolved.canonical_path, "/item/view/123_45/998");
    assert.deepEqual(resolved.public_target, {
        key: "item_id",
        type: "item",
        id: "123_45",
        revision_id: "998",
    });
    assert.equal(JSON.stringify(resolved).includes("never-send"), false);

    const rejected = await resolver.resolve({
        project: "wiki",
        surface: "pc_web",
        route: {
            name: "wiki-item",
            params: { item_id: "../../private", post_id: "998", private_id: "never-send" },
            matched: [{ path: "/item/view/:item_id/:post_id?" }],
        },
    });
    assert.equal(rejected, null);
});

test("page-only path params validate locally but never leave the device", async () => {
    const resolver = analytics.createCompositeRuleResolver({
        traffic: async () => ({
            enabled: true,
            page_key: "uc.author.public",
            route_pattern: "/author/:id",
            sample_rate: 1,
            event_types: ["page_view"],
            rule_version: "traffic-page-only-v1",
            require_public_target: false,
            path_params: { id: { validator: "positive_integer" } },
        }),
    });
    const resolved = await resolver.resolve({
        project: "mobile",
        surface: "app",
        route: {
            name: "author",
            path: "/author/918273",
            params: { id: "918273" },
            matched: [{ path: "/author/:id" }],
        },
    });
    assert.equal(resolved.canonical_path, "/author/:id");
    assert.equal(JSON.stringify(resolved).includes("918273"), false);
    assert.equal(analytics.projectTrafficEvent({
        ...resolved,
        event_id: "traffic-page-only-0001",
        occurred_at: "2026-08-26T01:00:00.000Z",
    }).path, "/author/:id");

    const invalid = await resolver.resolve({
        project: "mobile",
        surface: "app",
        route: {
            name: "author",
            path: "/author/private-name",
            params: { id: "private-name" },
            matched: [{ path: "/author/:id" }],
        },
    });
    assert.equal(invalid, null);
});

test("composite rules reject incomplete or route-mismatched server registrations", async () => {
    const input = {
        page_key: "index.home",
        project: "index",
        surface: "pc_web",
        route: { name: "index", matched: [{ path: "/index" }] },
    };
    const base = {
        enabled: true,
        page_key: "index.home",
        route_pattern: "/index",
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "tracking-v1",
    };

    for (const missing of ["page_key", "route_pattern", "rule_version", "event_types"]) {
        const resolver = analytics.createCompositeRuleResolver({
            tracking: async () => {
                const rule = { ...base };
                delete rule[missing];
                return rule;
            },
        });
        assert.equal(await resolver.resolve(input), null, `missing ${missing} must fail closed`);
    }

    const mismatch = analytics.createCompositeRuleResolver({
        tracking: async () => ({ ...base, route_pattern: "/download" }),
    });
    assert.equal(await mismatch.resolve(input), null);
});

test("public query targets require an explicit named validator", async () => {
    const base = {
        enabled: true,
        page_key: "item.view",
        route_pattern: "/item",
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "traffic-v1",
        require_public_target: true,
    };
    const input = {
        project: "index",
        surface: "pc_web",
        route: {
            name: "item",
            query: { id: "unknown-dynamic-id" },
            matched: [{ path: "/item" }],
        },
    };
    const fixed = analytics.createCompositeRuleResolver({
        traffic: async () => ({
            ...base,
            query_targets: [{ query_key: "id", target_type: "item", required: true }],
        }),
    });
    assert.equal(await fixed.resolve(input), null);

    const variant = analytics.createCompositeRuleResolver({
        traffic: async () => ({
            ...base,
            query_targets: [{
                query_key: "id",
                type_query_key: "type",
                default_variant: "item",
                variants: { item: { type: "item" } },
                required: true,
            }],
        }),
    });
    assert.equal(await variant.resolve(input), null);
});

test("composite rules reject cross-sink page key drift", async () => {
    const rule = {
        enabled: true,
        route_pattern: "/index",
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "rule-v1",
    };
    const resolver = analytics.createCompositeRuleResolver({
        tracking: async () => ({ ...rule, page_key: "index.home" }),
        traffic: async () => ({ ...rule, page_key: "index.other" }),
    });
    assert.equal(await resolver.resolve({
        project: "index",
        surface: "pc_web",
        route: { name: "index", matched: [{ path: "/index" }] },
    }), null);
});

test("tracking-only pages never become Traffic path predecessors", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const trackingRule = (request) => ({
        enabled: true,
        page_key: request.page_key,
        route_pattern: request.route_pattern,
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "tracking-v1",
    });
    const trafficRule = (request) => request.page_key === "dual.page" ? ({
        enabled: true,
        page_key: request.page_key,
        route_pattern: request.route_pattern,
        sample_rate: 1,
        event_types: ["page_view"],
        rule_version: "traffic-v1",
    }) : null;
    const client = analytics.createAnalyticsCore({
        runtime,
        queue: journal,
        project: "index",
        surface: "pc_web",
        ruleResolver: analytics.createCompositeRuleResolver({
            tracking: async (request) => trackingRule(request),
            traffic: async (request) => trafficRule(request),
        }),
    });
    const controller = analytics.createNavigationController({ client, runtime });
    const trackingRoute = {
        name: "tracking-only",
        meta: { analytics: { page_key: "tracking.page" } },
        matched: [{ path: "/tracking" }],
    };
    const dualRoute = {
        name: "dual",
        meta: { analytics: { page_key: "dual.page" } },
        matched: [{ path: "/dual" }],
    };

    await controller.navigate(trackingRoute, null, { navigation_id: "tracking-nav" });
    await controller.navigate(dualRoute, trackingRoute, { navigation_id: "dual-nav" });
    assert.equal(journal.entries.length, 2);
    assert.deepEqual(journal.entries[0].options.sinkKeys, ["tracking"]);
    assert.equal(journal.entries[1].event.previous_event_id, undefined);
    assert.equal(journal.entries[1].event.is_entry, true);
    assert.deepEqual(journal.entries[1].options.sinkKeys.sort(), ["tracking", "traffic"]);
    controller.destroy();
    client.destroy();
});

test("router transitions disable capture while the new server rule is pending", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    let resolvePending;
    const ruleFor = (request) => ({
        enabled: true,
        page_key: request.page_key,
        route_pattern: request.route_pattern,
        sample_rate: 1,
        event_types: ["page_view", "click"],
        rule_version: "tracking-v1",
    });
    const resolver = analytics.createCompositeRuleResolver({
        tracking: (request) => request.page_key === "next.page"
            ? new Promise((resolve) => { resolvePending = () => resolve(ruleFor(request)); })
            : ruleFor(request),
    });
    const client = analytics.createAnalyticsCore({ runtime, queue: journal, ruleResolver: resolver });
    const controller = analytics.createNavigationController({ client, runtime });
    const currentRoute = {
        name: "current",
        meta: { analytics: { page_key: "current.page" } },
        matched: [{ path: "/current" }],
    };
    const nextRoute = {
        name: "next",
        meta: { analytics: { page_key: "next.page" } },
        matched: [{ path: "/next" }],
    };
    await controller.navigate(currentRoute, null, { navigation_id: "current-nav" });
    assert.equal(client.isActive(), true);

    const pendingNavigation = controller.navigate(nextRoute, currentRoute, { navigation_id: "next-nav" });
    assert.equal(client.isActive(), false);
    assert.equal(client.track("click", { name: "transition-click" }), null);
    assert.equal(journal.entries.length, 1);

    await Promise.resolve();
    assert.equal(typeof resolvePending, "function");
    resolvePending();
    await pendingNavigation;
    assert.equal(client.isActive(), true);
    assert.equal(client.getState().page.page_key, "next.page");
    assert.equal(journal.entries.length, 2);
    controller.destroy();
    client.destroy();
});

test("interaction target ids are dropped unless tracking config explicitly permits them", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const client = analytics.createAnalytics({ runtime, queue: journal });
    await client.enterPage({
        page_key: "index.home",
        route_pattern: "/index",
        sample_rate: 1,
        event_types: ["page_view", "click"],
    });
    client.track("click", {
        interaction_target: { key: "index.card", type: "card", id: "private-dynamic-id" },
    });
    assert.deepEqual(journal.entries[1].event.interaction_target, { key: "index.card", type: "card" });
    assert.equal(journal.entries[1].event.target_id, undefined);
    client.destroy();
});

test("createAnalyticsCore has no local allow-by-default escape hatch", async () => {
    const runtime = createRuntime();
    const journal = createJournal();
    const client = analytics.createAnalyticsCore({ runtime, queue: journal });
    const activated = await client.enterPage({
        page_key: "index.home",
        route_pattern: "/index",
        sample_rate: 1,
        event_types: ["page_view"],
    });
    assert.equal(activated, null);
    assert.equal(journal.entries.length, 0);
    assert.equal(client.getState().identityCreated, false);
    client.destroy();
});

test("Vue Router installation is singleton per router", () => {
    const runtime = createRuntime();
    const client = analytics.createAnalytics({ runtime, queue: createJournal(), pages: [] });
    const router = {
        afterEach() {
            return function () {};
        },
    };
    const first = analytics.installVueRouterAnalytics(client, router, { runtime });
    const second = analytics.installVueRouterAnalytics(client, router, { runtime });
    assert.equal(first, second);

    const anotherClient = analytics.createAnalytics({ runtime: createRuntime(), queue: createJournal(), pages: [] });
    assert.throws(function () {
        analytics.installVueRouterAnalytics(anotherClient, router, { runtime });
    }, /already installed/);
    first.destroy();
    client.destroy();
    anotherClient.destroy();
});
