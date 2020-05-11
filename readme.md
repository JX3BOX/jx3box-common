# JX3BOX
公共基础函数模块，路径常量，外部通用接口地址，全局主题等

## Step.1 Install
```
npm install @jx3box/jx3box-common
```

## Step.2 Import
```javascript
const {JX3BOX , Utils} = require('@jx3box/jx3box-common');
```
或
```javascript
const JX3BOX = require('@jx3box/jx3box-common/js/jx3box');
```

## JX3BOX模块说明
```json
{
    // 主域名
    "__Domain": "www.jx3box.com",   

    // 访问路径
    "__Root": "https://www.jx3box.com/",            //旧版
    "__v2": "https://v2.jx3box.com/",               //新版·DNS解析为cdn+ecs+github
    "__Github": "https://github.jx3box.com/",       //github镜像

    // 后端服务
    "__server": "https://server.jx3box.com/",       //用户,发布
    "__api": "https://api.jx3box.com/",             //评论,搜索,百科
    "__helperUrl": "https://helper.jx3box.com/",    //消息,成就,中台
    "__git": "https://git.jx3box.com/",             //插件
    "__node": "https://node.jx3box.com/",           //核心应用
    "__spider": "https://spider.jx3box.com/",       //边缘应用
    "__proxy": "https://proxy.jx3box.com/",         //日本代理
    "__fn": "https://fn.jx3box.com/",               //文章

    // OSS镜像
    "__ossRoot": "https://oss.jx3box.com/",         //上传节点
    "__ossMirror": "https://console.cnyixun.com/",  //国内CDN
    "__ossCloudflare": "https://jx3box.imkog.com/", //国外CDN

    // 前端资源
    "__staticPath" : {                              
        "jsdelivr" : "https://cdn.jsdelivr.net/gh/JX3BOX/",         //css+js·jsdelivr
        "mirror": "https://console.cnyixun.com/static/"             //css+js·oss cdn
    },
    "__dataPath": "https://cdn.jsdelivr.net/gh/JX3BOX/jx3box-data", //json·jsdelivr 

    // 图片资源
    "__imgPath": "https://img.jx3box.com/",         //jx3box-oss图片·github
    "__iconPath": "https://icon.jx3box.com/",       //jx3-icon游戏美术资源·github

    // 文章类型
    "__postType": {
        "macro": "剑三宏库",
        "jx3dat": "插件数据",
        "fb": "副本攻略",
        "bps": "职业攻略",
        "cj": "成就百科",
        "share": "捏脸分享",
        "tool": "教程工具",
        "help": "帮助文档",
        "post": "茶馆交流",
    },

    // 用户组
    "__userGroup":{
        "0" : "游客",
        "1" : "普通用户",
        "8" : "已验证用户",
        "16" : "VIP会员",
        "32" : "签约作者",
        "64" : "管理员"
    },

    // 用户等级
    "__userLevel" : {
        "0" : "稻香萌新"
    },

    // 绝对链接
    "__Links" : {
        "account" : {
            "login" : "https://v2.jx3box.com/account/login",
            "register" : "https://v2.jx3box.com/account/register",
            "email_verify" : "https://v2.jx3box.com/account/email_verify",
            "login_callback" : "https://v2.jx3box.com/account/login_callback",
            "oauth_server" : "https://server.jx3box.com/oauth/jx3box/authorize"
        },
        "dashboard" : {
            "home" : "https://v2.jx3box.com/dashboard",
            "work" : "https://v2.jx3box.com/dashboard/#/work",
            "msg" : "https://v2.jx3box.com/dashboard/#/msg",
            "feed" : "https://v2.jx3box.com/dashboard/#/feed",
            "fav" : "https://v2.jx3box.com/dashboard/#/fav",
            "profile" : "https://v2.jx3box.com/dashboard/#/profile",
            "connect" : "https://v2.jx3box.com/dashboard/#/connect",
            "publish" : "https://v2.jx3box.com/dashboard/publish"
        },


        "author" : "https://v2.jx3box.com/author/", 
        "about" : "https://v2.jx3box.com/about/",


        "search" : "https://search.jx3box.com/",
        "wiki": "https://wiki.jx3box.com/",
        "jx3": "https://xn--3-4g8a959k.com/",
        "git": "https://git.jx3box.com/",

    },

    // 其它
    "default_avatar": "https://console.cnyixun.com/image/common/avatar.png",
    "feedback" : "https://mail.qq.com/cgi-bin/qm_share?t=qm_mailme&email=o8LHzsrN48nbkMHM243AzM4"

}

```