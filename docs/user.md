# User模块

**记得先npm install更新**

## Import
```javascript
const {User} = require('@jx3box/jx3box-common');
```

## Usage
### 1.获取用户信息 `User.getInfo()`
```javascript
let profile = User.getInfo()
// => 返回一个用户信息对象
```
可以直接链获取指定值
```javascript
let uid = User.getInfo().uid    //用户ID,未登录用户为0,登录用户为其ID
let group = User.getInfo().group    //用户用户组ID,未登录用户为0,登录用户>0
```
其它信息
+ `name` 昵称
+ `avatar` 头像
+ `bio` 签名
+ `avatar_origin` 原头像

**未登录用户**

### 2.获取JWT令牌 `User.getToken()`
```javascript
let token = User.getToken()
```
Token令牌用于请求需要鉴权的接口时，附带令牌信息在basic auth的username中，password中放置备注信息。  
axios请求示例：
```javascript
axios
    .post(
        API,
        {
            key:val
        },
        {
            auth: {
                username: token,
                password: 'some remark'
            },
        }
    )
    .then((res) => {
        //鉴权成功
    })
    .catch((err) => {
        if(err.response.data.code == 9999){
            //无效令牌
        }else{
            //网络异常
        }
    });
```

### 3.获取UUID `User.getUUID()`
```javascript
let uuid = User.getUUID()
```
仅识别当前设备，可作为非重要信息的额外随机字符串附加值
用户不主动清除将会保持不变（即设备ID），无需登录即可读取


### 4.重置销毁 `User.destory()`
对于token失效或无效，总是返回错误码***9999***，当遇到9999时，可能由于卡在令牌失效的边界区，本地静态前端缓存并未做检测，此时提交请求可能出现失败，如遇到此情况应总是设定清除本地用户缓存信息，并引导用户重新登录。

注意为了让用户登录后重新返回当前提交页面，需要携带`redirect=callback`以指定回调。
再跳转至登录之前，发布页面等应在跳转前预先将内容临时存储在IndexedDB。
```javascript
.catch((err) => {
    if(err.response.data.code){
        //无效令牌
        if(err.response.data.code == 9999){

            //1.注销
            User.destory()

            //2.保存未提交成功的信息
            //请保存至IndexedDB,勿占用localstorage

            //3.跳转至登录页携带redirect
            //如果使用异步保存，请在回调中执行
            User.toLogin(url) 
            //不指定url时则自动跳回当前所在页面

        }
    }else{
        //网络异常
    }
}); 
```
