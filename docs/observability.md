# 前端异常与接口健康 Observer

`@jx3box/jx3box-common/js/observability.js` 提供两条彼此独立的观测链：运行异常样本，以及 Axios 接口健康分钟聚合。它复用 Analytics 的匿名安装标识、有界持久队列、确认发送和隐私基础能力，但不会把 Error/HTTP 数据混入页面事件协议。

## 1. 显式启用

Observer 默认关闭。仅导入模块或升级公共包不会创建 `instance_id`、读取队列、安装全局监听、拦截 Axios 或发送请求。宿主必须同时提供 `enabled: true`、合法项目元数据，并显式调用 `start()`/`observeAxios()`：

```js
import {
    createClientObserver,
    createVue3ErrorObserverPlugin,
} from "@jx3box/jx3box-common/js/observability.js";

const observer = createClientObserver({
    enabled: true,
    projectKey: "index",
    environment: import.meta.env.MODE === "production" ? "production" : "development",
    release: __APP_VERSION__,
    webVersion: __APP_VERSION__,
    client: "pc_web",
    platform: "windows",
    router,
});

observer.start();
app.use(createVue3ErrorObserverPlugin(observer));
```

必须在应用卸载或测试结束时同时执行：

```js
observer.destroy();
```

`projectKey`、`release` 为空或枚举元数据非法时失败关闭。版本、客户端和平台会在事件进入队列时快照；旧队列不会在应用升级后被错误归入新 release。

## 2. 捕获范围

### 2.1 Window、Promise、Vue 3 与 Router

`start()` 默认安装 `window.error` 与 `unhandledrejection`，并在 Web 的 `hidden/pagehide` 时用 Beacon 机会性补交。它不会读取 `location.pathname`；传入 `router` 后：

- `router.onError` 记录路由运行异常；
- 初始化与 `afterEach` 都只读取 `currentRoute/route.matched[].path` 的模板；没有 matched 模板时不回退到 `path/fullPath`；
- 不读取或上传 `fullPath`、`query`、`params`、组件实例、props/state 或 DOM。

Vue 3 插件链式保留宿主原有 `app.config.errorHandler`。插件 `destroy()` 或 Observer `destroy()` 会恢复原处理器。

手动捕获只接受异常对象和受控上下文：

```js
observer.captureError(error, {
    source: "startup",
    severity: "fatal",
    route_pattern: "/index",
});
```

所有运行异常都按 source 使用固定泛化 message；原始 `Error.message` 与 `context.message` 不进入队列。`error_name` 只允许常见规范错误类名，否则回退到安全类名。stack 丢弃首行消息和非 frame 文本，只保留最多 50 条再次脱敏的 Chrome/Firefox/Safari frame。Promise primitive reason 与资源加载错误同样不会保留原值或 `src/href`。

### 2.2 Axios

自建实例显式接入：

```js
const disposeAxios = observer.observeAxios(http, {
    serviceKey: "cms",
    resolveRoute(config) {
        return routeTemplates[config.url];
    },
    classifyResponse(response) {
        return !response.data?.code;
    },
});
```

模板优先级固定为：

1. 单次请求的 `telemetryRoute`；
2. `resolveRoute(config)`；
3. 自动规范化 URL path。

自动规范化会移除 origin、query、fragment，并将数字、UUID 和长随机 Hash 段替换为 `:id`。显式 `telemetryRoute/resolveRoute` 会在 SDK 内标为可信模板并原样保留合法静态段；这个内部标记不会进入服务端 Envelope。可以用请求级 `skipTelemetry: true` 或 `telemetry: false` 跳过；两个上报端点始终自动忽略。

接口结果按 `success/business_error/http_4xx/http_5xx/timeout/network/offline/cancelled` 聚合；延迟使用 `<300ms`、`300ms-1s`、`1s-3s`、`3s-10s`、`>=10s` 五档。每分钟只排队聚合增量，不为成功请求逐条上报。hidden/flush 会闭合当前增量并生成稳定 `metric_id`；后续同一分钟的新请求使用新的增量 ID。若 `latency_sum_ms` 或计数即将超过服务端 `1e9` 上限，SDK 会在同一分钟提前闭合并以新 `metric_id` 续写，不截断延迟数据。

Axios Error、Error.response 与 Promise reason 使用 `Symbol.for("jx3box.telemetry.event_id")` 加 WeakMap 做对象级去重。Axios 失败默认只进入接口健康并标记对象；随后同一对象进入 `unhandledrejection` 时不再重复生成运行 Issue。确需把请求失败同时作为运行异常试点时，可显式设置 `captureRequestErrors: true`，最多生成一条 `request_unhandled`。拦截器保持成功值和 rejection 对象身份不变，观察器内部异常不会改变业务请求语义。

## 3. 公共请求器接入

`js/api.js` 仍默认不安装 Observer。宿主可在创建 `$cms/$next/...` 实例前显式注册：

```js
import { setHttpObserver, $cms } from "@jx3box/jx3box-common/js/api.js";

const unregister = setHttpObserver(observer);
const cms = $cms();
```

公共工厂覆盖 `$cms/$next/$helper/$node/$http`，以及复用 `$next` 的 `$team/$pay/$lua/$pull`。`interceptor:false` 只关闭原业务拦截器，`mute:true` 只关闭 UI 提示；二者都不隐式关闭已经显式启用的 Observer。工厂级 `telemetry:false` 单独关闭该实例。

公共包导出的裸 `axios`、消费者自行 `axios.create()`、SSE、fetch/XHR 和 App 自有 requester 不会自动接入，需分别调用 `observer.observeAxios()` 或使用对应适配。

## 4. Web 与原生发送

Web 默认使用普通 fetch 作为可确认主通道：

```text
POST /api/cms/system/stat/errors/batch
POST /api/cms/system/stat/api-metrics/batch
```

Beacon 只在 hidden/pagehide 时补交，使用 `application/json` Blob，且不确认出队；下次 fetch 使用同一 ID 重试并等待服务端逐项 ACK。

Capacitor/Harmony 不进入核心依赖。App 注入自己的原生 HTTP 回调：

```js
import {
    DEFAULT_ERROR_ENDPOINT,
    DEFAULT_METRIC_ENDPOINT,
    createCapacitorTransportAdapter,
} from "@jx3box/jx3box-common/js/observability.js";

const cmsOrigin = "https://cms.jx3box.com"; // 按实际环境注入

const nativeFetch = createCapacitorTransportAdapter(async ({ url, method, headers, data }) => {
    const response = await CapacitorHttp.request({ url, method, headers, data });
    return { status: response.status, data: response.data };
});

const observer = createClientObserver({
    enabled: true,
    // 其余元数据略
    fetch: nativeFetch,
    transportMode: "native",
    // 原生 HTTP 没有浏览器 base URL，两个 endpoint 必须是绝对地址。
    errorEndpoint: new URL(DEFAULT_ERROR_ENDPOINT, cmsOrigin).href,
    metricEndpoint: new URL(DEFAULT_METRIC_ENDPOINT, cmsOrigin).href,
});
```

Harmony 使用 `createHarmonyTransportAdapter(request)`，传入的 `request` 必须是 App 自己封装后的“最终响应 Promise”，并最终返回 `{ status, data }`。现有 raw bridge 若先同步返回 `102`、再通过全局回调给最终结果，不能直接传入；应先在 App 内按 request ID 等待全局回调，只在最终状态到达时 resolve：

```js
const harmonyFetch = createHarmonyTransportAdapter(({ url, method, headers, data }) => {
    return requestWithHarmonyBridge({ url, method, headers, data });
    // requestWithHarmonyBridge 由 App 实现：102 仅表示已受理，
    // 必须等待对应 request ID 的最终 { status, data }。
});
```

核心不会 import Capacitor、ArkTS 或任何 App 文件；原生 adapter 自带禁 Beacon 标记，`transportMode: "native"` 还能保证 adapter 被 `.bind()` 或宿主函数再次包装后仍不回退到 Web Beacon。App 在前台恢复/网络恢复时调用 `observer.flush()`。任何非 2xx、包括中间态 `102`，都不会被当成服务端 ACK，队列只会在收到逐项 `accepted/duplicate/ignored_robot` 后出队。

## 5. 协议与确认

运行异常批次为根级 metadata + `events`；接口健康批次为根级 metadata + `metrics`。两者使用独立本地 key、独立 endpoint、独立 ACK 解析，且不会加入 Analytics 的 `{schema_version, events}` 页面事件 Envelope。

服务端响应 `data.items` 中 `accepted`、`duplicate`、`ignored_robot` 均为终态确认；未知状态留队重试。`is_robot` 只由服务端可信 UA/IP 规则判断并在写入前硬阻断，客户端不提交也不能覆盖该字段。

默认本地保存上限：

- 运行异常 100 条；
- HTTP 聚合 200 条；
- 每条链最多 256 KiB、7 天；
- 每批最多 20 条、44 KiB，给服务端 48 KiB Envelope 上限预留 metadata 空间；
- 网络异常、429、5xx 使用固定 ID 做有限退避重试。

服务端完整样本建议在线保留 30 天；这是运维保留建议，不代表此 SDK 或后端自动创建删除任务。Issue、日报和周期聚合可长期保留。

## 6. 隐私硬边界

Observer 的队列和 Envelope 仅保留协议白名单。禁止采集或序列化：

- URL query、fragment、Basic Auth、OSS/CDN 签名；
- headers、Authorization、Cookie、Token、请求参数和请求体；
- response.data、响应正文和业务对象；
- DOM、组件状态、表单值、搜索词、聊天/文章正文及用户输入；
- UID、IP、UA、邮箱、手机号、身份证与客户端自报 `is_robot`。

`headersProvider` 只用于发送上报请求时动态提供认证头；返回值不进入队列。服务端仍须执行字段白名单、二次脱敏、限流、幂等和 robot 写入前阻断。

## 7. 生命周期与状态

- `start()`：显式安装 Window/Router/可选 Axios 监听；
- `observeAxios(instance, options)`：安装并返回对称 eject disposer；
- `captureError(error, context)`：受控手动异常；
- `setRoute(pattern)`：只传入宿主已确认的路由模板，维护规范化路由面包屑；
- `flush()`：闭合 HTTP 增量并用 fetch 等待 ACK；
- `flushBeacon()`：hidden 补交，不删除队列；
- `getState()`：只返回开关、队列数量、ID 和路由模板，不返回错误正文；
- `destroy()`：恢复 handler/eject interceptors，闭合并持久化当前增量，不擅自等待网络。
