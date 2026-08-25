# Analytics 事件追踪 SDK

`@jx3box/jx3box-common/js/analytics.js` 提供框架无关的事件队列、页面上下文、稳定采样、隐私过滤和 Web 发送能力；Vue 3 指令只是适配层。它不替代旧 `js/stat.js` 的内容计数，也不包含异常 Issue/Fingerprint 聚合。

## 1. 设计边界

- 未进入已注册页面时，不生成实例 ID、不读取持久队列、不采集、不发送。
- `instance_id` 复用 heartbeat 的 `jx3box:device_id`，兼容旧 `device_id` 与历史非 UUID 值；UID、IP、UA 均不由 SDK payload 提交。
- 稳定采样只使用 `instance_id + sample_salt`。页面采样率变化仍保持嵌套样本，未来跨页面路径不会因页面重新抽样而断裂。
- query、hash、DOM 文本、表单值、Cookie、Token 和任意嵌套属性不会进入事件。
- fetch 是可确认主通道；sendBeacon 仅在隐藏/离页时机会性补交。Beacon 返回 true 后事件仍保留，下次 fetch 继续使用同一 `event_id`，由服务端幂等确认。
- 默认本地最多 200 条、256 KiB、7 天；每批最多 20 条、60 KiB；网络异常、429、5xx 有限退避重试。

## 2. 基础接入

```js
import {
    createAnalytics,
    createRemotePageResolver,
    createVue3AnalyticsPlugin,
} from "@jx3box/jx3box-common/js/analytics.js";

const runtime = window;
const resolvePage = createRemotePageResolver({
    runtime,
    endpoint: "/api/cms/system/stat/tracking/config",
});

const analytics = createAnalytics({
    runtime,
    endpoint: "/api/cms/system/stat/tracking/batch",
    resolvePage,
    product: "jx3box",
    client: "pc_web",
    gameClient: "std",
    sampleSalt: "jx3box-analytics-v1",
});

app.use(createVue3AnalyticsPlugin(analytics, { runtime }));
```

远端页面配置请求失败、页面未注册或 `enabled=false` 时会失败关闭，不建立 active page context。

## 3. Vue 3 指令

### `v-track-page`

只有挂载该指令且远端注册成功的页面才采集。挂载产生一次 `page_view`，卸载后所有自动采集立即停止。

```vue
<main
    v-track-page="{
        page_key: 'index.home',
        route_name: 'index',
        route_pattern: '/index',
        route_path: '/index',
        layout_version: 'index-home-v1',
        event_types: ['page_view', 'click', 'exposure', 'scroll_depth']
    }"
>
```

### `v-track-id`

为动态布局提供稳定目标。自动点击会寻找最近的 `data-track-id`，不会生成 CSS/DOM 全路径。

```vue
<section v-track-id="'index.activity'">...</section>
```

### `v-track:click`

显式点击语义与自动热力点击合并成一条 `click` 事件。

```vue
<a
    v-track-id="`index.matrix.${item.uuid}`"
    v-track:click="{
        name: 'index_matrix_click',
        props: { item_id: item.uuid, position: index }
    }"
>
```

### `v-track:exposure.once`

默认可见面积达到 50% 且持续 1 秒后上报；`.once` 在每个 `page_view_id` 内只报一次。无 `IntersectionObserver` 时降级到受控的 scroll/resize 可见性检查。

```vue
<section
    v-track-id="'index.posts'"
    v-track:exposure.once="{
        name: 'index_module_exposure',
        props: { module_id: 'posts' }
    }"
>
```

## 4. 页面注册响应

浏览器访问 `GET /api/cms/system/stat/tracking/config`。服务内部路由为 `GET /system/stat/tracking/config`，成功响应至少返回：

```json
{
    "data": {
        "page_key": "index.home",
        "enabled": true,
        "sample_rate": 0.1,
        "layout_version": "index-home-v1",
        "event_types": ["page_view", "click", "exposure", "scroll_depth"],
        "property_keys": ["module_id", "item_id", "position", "depth_percent"]
    }
}
```

`page_key`、`enabled=true`、合法 `sample_rate`、非空 `event_types` 都必须由服务端明确返回，且事件类型必须包含 `page_view`；缺失、业务错误或空 `data` 均失败关闭。`property_keys` 为空时默认拒绝全部业务属性。

页面注册是采集开关，不是“所有相同域名页面均采集”。例如仅注册 `/index` 时，`/index/tv` 与 `/index/download` 不会建立页面上下文。请求携带的 domain 只是服务端复核与环境区分维度，不能替代页面注册。

## 5. 批量协议

```json
{
    "schema_version": 1,
    "sdk_version": "1.0.0",
    "events": [
        {
            "event_id": "uuid-v4",
            "instance_id": "stable-device-id",
            "session_id": "uuid-v4",
            "sequence_no": 1,
            "page_view_id": "uuid-v4",
            "occurred_at": "2026-08-26T00:00:00.000Z",
            "timezone_offset": -480,
            "event_type": "page_view",
            "page_key": "index.home",
            "route_name": "index",
            "route_pattern": "/index",
            "route_path": "/index",
            "layout_version": "index-home-v1",
            "product": "jx3box",
            "client": "pc_web",
            "game_client": "std",
            "domain": "www.jx3box.com"
        }
    ]
}
```

响应必须返回具体 ID，而不能只返回 count：

```json
{
    "acknowledged_event_ids": ["accepted-or-duplicate-event-id"],
    "rejected_event_ids": [],
    "retry_event_ids": []
}
```

accepted、duplicate 和永久 rejected 均可确认出队；retry 保留。若 Beacon 首次匿名入库，随后带认证 fetch 重放同一事件，后端应允许在幂等命中时补齐服务端 UID。

Beacon 使用简单请求可发送的纯文本 JSON，且没有确认语义；Hapi 路由需在对象校验前支持该字符串 JSON 的解析。普通 fetch 使用 JSON 与动态认证 Header，是最终确认通道。

## 6. 通用页面与路径上下文

事件保留 `session_id`、`sequence_no`、`page_view_id`、`page_key`、`route_name`、`route_pattern`、`route_path`、`from_*` 和 `navigation_type`。后续路径分析可以直接复用同一 identity、queue 和 transport，不另建第二套访问 SDK。

动态对象使用受控的 `target_type/target_id` 或属性白名单，不把 ID 扩散进 `route_name`，也不上传完整 URL。

## 7. 生命周期

- `analytics.flush()`：普通 fetch 确认发送。
- `analytics.flushBeacon()`：机会性补交，不删除队列。
- `analytics.leavePage(pageKey)`：关闭指定页面上下文。
- `analytics.destroy()`：移除队列定时器；Vue 插件的 `destroy()` 还会移除 click/scroll/pagehide 监听。
- session 空闲超过 30 分钟后，下一条业务事件前会先创建新的 `page_view_id` 并补发 `navigation_type=session_resume` 的 `page_view`。

## 8. 后端与隐私要求

- heartbeat 与事件链路分表；事件不能增加 heartbeat `report_count` 或伪造 DAU。
- UID 只从 `jwt_optional` credentials 获取；IP、UA 只从请求获取。
- 服务端再次校验页面注册、域名、事件类型、属性、采样和限流。
- 原始事件不保存完整 IP、query/hash、DOM 文本或表单值。
- iframe 热力底图只是管理端展示层，事件仍由被分析页面自身的 SDK 采集。
