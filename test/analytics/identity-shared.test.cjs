const test = require("node:test");
const assert = require("node:assert/strict");
const analytics = require("../../temp/analytics.cjs");
const { createStorage } = require("./helpers.cjs");

test("identity handles share one session and a monotonic sequence", () => {
    const runtime = {
        localStorage: createStorage({ "jx3box:device_id": "shared-device" }),
        sessionStorage: createStorage(),
    };
    let now = 1000;
    const first = analytics.createIdentity({ runtime, now: () => now, sessionTimeoutMs: 60_000 });
    const second = analytics.createIdentity({ runtime, now: () => now, sessionTimeoutMs: 60_000 });

    const firstEvent = first.nextEvent();
    const secondEvent = second.nextEvent();
    assert.equal(secondEvent.session_id, firstEvent.session_id);
    assert.equal(firstEvent.sequence_no, 1);
    assert.equal(secondEvent.sequence_no, 2);

    now += 60_001;
    // Observer-like handles only read the session. If that read is first after
    // timeout, the Analytics handle must still observe the external rotation.
    const observerRotatedSession = second.getSessionId();
    const rotated = first.nextEvent();
    assert.equal(rotated.session_id, observerRotatedSession);
    assert.notEqual(rotated.session_id, firstEvent.session_id);
    assert.equal(rotated.session_rotated, true);
    assert.equal(rotated.sequence_no, 1);
    assert.equal(second.getSessionId(), rotated.session_id);
    assert.equal(second.nextEvent().sequence_no, 2);

    first.resetSession();
    const explicitlyReset = first.getSessionId();
    assert.equal(second.getSessionId(), explicitlyReset);
    const externallyReset = second.nextEvent();
    assert.equal(externallyReset.sequence_no, 1);
    assert.equal(externallyReset.session_rotated, true);
});

test("Observer-style namespaces share installation identity but not Analytics sessions", () => {
    const runtime = {
        localStorage: createStorage({ "jx3box:device_id": "shared-device" }),
        sessionStorage: createStorage(),
    };
    let now = 1000;
    const analyticsIdentity = analytics.createIdentity({ runtime, now: () => now, sessionTimeoutMs: 60_000 });
    const observerIdentity = analytics.createIdentity({
        runtime,
        now: () => now,
        sessionTimeoutMs: 60_000,
        sessionNamespace: "observability",
    });
    const first = analyticsIdentity.nextEvent();
    const observerSession = observerIdentity.getSessionId();
    assert.equal(observerIdentity.getInstanceId(), analyticsIdentity.getInstanceId());
    assert.notEqual(observerSession, first.session_id);

    now += 60_001;
    observerIdentity.getSessionId();
    const analyticsSessionBeforeTouch = runtime.sessionStorage.getItem("jx3box:analytics:session_id");
    assert.equal(analyticsSessionBeforeTouch, first.session_id);
    const rotated = analyticsIdentity.nextEvent();
    assert.notEqual(rotated.session_id, first.session_id);
    assert.equal(rotated.session_rotated, true);
});
