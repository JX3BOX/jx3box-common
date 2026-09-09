# 页面追踪 V2（Vue 3）

入口：`@jx3box/jx3box-common/js/page-tracking.js`。该模块独立于旧版 analytics 采集器，通过服务端配置决定是否启用，使用 V2 config/batch 接口。

```js
import { createPageTracker } from "@jx3box/jx3box-common/js/page-tracking.js";
import { createIdentity } from "@jx3box/jx3box-common/js/analytics.js";

const tracker = createPageTracker({
    runtime: window,
    router,
    identity: createIdentity({ runtime: window }),
    endpoint: `${cmsApiBase}/system/stat/tracking/v2`,
    // 可选：返回鉴权请求头，不在公共包内读取业务 token。
    headersProvider: () => ({}),
    getLayoutVersion: () => router.currentRoute.value.meta.analytics?.layout_version || "web-v1",
});
app.use(tracker);
```

安装后由公共包管理应用根生命周期：根组件 mounted 时启动，成功路由切换后刷新配置，根组件 beforeUnmount 时清理监听。无需 App.vue 指令或包装元素。一个应用只安装一个 tracker；不要再同时手动调用 mount。显式提前停止可调用 tracker.destroy()。

定向事件使用 `v-track:click="'index.posts.open'"`，仅后台启用的事件键被接收。页面访问、点击坐标和滚动深度由插件采集，事件批量上报；不采集输入框文本或表单值。

采集入口不限制域名，任意域名均可接入；使用 pathname（不是 hash 路由），移动断点 1133px。是否启用采集由服务端对应域名与路径的注册配置决定。本地是否允许由后端控制。

管理端预览 flag `jx3box_analytics_preview=1` 下只运行预览桥接。此场景应直接创建 tracker，省略 identity，避免创建访问身份。首页项目已有此分支。

本次抽离保持既有行为，包括忽略输入区域、弹窗、公共头部等规则。首页直接从公共包导入采集器和指令。发布包含此文件的新版本后，首页需要升级依赖并部署；本地 node_modules 文件同步只用于验证，不代表已发布。

采集上下文不再包含 game_client，后端根据 domain + route_path 识别页面。本地模拟时可传 `getDomain: () => "www.jx3box.com"`（或另一已注册域名），后端须允许本地 Origin。首页正式服/怀旧服内容切换属于项目业务，已移回首页 `src/utils/game-client.js`。
