# HTTPS 通用请求模块

```javascript
import { $https, $_https } from "@jx3box/jx3box-common/js/https.js";
```

## `$https(server,options)`（无鉴权）
不会发送cookie和basic auth

## `$_https(server,options)`（有鉴权）
会发送cookie和basic auth，并默认将请求代理到本地，如果本地前端没有登录则不会发送请求


## 参数说明
调用函数返回一个axios实例。  
### server（必填参数，string类型）
指定常用主服务域，可选值：
- `server`: __server （旧CMS）
- `uc`: __uc 用户中心
- `cms`: __cms CMS系统
- `node`: __node 剑三数据库
- `spider`: __spider 爬虫代理
- `next`: __next 小胡后端服务
- `pay`: __pay 支付系统
- `helper`: __helper 百科系统

### options（可选参数，Object类型）
可选KEY：
- `proxy` : 是否需要在开发环境下请求由本地代理(鉴权接口将均经过本地代理，无鉴权版可自行确定)
- `interceptor` : 设置使用的拦截器，无设置时使用默认拦截器，详细说明见[axios](./axios.md)。
    可选值：
    - `default`:installInterceptors
    - `next` :installNextInterceptors
    - `helper` :installHelperInterceptors
- `mute`: 出错错误时，是否出现POP报错（默认为true），显示设置为false时，报错将静默
- `popType`: 默认使用message，可选值：message,alert,notify

## 示例
### 立即调用
```javascript
$https('helper').post(path,...)
$_https('next').put(path,...)
$_https('server',{
    interceptor : 'next'
}).get(path,...)
```

### 二次封装
当产品项目内部的请求比较统一时，可以再次简化
```javascript
const $helper = $https('helper',{
    proxy : false,
    interceptor : 'helper'
})
$helper.get(path,...)
```

### 快捷方式
```javascript
$helper()       //使用苦瓜自己的后端包装模式
$cms()          //使用浮烟+小胡统一的后端包装模式
$next()         //使用浮烟+小胡统一的后端包装模式
$team()         //使用浮烟+小胡统一的后端包装模式
```
