# Axios

导出三种不同格式的拦截器

```javascript
import {
    installInterceptors,
    installNextInterceptors,
    installHelperInterceptors,
    installCmsInterceptors,
} from "@jx3box/jx3box-common/js/interceptors.js";
```

- cms+uc+next使用installNextInterceptors
- server+spider+node使用installInterceptors
- helper使用installHelperInterceptors

本项目大部分时候不应该被直接使用，需集中配置在[https](./https.md)实例中

## 拦截器
### installInterceptors
默认拦截器，只要请求成功就返回响应内容  
除非网络请求非200，会使用错误响应内容中进行报错提示
一般响应如下：
+ 成功,状态码200
```
{
    code : 任意值,
    data : 内容,
    msg : 提醒
}
```
+ 失败,状态码非200
```
{
    code : 任意值,
    data : 内容,
    msg : 提醒
}
```

### installNextInterceptors
Next拦截器，即使请求成功，可能也存在业务错误码
一般响应如下：
+ 成功,状态码200
```
{
    code : 0,
    data : 内容,
    msg : 提醒
}
```
+ 失败,状态码200或非200
```
{
    code : 业务错误码,
    data : 内容,
    msg : 提醒
}
```


### installHelperInterceptors
Helper拦截器，即使请求成功，需要再次校验code作为业务成功码（同状态码）
一般响应如下：
+ 成功,状态码200
```
{
    code : 200,
    data : 内容,
    message : 提醒
}
```
+ 失败,状态码非200
```
{
    code : 业务错误码|状态码,
    data : 内容,
    message : 提醒
}
```