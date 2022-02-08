# HTTPS 通用请求模块

```javascript
import { $next,$cms,$node,$helper } from "@jx3box/jx3box-common/js/request.js";
```

## 参数说明
调用函数返回一个axios实例。  

## 可选参数
- `mute`: 出错错误时，是否出现POP报错（默认为true），显示设置为false时，报错将静默
- `pop`: pop对象 `{type:message/notify/alert,title:<string>,desc:<msg>,style:error/success/info/warning}`
- `proxy` : 是否需要在开发环境下请求由本地代理(鉴权接口将均经过本地代理，无鉴权版可自行确定)
- `port` : 代理模式下端口
- `domain` : 指定域名（其他域名使用相同包装器时）

## 示例

### 1.默认请求
```javascript
$cms().get(`/api/cms/app/pz/$id`).then()
```

### 2.静默pop
```javascript
$next({mute:true}).get(`/path/to`).then()
```

### 3.指定pop
```javascript
$helper({
    pop : {
        type : 'notify',
        title : '成功',
        desc : '操作成功',
        style : 'success'
    }
}).get(`/path/to`).then()
```

### 4.本地测试
```javascript
$node({proxy:true,port:7002}).get(`/path/to`).then()
```

### 5.指定域名

```javascript
$spider({domain:__spider}).get(`/path/to`).then()
```
