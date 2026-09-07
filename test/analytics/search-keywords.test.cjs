const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../../temp/analytics.cjs');
const { createRuntime } = require('./helpers.cjs');

async function capture(referrer, surface = 'pc_web') {
    const runtime = createRuntime();
    runtime.document.referrer = referrer;
    const events = [];
    const queue = {
        enqueue(event) { events.push(event); return event.event_id; },
        finalize() { return true; }, flush() { return Promise.resolve({ sent: 0 }); },
        flushBeacon() { return false; }, destroy() {},
        getState() { return { pending: events.length, entries: [] }; },
    };
    const client = analytics.createAnalyticsCore({
        runtime, queue, project: 'index', client: surface, surface, gameClient: 'std',
        ruleResolver: analytics.createCompositeRuleResolver({ traffic: async (request) => ({
            enabled: true, page_key: request.page_key, route_pattern: request.route_pattern,
            sample_rate: 1, event_types: ['page_view'], rule_version: 'test',
        }) }),
    });
    const controller = analytics.createNavigationController({ client, runtime });
    try {
        for (const name of ['index', 'about']) {
            await controller.navigate({ name, path: '/' + name,
                meta: { analytics: { page_key: 'index.' + name } }, matched: [{ path: '/' + name }],
            }, null, { navigation_id: name });
        }
    } finally { controller.destroy(); client.destroy(); }
    const requests = [];
    const sink = analytics.createTrafficSink({ endpoint: '/traffic', fetch: async (_url, options) => {
        const body = JSON.parse(options.body); requests.push(body);
        return { status: 200, json: async () => ({ data: { items: body.events.map(event => ({ event_id: event.event_id, status: 'accepted' })) } }) };
    } });
    await sink.send(events);
    return { events, requests };
}

test('external keyword survives queue and TrafficSink, only on the entry; URL never leaves device', async () => {
    const { events, requests } = await capture('https://www.baidu.com/s?wd=%E5%89%91%E4%B8%89+%E9%AD%94%E7%9B%92&token=private-token#secret');
    assert.equal(events.length, 2);
    assert.equal(events[0].entry_source.search_keyword, '剑三 魔盒');
    assert.equal(events[1].entry_source.search_keyword, undefined);
    assert.equal(requests[0].entry_source.search_keyword, '剑三 魔盒');
    assert.equal(requests[0].entry_source.referrer, 'https://www.baidu.com/');
    assert.doesNotMatch(JSON.stringify({ events, requests }), /private-token|#secret|\/s\?|wd=/);
    assert.equal(analytics.projectTrackingEvent(events[0]).entry_source, undefined);
});

test('new SDK explicitly reports unavailable keywords, and ignores forged domains and App sources', async () => {
    for (const referrer of ['https://www.baidu.com/', 'https://cn.bing.com/search?q=', 'https://www.baidu.com/s?wd=%FF', 'https://www.baidu.com/s?wd=' + 'a'.repeat(129)]) {
        const { requests } = await capture(referrer);
        assert.equal(requests[0].entry_source.search_keyword, '', referrer);
    }
    for (const referrer of ['https://baidu.com.evil.example/?wd=private', 'https://www.jx3box.com/?q=private', 'https://www.baidu.com/s?token=private']) {
        const { requests } = await capture(referrer);
        assert.doesNotMatch(JSON.stringify(requests), /private/);
    }
    assert.equal((await capture('https://www.baidu.com/s?wd=剑三', 'app')).events[0].entry_source.search_keyword, undefined);
});

test('allowlisted engines decode terms without case folding or a second URL decode', async () => {
    for (const [referrer, expected] of [
        ['https://www.baidu.com/s?word=剑三', '剑三'],
        ['https://cn.bing.com/search?q=JX3BOX', 'JX3BOX'],
        ['https://www.google.com/search?q=%2520', '%20'],
        ['https://www.so.com/s?q=魔盒', '魔盒'],
        ['https://www.sogou.com/web?query=魔盒', '魔盒'],
        ['https://m.sm.cn/s?q=魔盒', '魔盒'],
    ]) assert.equal((await capture(referrer, 'mobile_web')).requests[0].entry_source.search_keyword, expected);
});
