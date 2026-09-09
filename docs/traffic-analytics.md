# 访问分析 SDK

`js/analytics.js` 中的 Core、Identity、Queue、TrafficSink 和 Vue 3 接入层仍用于访问分析。页面事件追踪与热力图使用独立的 `js/page-tracking.js`，见 [接入说明](./page-tracking.md)。

访问分析的配置接口为 `/system/traffic/config`，提交接口为 `/system/traffic/visits/batch`，均在 CMS `/api/cms` 前缀下。PC 栏目（包括首页）通过 jx3box-ui 的 CommonHeader 安装 Router 监听采集访问 PV，无需 `v-track-page`；定向点击使用 `v-track:click`。

首页不再单独配置 Traffic sink，范围由公共头与后端规则决定。不要为页面事件追踪添加旧 Tracking sink。访问分析详细协议以 service-cms/docs/stat/2-visit/client-traffic-analysis.md 和 traffic-frontend-integration.md 为准。
