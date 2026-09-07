# Analytics 事件追踪与访问路径 Core

`@jx3box/jx3box-common/js/analytics.js` 提供一套框架无关的 Analytics Core。它用同一个 installation identity、session、导航所有者和持久 Journal 生成 canonical 事件，再由可组合 sink 分别投递事件追踪/热力图与访问路径协议。

异常与接口健康仍使用独立的 [`js/observability.js`](./observability.md)。Observer 默认关闭，保持自己的 session namespace、队列、Issue/Fingerprint 和上报协议；它只与 Analytics 共享稳定 installation ID，不会延长或轮转业务访问 session，也不会因为 Analytics 启用而自动采集。

## 1. 核心约束

- 只有服务端规则明确启用的页面才采集。规则请求失败、缺字段、返回禁用或没有配置 resolver 时均失败关闭。
- Router 是导航的唯一所有者。一次导航只创建一个 canonical `page_view`、一个 `event_id` 和一个 `sequence_no`。
- Tracking 与 Traffic 共享 canonical `page_view`，但由独立 sink 编码和逐 ID 确认；任何一方失败不会伪造另一方 ACK。
- `previous_event_id` 只连接同 session 中上一条实际进入 Traffic Journal 的 page view；Tracking-only 页面不会覆盖它。`previous_canonical_event_id` 连接上一条任意 canonical 事件，供完整事件顺序排查。
- `instance_id` 复用 heartbeat 的 `jx3box:device_id`；同一页面内即使构造多个 identity handle，也会同步同一 session 和单调 sequence。
- 原始 query、hash、完整 URL、实际动态 pathname、DOM 文本、表单值、Cookie、Token 和任意未知动态 ID 不进入 Journal、配置请求或 envelope。纯 page-only 路由的参数只在本地按服务端 named validator/固定 allowlist 校验，`canonical_path` 始终保留模板；只有与显式公开 target 绑定的路径参数才能在本地重建后进入 `canonical_path`。
- `interaction_target` 只描述热力/交互元素；`public_target` 只描述规则确认的公开业务对象。Traffic 永远不会把 DOM target 解释成访问目标。
- fetch 是可确认主通道。Beacon 没有确认语义，成功入浏览器队列后仍保留原 `event_id`，等待后续 fetch 幂等确认。
- 默认本地最多 200 条、256 KiB、7 天；单批最多 20 条、60 KiB；兼容 Chrome 76、Safari 12、Firefox 78。

## 2. 推荐接入：一个 Core，两个 sink

```js
import {
    createAnalyticsCore,
    createCompositeRuleResolver,
    createEventQueue,
    createIdentity,
    createQueueStorage,
    createRemoteRuleResolver,
    createTrackingSink,
    createTrafficSink,
    createVue3AnalyticsPlugin,
} from "@jx3box/jx3box-common/js/analytics.js";

const runtime = window;
const identity = createIdentity({ runtime });

const trackingSink = createTrackingSink({
    runtime,
    endpoint: "/api/cms/system/stat/tracking/batch",
});

const trafficSink = createTrafficSink({
    runtime,
    endpoint: "/api/cms/system/traffic/visits/batch",
});

const queue = createEventQueue({
    runtime,
    storage: createQueueStorage({ storage: runtime.localStorage }),
    sinks: [trackingSink, trafficSink],
    beforeFlush: async () => {
        // 可以在这里等待 heartbeat 注册；失败返回 false，事件继续留在本地。
        return { allow: true };
    },
});

const ruleResolver = createCompositeRuleResolver({
    tracking: createRemoteRuleResolver({
        runtime,
        endpoint: "/api/cms/system/stat/tracking/config",
    }),
    traffic: createRemoteRuleResolver({
        runtime,
        // service-cms 已提供独立、失败关闭的 Traffic Config。
        endpoint: "/api/cms/system/traffic/config",
    }),
});

const analytics = createAnalyticsCore({
    runtime,
    identity,
    queue,
    ruleResolver,
    product: "jx3box",
    project: "index",
    client: "pc_web",
    surface: "pc_web",
    gameClient: "std",
    sampleSalt: "jx3box-analytics-v2",
});

app.use(createVue3AnalyticsPlugin(analytics, {
    runtime,
    router,
}));
```

`project` 与 `surface` 是 Traffic 的安全维度，使用 TrafficSink 时必须明确配置。Core 会把它们注入安全规则请求并在进入页面时冻结；TrafficSink 缺少 `instance_id/session_id/project/surface/occurred_at/path` 时只保留本地重试，不发送猜测值。

如果只配置一个 sink，Journal 仍使用同一套接口。`createAnalyticsCore()` 没有 resolver 时不会退化成本地放行，也不会创建 identity。

## 3. Router 与 Vue 3 指令

### 3.1 Router 模式

传入 `router` 后，插件内部只安装一个 Router adapter。重复给同一个 Router 安装同一个 client 会返回既有 handle；换另一个 client 会抛出 owner 冲突，避免双 session、双监听和双 PV。

Router 模式下 `v-track-page` 只补充 `page_key/layout_version` 元数据，不调用 `enterPage()`：

```vue
<main
    v-track-page="{
        page_key: 'index.home',
        layout_version: 'index-home-v2'
    }"
>
```

Router 必须提供 `matched[].path` 或受控的 `meta.analytics.route_pattern`。只允许静态段、`:param`、`:param?`、`*`、`**`；客户端自带正则、query 和 hash 会被拒绝。

首屏 `page_key` 应优先写在同步可用的 route `meta.analytics`；`v-track-page` 应挂在同步渲染的页面根节点，用于补 `layout_version` 或同值复核。异步/条件渲染后才出现的指令不会回写已经入 Journal 或已经发送的初始 PV。

也可以单独安装 adapter：

```js
import {
    createNavigationController,
    installVueRouterAnalytics,
} from "@jx3box/jx3box-common/js/analytics.js";

const navigation = createNavigationController({ client: analytics, runtime: window });
const routerHandle = installVueRouterAnalytics(navigation, router, { runtime: window });

// 卸载时：
routerHandle.destroy();
```

下一次导航会 finalize 上一条 Traffic delivery，补上 `duration_ms/is_exit=false`；`pagehide` 补 `is_exit=true` 并使用同一 `event_id` 走 Beacon，不再创建退出 PV。

### 3.2 `v-track-id` 与 `v-track`

`v-track-id` 为动态布局提供稳定 target key，不生成 CSS/DOM 全路径：

```vue
<section v-track-id="'index.activity'">...</section>
```

显式点击：

```vue
<a
    v-track-id="'index.matrix'"
    v-track:click="{
        name: 'index_matrix_click',
        props: { module_id: 'matrix', position: index }
    }"
>
```

曝光：

```vue
<section
    v-track:exposure.once="{
        name: 'index_module_exposure',
        id: 'index.posts',
        props: { module_id: 'posts' }
    }"
>
```

默认可见面积达到 50% 且持续 1 秒后上报；`.once` 在每个 `page_view_id` 内只报一次。无 `IntersectionObserver` 时降级为受控 scroll/resize 检查。

`interaction_target.id` 默认丢弃。确需上传公开交互 ID 时，Tracking 配置必须明确下发 `interaction_target_rules` 的 fixed allowlist 或 named validator。

## 4. Canonical 事件与两个 target

Canonical page view 只在本地 Journal 保存一份：

```json
{
  "schema_version": 1,
  "event_id": "canonical-page-view-id",
  "previous_event_id": "previous-page-view-id",
  "previous_canonical_event_id": "previous-event-of-any-type",
  "instance_id": "installation-id",
  "session_id": "session-id",
  "sequence_no": 8,
  "page_view_id": "page-view-id",
  "event_type": "page_view",
  "occurred_at": "2026-08-26T01:20:30.000Z",
  "project": "index",
  "surface": "pc_web",
  "domain": "www.jx3box.com",
  "game_client": "std",
  "page_key": "index.home",
  "route_pattern": "/index",
  "route_path": "/index",
  "is_entry": true
}
```

交互和公开对象必须分开：

```json
{
  "interaction_target": {
    "key": "index.banner",
    "type": "button"
  },
  "public_target": {
    "key": "id",
    "type": "item",
    "id": "12345",
    "variant": "item",
    "revision_id": "678"
  }
}
```

- Tracking 可读取 `interaction_target`；为兼容旧服务还会投影已验证的 flat `target_key/target_type/target_id`。
- Traffic 只读取 `public_target`，并编码为 `{ type, variant, id, revision_id }`；客户端规则中的 query key 不进入 Traffic payload。
- `revision_id` 只有显式 secondary query/path rule 且 named validator 通过时才出现。

完整的跨协议 fixture 见 [`fixtures/analytics-dual-sink-v1.json`](./fixtures/analytics-dual-sink-v1.json)。测试会实际验证两个 envelope 使用同一 `event_id`，且不存在 raw query/hash/full URL 字段。

## 5. CompositeRuleResolver

每个 sub-resolver 只能收到安全上下文：

```json
{
  "page_key": "index.home",
  "route_name": "index",
  "route_pattern": "/index",
  "layout_version": "index-home-v2",
  "project": "index",
  "product": "jx3box",
  "surface": "pc_web",
  "client": "pc_web",
  "game_client": "std",
  "domain": "www.jx3box.com"
}
```

它不会收到 `route.path/fullPath/query/hash/params`。raw query/params 只在 CompositeRuleResolver 的本地闭包中用于白名单 target 与 `canonical_path` 投影；未命中显式规则的值会被丢弃，不会合并进页面或 Journal。

### 5.1 Tracking 规则

```json
{
  "enabled": true,
  "page_key": "index.home",
  "route_pattern": "/index",
  "layout_version": "index-home-v2",
  "sample_rate": 1,
  "event_types": ["page_view", "click", "exposure", "scroll_depth"],
  "property_keys": ["module_id", "position", "depth_percent"],
  "interaction_target_rules": [
    {
      "target_key": "index.card",
      "target_type": "card",
      "validator": "positive_integer"
    }
  ],
  "rule_version": "tracking-2026-08-26"
}
```

### 5.2 Traffic query target 规则

普通固定类型：

```json
{
  "enabled": true,
  "page_key": "post.view",
  "route_pattern": "/post",
  "sample_rate": 1,
  "event_types": ["page_view"],
  "require_public_target": true,
  "query_targets": [
    {
      "query_key": "id",
      "target_type": "cms_post",
      "validator": "positive_integer",
      "required": true
    }
  ],
  "rule_version": "traffic-2026-08-26"
}
```

Game 的 `type + id + post_id`：

```json
{
  "enabled": true,
  "page_key": "game.wiki",
  "route_pattern": "/wiki",
  "sample_rate": 1,
  "event_types": ["page_view"],
  "require_public_target": true,
  "target": {
    "from": "query_variant",
    "type_key": "type",
    "id_key": "id",
    "default_variant": "achievement",
    "variants": {
      "achievement": { "type": "achievement", "validator": "positive_integer" },
      "item": { "type": "item", "validator": "digits_or_underscore" }
    }
  },
  "secondary": {
    "field": "revision_id",
    "from": "query",
    "key": "post_id",
    "validator": "positive_integer"
  },
  "rule_version": "traffic-2026-08-26"
}
```

### 5.3 Traffic path target 规则

动态 path 不上传原始 pathname。服务端必须把每个需要重建的参数绑定到内置 validator 或固定值白名单；target/secondary 的 path 参数会自动加入这一白名单：

```json
{
  "enabled": true,
  "page_key": "wiki.item.detail",
  "route_pattern": "/item/view/:item_id/:post_id?/:section?",
  "sample_rate": 1,
  "event_types": ["page_view"],
  "require_public_target": true,
  "target": {
    "from": "path",
    "key": "item_id",
    "type": "item",
    "validator": "digits_or_underscore"
  },
  "secondary": {
    "field": "revision_id",
    "from": "path",
    "key": "post_id",
    "validator": "positive_integer"
  },
  "path_params": {
    "section": { "allowed_values": ["overview", "history"] }
  },
  "rule_version": "traffic-2026-08-26"
}
```

模板中的任何必填动态段缺值、缺校验规则或校验失败时只关闭 Traffic；可选段缺值会从安全 `canonical_path` 中省略。未知 params、wildcard 的真实尾部和未声明字段不会离开设备。

内置 validator 固定为代码实现，不接受服务端下发正则或脚本：`positive_int/positive_integer`、`nonnegative_int`、`digits`、`digits_underscore/digits_or_underscore`、`bounded_slug/safe_slug`、`safe_short_id`、`safe_key`、`year`。

目标缺失或 validator 失败时：

- `require_public_target=true`：只关闭 Traffic sink；Tracking 仍可独立启用。
- `require_public_target=false`：Traffic 退化为 page-only，不携带 target。
- 两个 sink 均无有效规则：整页失败关闭，不建立页面上下文。

## 6. 单一持久 Journal

Journal entry 使用一份基础事件和逐 sink delivery：

```json
{
  "event": { "event_id": "same-id" },
  "queued_at": 1787700000000,
  "deliveries": {
    "tracking": { "state": "pending", "attempts": 0 },
    "traffic": { "state": "deferred", "attempts": 0 }
  }
}
```

状态为 `pending/deferred/retry/accepted/duplicate/rejected`。只有所有相关 sink 都到达终态后才移除基础事件。持久化记录内部版本为 v2，但继续读取同一 key 下的 v1；首次保存即升级为 v2，因此旧 9.3/9.4 无 delivery map 的本地队列只迁移到 Tracking，而降级后的旧 SDK 也不会把新 Journal 误投到 Tracking。

公开控制接口：

```js
queue.enqueue(event, {
    sinkKeys: ["tracking", "traffic"],
    deferredSinkKeys: ["traffic"],
});
queue.finalize(event.event_id, "traffic", {
    duration_ms: 32000,
    is_exit: true,
});
await queue.flush({ reason: "manual" });
queue.flushBeacon({ reason: "pagehide" });
queue.cancelInflight("config_refresh");
queue.clear("privacy_disable");
queue.block("robot", { clear: true, cancelInflight: true });
queue.unblock();
queue.destroy();
```

`block()` 会先设置阻断状态，再取消 timer/fetch、推进 generation 并清理内存与持久化；迟到响应不能复活队列。阻断期间 enqueue、fetch 和 Beacon 均停止。

全局或 sink 级 `beforeFlush(context)` 可以返回：

```js
false
{ allow: false }
{ blocked: "disabled", clear: true, cancelInflight: true }
```

hook 抛错时失败关闭，事件仍留本地。

Beacon 是同步补交通道，不能现场等待异步 `beforeFlush`。只要队列配置了全局 hook，`flushBeacon()` 就必须先取得同一 generation、同一 Journal revision 内最近一次 fetch flush 的成功授权；带 `beforeFlush` 的 sink 还必须取得该 sink 自己的成功授权。新一轮 guard 开始、`enqueue()` 新事件或普通 `finalize()` 修改 Traffic payload 时会先撤销旧授权，返回 `false`、抛错、`cancelInflight()`、`clear()`、`block()` 或 `unblock()` 也都会使授权失效；配置刷新应先调用 `cancelInflight("config_refresh")`。唯一例外是 Router 在 `pagehide` 追加的 SDK 生成字段：Queue 只在调用方显式请求、且 patch 严格限于有界 `duration_ms/is_exit/finalize_reason` 时保留当前授权，使同一监听器能先 finalize 再补交 Traffic；普通调用或超出白名单的 patch 仍会撤销授权。未配置任何 hook 的 legacy/Observer 队列仍可直接使用 Beacon。

Beacon 授权只控制是否允许补交，不改变 Journal delivery 状态，也不产生 ACK。

## 7. 可组合 HTTP sink

`createHttpSink()` 支持：

```js
createHttpSink({
    key: "tracking",
    endpoint: "/batch",
    accepts(event, enqueueOptions) {},
    defer(event, enqueueOptions) {},
    partition(events, context) {},
    encoder(events, context) {},
    ackDecoder(payload, { eventIds, events, response, status, context }) {},
    retryPolicy({ endpoint, error, eventIds, payload, response, retryAfterMs, status }) {},
    beaconEncoder(events, context) {},
    beforeFlush(context) {},
});
```

`ackDecoder` 的规范返回：

```js
{
    deliveries: [
        { event_id: "event-1", state: "accepted" },
        { event_id: "event-2", state: "duplicate" },
        { event_id: "event-3", state: "rejected", reason: "invalid" },
        { event_id: "event-4", state: "retry", retry_after_ms: 3000 },
    ],
    block: null,
    retry_after_ms: 0,
}
```

也兼容 `acknowledged_event_ids/accepted_event_ids/duplicate_event_ids/rejected_event_ids/retry_event_ids` 数组。只有当前 batch 中明确点名的 ID 才改变状态；2xx 空 ACK、未知状态、decoder 异常和批外 ID 都保留重试。

`retryPolicy` 返回 `{ action: "retry" | "reject" | "block", delayMs, reason, block }`。默认所有非 2xx 都不确认：409 等待 heartbeat，429 读取 `Retry-After`，网络错误/5xx 有限退避。encoder、ACK decoder 或 retry hook 抛错均不会丢事件。

## 8. 两个 batch 协议

### 8.1 TrackingSink

```json
{
  "schema_version": 1,
  "sdk_version": "1.1.0",
  "events": [
    {
      "event_id": "same-canonical-id",
      "event_type": "page_view",
      "page_key": "index.home",
      "route_pattern": "/index"
    }
  ]
}
```

### 8.2 TrafficSink

Traffic 按 `instance/session/surface/domain/game_client/entry_source` 分组：

```json
{
  "instance_id": "installation-id",
  "session_id": "session-id",
  "surface": "pc_web",
  "domain": "www.jx3box.com",
  "game_client": "std",
  "entry_source": { "referrer": "https://baidu.com/" },
  "events": [
    {
      "event_id": "same-canonical-id",
      "occurred_at": "2026-08-26T01:20:30.000Z",
      "project": "index",
      "path": "/index",
      "route_pattern": "/index",
      "page_key": "index.home",
      "previous_event_id": "previous-page-view-id",
      "sequence": 8,
      "is_entry": false,
      "is_exit": true,
      "duration_ms": 32000
    }
  ]
}
```

SDK 只把已经脱敏的 referrer hostname 重建为 origin，不传 referrer path/query。`path` 必须是不含 origin/query/hash 的安全 pathname；无法安全生成时使用 `/__unclassified__`。

## 9. 后端必须同步的 config 与 ACK

Tracking 与 Traffic 可以保留各自的数据表和 batch endpoint，但必须共享以下规则：

1. Config 明确返回 `enabled/page_key/route_pattern/sample_rate/event_types/rule_version`；Tracking 再返回 `layout_version/property_keys/interaction_target_rules`，Traffic 再返回 `require_public_target/query_targets`，或受控的 `target/secondary/path_params`。所有动态字段必须引用 SDK 已知的 named validator 或固定 `allowed_values`，不能下发正则或脚本。
2. Config 请求只能按安全上下文匹配；服务端不得要求客户端上传 raw query、实际动态 path 或完整 URL。
3. Batch 响应新增逐项 `items`：

```json
{
  "code": 0,
  "data": {
    "accepted": 1,
    "duplicate": 0,
    "rejected": 0,
    "items": [
      { "event_id": "event-1", "status": "accepted" }
    ],
    "blocked": null,
    "retry_after_ms": 0,
    "rule_version": "2026-08-26"
  }
}
```

`status` 只允许 `accepted/duplicate/rejected/retry`，可选 `reason/retry_after_ms`。旧 count 字段可保留给旧调用方，但 9.5 Journal 不依据 count 出队。

4. 机器人或全局停用返回可信的 `blocked="robot" | "disabled"`。即使没有逐项 ID，SDK 也会原子 block 并清空 Journal。
5. 409 表示实例尚未完成 heartbeat 注册，不能确认事件；429 同时返回 HTTP `Retry-After` 或 `data.retry_after_ms`；任何非 2xx 都不能携带可被当作 ACK 的语义。
6. accepted、duplicate、永久 rejected 都是该 sink 的终态；retry 继续使用原 `event_id`。后端必须以 event ID 幂等。

当前 service-cms 已提供独立 Traffic Config、逐 `event_id` 的 `items` ACK、409/429 重试语义、机器人持久阻断和 JSON/Beacon 共用的严格校验链路；9.5.2 消费端可按上述契约接入。9.5.2 进一步保证纯 page-only 动态参数只在设备内校验，Traffic payload 只携带注册模板。生产解锁仍必须以迁移已执行、heartbeat 返回显式 `traffic_allowed`、真实 Config/ACK 回读和灰度开关为准，不能只凭包版本判断。

## 10. 从 9.3/9.4 迁移

- 旧 `createAnalytics()` 和无 Router 的 `v-track-page` 仍保留，适合现有单 Tracking 接入；它不自动启用 Traffic。
- 新项目使用 `createAnalyticsCore()`、单一 Router owner 和显式 sink。不要在 `jx3box-ui`、业务入口和页面组件分别创建 client。
- 先升级到 common 9.5.2，再部署已实现 Traffic Config 与逐 ID ACK 的 service-cms，之后按 `jx3box-ui -> game -> mobile` 顺序接入；每个应用入口只安装一次 Router adapter。
- 现有 index 若随后通过公共 UI 层启用 Traffic，必须复用同一个 Core，不能保留第二套首页 Analytics 实例。
- 旧本地事件只投 Tracking；Observer 继续使用独立队列和默认关闭语义。
- 9.4 `createTransport` 的 `eventIdProvider/envelopeFactory/confirmationParser/beaconBodyFactory` 仍兼容；同时修正为任何非 2xx 都不再虚构 ACK。

## 11. 服务端隐私复核

- UID 只从 `jwt_optional` credentials 获取；IP、UA 只从请求上下文获取，不能信任 SDK payload。
- heartbeat、Tracking、Traffic 和 Observer 分表，事件不能增加 heartbeat `report_count` 或伪造 DAU。
- 服务端再次校验页面注册、域名、事件类型、属性、采样、route pattern、公开 target、限流与机器人状态。
- 原始事件不保存完整 IP、query/hash、DOM 文本、表单值、搜索词、Token 或完整 referrer。
- iframe 热力底图只是管理端展示层，事件仍由被分析页面自身的 SDK 采集。


### 9.5.7 外部搜索词

Traffic 首入口（pc_web/mobile_web）从 document.referrer 本地提取受控搜索参数，通过 `entry_source.search_keyword` 发送；完整来源 path/query/hash 不进入 Journal 或请求。百度 wd/word，Bing/Google/360/神马 q，搜狗 query/keyword，仅匹配受控搜索引擎域名。词做 NFKC 和空白规范化，最长 128 单元，不转小写；无法提取时发送空串，旧 SDK 则不包含此字段。服务端仍验证来源和入口资格。Tracking payload 不包含关键词。

发布要求：先部署支持该字段的 service-cms（含搜索词迁移和汇总 worker），再发布 common 9.5.7 并升级消费仓 lockfile/重新构建。旧后端不接受这个新增字段。新 SDK 已支持不代表源站构建已经使用新版；浏览器默认跨域来源通常只有 origin，不能保证拿到词。站内搜索和 App 入口不属于本次采集范围。
