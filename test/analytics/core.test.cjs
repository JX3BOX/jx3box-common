const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../temp/analytics.cjs");
const { createStorage } = require("./helpers.cjs");

test("stable sampling is deterministic, nested, and page-independent", () => {
    const id = "12345678-1234-4123-8123-123456789abc";
    const score = analytics.stableSampleScore(id, "salt-v1");
    assert.equal(score, 0.5922146132215858);
    assert.equal(score, analytics.stableSampleScore(id, "salt-v1"));
    assert.ok(score >= 0 && score < 1);
    assert.equal(analytics.shouldSample(id, 0, "salt-v1"), false);
    assert.equal(analytics.shouldSample(id, 1, "salt-v1"), true);
    if (analytics.shouldSample(id, 0.1, "salt-v1")) {
        assert.equal(analytics.shouldSample(id, 0.2, "salt-v1"), true);
    }
    assert.equal(analytics.normalizeSampleRate(1000), 0.1);
});

test("identity reuses current and legacy device ids without fingerprinting", () => {
    const current = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const legacy = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const runtimeCurrent = { localStorage: createStorage({ "jx3box:device_id": current }), sessionStorage: createStorage() };
    const runtimeLegacy = { localStorage: createStorage({ device_id: legacy }), sessionStorage: createStorage() };

    assert.equal(analytics.resolveInstanceId(runtimeCurrent), current);
    assert.equal(analytics.resolveInstanceId(runtimeLegacy), legacy);
    assert.equal(runtimeLegacy.localStorage.getItem("jx3box:device_id"), legacy);

    const historical = "legacy-fingerprint.2020:desktop";
    const runtimeHistorical = { localStorage: createStorage({ "jx3box:device_id": historical }), sessionStorage: createStorage() };
    assert.equal(analytics.resolveInstanceId(runtimeHistorical), historical);
});

test("uuid fallback remains a valid v4 id", () => {
    const first = analytics.createUuid({});
    const second = analytics.createUuid({});
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(first, second);
});

test("privacy strips query/hash and rejects sensitive or nested properties", () => {
    assert.equal(analytics.sanitizeRoutePath("/index/?token=abc#fragment"), "/index");
    const properties = analytics.sanitizeProperties({
        item_id: "42",
        position: 3,
        token: "secret",
        search_keyword: "private",
        nested: { value: 1 },
        content_type: "post",
        tags: ["a", "b"],
    }, ["item_id", "position", "token", "search_keyword", "nested", "content_type", "tags"]);
    assert.deepEqual(properties, { item_id: "42", position: 3, content_type: "post" });
    assert.equal(analytics.sanitizeProperties({ module_id: "posts" }, []), undefined);
    assert.equal(analytics.sanitizeProperties({ accessToken: "secret" }, ["accessToken"]), undefined);
});

test("page registry matches only explicitly registered normalized paths", () => {
    const registry = analytics.createPageRegistry([
        { page_key: "index.home", paths: ["/index", "/index/"], event_types: ["page_view", "click"] },
    ]);
    assert.equal(registry.match("/index/?tab=all").page_key, "index.home");
    assert.equal(registry.match("/index/tv"), null);
    assert.equal(registry.match("/index/download"), null);
});

test("queue storage enforces ttl, count, and byte bounds", () => {
    const storage = createStorage();
    let now = 100_000;
    const queueStorage = analytics.createQueueStorage({ storage, maxEvents: 2, maxBytes: 1024, ttlMs: 60_000, now: () => now });
    queueStorage.save([
        { queued_at: 30_000, event: { event_id: "expired" } },
        { queued_at: 95_000, event: { event_id: "a" } },
        { queued_at: 96_000, event: { event_id: "b" } },
        { queued_at: 97_000, event: { event_id: "c" } },
    ]);
    assert.deepEqual(queueStorage.load().map((entry) => entry.event.event_id), ["b", "c"]);
    now = 200_000;
    assert.deepEqual(queueStorage.load(), []);
});

test("queue storage degrades to an in-memory queue when persistence is unavailable", () => {
    const queueStorage = analytics.createQueueStorage({ storage: null, now: () => 100_000 });
    const entries = queueStorage.save([
        { queued_at: 100_000, event: { event_id: "memory-only" } },
    ]);
    assert.deepEqual(entries.map((entry) => entry.event.event_id), ["memory-only"]);
});
