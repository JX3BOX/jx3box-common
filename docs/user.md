# User

```javascript
import User from "@jx3box/jx3box-common/js/user.js";
```

## 1.判断用户是否登录 `User.isLogin()`

```javascript
let status = User.isLogin();
// => true 或 false
```

## 2.获取用户信息 `User.getInfo()`

```javascript
let profile = User.getInfo();
// => 返回一个用户信息对象
```

可链式获取指定值

```javascript
let uid = User.getInfo().uid; //用户ID,未登录用户为0,登录用户为其ID
let group = User.getInfo().group; //用户用户组ID,未登录用户为0,登录用户>0
```

其它信息

-   `name` 昵称
-   `avatar_origin` 原头像
-   `avatar` 头像
-   `bio` 签名

## 3.获取用户组

并不能真实作为判别依据，只是用来做权级划分

-   `isEmailMember()` 判断是否邮箱验证(8)
-   `isPhoneMember()` 判断是否绑定手机(16)
-   `isSuperAuthor()` 判断是否为签约作者(32)
-   `isAdmin()` 判断是否为编辑(64)
-   `isSuperAdmin()` 判断是否为管理员(128)
-   `isSystemAdmin()` 判断是否为超管(512)

## 4.是否为会员

-   `isVIP()` 是否为高级会员或者专业会员
-   `isPRO()` 是否专业会员
    返回的是一个 promise，后续处理请自行判断

## 5.用户其他资产（购买权限等）

-   `getAsset()` 返回一个 Promise

#### 资产模板

```javascript
{
    was_vip: 0,
    expire_date: "1970-02-02T16:00:00.000Z",
    total_day: 0,
    was_pro: 0,
    pro_expire_date: "1970-02-02T16:00:00.000Z",
    pro_total_day: 0,
    rename_card_count: 0, //改名卡
    namespace_card_count: 0, //铭牌购买次数
    box_coin: 0,    //盒币
    points: 0,  //积分
}
```

## 6.获取 JWT 令牌 `User.getToken()`

```javascript
let token = User.getToken();
```

用于部分场景无法通过 cookie 效验时。附带令牌信息在 basic auth 的 username 中，password 中放置备注信息。  
axios 请求示例：

```javascript
axios
    .post(
        API,
        {
            data,
        },
        {
            auth: {
                username: token,
                password: "some remark",
            },
        }
    )
    .then((res) => {
        //鉴权成功
    })
    .catch((err) => {
        console.log(err);
    });
```

## 7.注销 `User.destroy()`

登出注销

## 8.跳转登录并重定向 `User.toLogin()`

```javascript
User.toLogin(); //无参数时自动跳回当前调用页面
User.toLogin($url); //登录后跳转至指定页面
```
