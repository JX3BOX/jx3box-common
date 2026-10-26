const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'js/utils.js'), 'utf8');
const body = source.slice(source.indexOf('export function tvLink('), source.indexOf('\n}', source.indexOf('export function tvLink(')) + 2);
const tvLink = vm.runInNewContext(body.replace('export ', '') + '\ntvLink', {
    tvmap: JSON.parse(fs.readFileSync(path.join(root, 'data/tvmap.json'), 'utf8')), URL,
});
test('room IDs resolve for existing and new platforms', () => {
    for (const [platform, prefix] of Object.entries({douyu:'https://www.douyu.com/', bilibili:'https://live.bilibili.com/', huya:'https://www.huya.com/', douyin:'https://live.douyin.com/', kuaishou:'https://live.kuaishou.com/u/'})) {
        assert.equal(tvLink(platform, '123'), prefix + '123');
    }
});
test('full share URLs preserve paths and query parameters', () => {
    for (const platform of ['douyu', 'bilibili', 'huya', 'douyin', 'kuaishou', 'weixin', 'xiaohongshu', 'other']) {
        assert.equal(tvLink(platform, ' https://example.com/live?id=123 '), 'https://example.com/live?id=123');
    }
});
test('URL-only platforms and invalid inputs do not create broken or unsafe links', () => {
    for (const platform of ['weixin', 'xiaohongshu', 'other']) assert.equal(tvLink(platform, '123'), '');
    for (const value of ['', null, 'javascript:alert(1)', '//example.com', 'https://', 'https://user@example.com', 'a/b']) assert.equal(tvLink('douyu', value), '');
    assert.equal(tvLink('unknown', '123'), '');
    assert.equal(tvLink('cc', '123'), '');
    assert.equal(tvLink('__proto__', '123'), '');
});

test('real platform URL formats bypass room ID concatenation', () => {
    const cases = [
        ['douyu', 'https://www.douyu.com/123?from=profile#live'],
        ['bilibili', 'https://live.bilibili.com/123?broadcast_type=0&is_room_feed=true'],
        ['huya', 'https://www.huya.com/room_name'],
        ['douyin', 'https://live.douyin.com/123?enter_from_merge=share'],
        ['douyin', 'https://v.douyin.com/AbCd123/'],
        ['kuaishou', 'https://live.kuaishou.com/u/abc_123'],
        ['kuaishou', 'https://v.kuaishou.com/AbCd123'],
        ['weixin', 'https://channels.weixin.qq.com/platform/live?foo=bar&token=a%2Fb%3D'],
        ['xiaohongshu', 'https://www.xiaohongshu.com/user/profile/abc?xsec_token=a%2Fb%3D&xsec_source=pc_share'],
        ['xiaohongshu', 'http://xhslink.com/AbCd123'],
        ['other', 'https://example.com/live/123?foo=1&bar=2#player'],
    ];
    for (const [platform, url] of cases) {
        assert.equal(tvLink(platform, url), url, platform);
        assert.equal(tvLink(platform, `  ${url}  `), url, platform + ' with surrounding spaces');
    }
});
test('legacy numeric and named rooms remain supported', () => {
    assert.equal(tvLink('bilibili', 123), 'https://live.bilibili.com/123');
    assert.equal(tvLink('huya', ' room_name '), 'https://www.huya.com/room_name');
    assert.equal(tvLink('douyu', '123'), 'https://www.douyu.com/123');
});
