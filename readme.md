# JX3BOX
公共基础函数模块，路径常量，外部通用接口地址，全局主题等

## Step.1 Install
```
npm install @jx3box/jx3box-common
```

## Step.2 Import
```javascript
import {JX3BOX , Utils} from '@jx3box/jx3box-common';
```

## JX3BOX模块说明
```javascript
{
    // 主域名
    "__Domain": "www.jx3box.com",   

    // 访问路径
    "__Root": "https://www.jx3box.com/",            //旧版
    "__v2": "https://v2.jx3box.com/",               //过渡版本
    "__Github": "https://github.jx3box.com/",       //github镜像

    // 后端服务
    "__server": "https://server.jx3box.com/",       //主服务
    "__helperUrl": "https://helper.jx3box.com/",    //成就,中台,消息
    "__bb": "https://bb.jx3box.com/",               //百科,表情

    "__next": "https://next.jx3box.com/",           //游戏应用接口
    "__api": "https://api.jx3box.com/",             //评论
    "__git": "https://git.jx3box.com/",             //插件gitea
    "__hub": "https://hub.jx3box.com/",             //插件hub源

    "__node": "https://node.jx3box.com/",           //核心应用
    "__spider": "https://spider.jx3box.com/",       //边缘应用
    "__proxy": "https://proxy.jx3box.com/",         //日本代理

    // OSS镜像
    "__ossRoot": "https://oss.jx3box.com/",         //上传节点
    "__ossMirror": "https://console.cnyixun.com/",  //国内CDN
    "__ossCloudflare": "https://jx3box.imkog.com/", //国外CDN

    // 前端资源
    "__staticPath" : {
        "origin": "https://oss.jx3box.com/static/",     
        "github": "https://jx3box.github.io/",
        "jsdelivr" : "https://cdn.jsdelivr.net/gh/JX3BOX/",
        "mirror": "https://console.cnyixun.com/static/"
    },

    // 静态资源
    "__dataPath": "https://data.jx3box.com/",       
    "__imgPath": "https://img.jx3box.com/",
    "__iconPath": "https://icon.jx3box.com/",

    // 文章类型
    "__postType": {
        "macro": "剑三宏库",
        "jx3dat": "插件数据",
        "fb": "副本攻略",
        "bps": "职业攻略",
        "share": "捏脸分享",
        "house": "家园分享",
        "tool": "教程工具",
        "post": "茶馆交流",
    },
    "__otherType": {
        "cj": "成就百科",
        "item":"物品百科",
        "emotion":"趣图表情",
        "wiki":"剑三百科",
        "question":"剑三题目",
        "paper":"剑三试卷"
    },

    // 用户组
    "__userGroup":{
        "0" : "游客",
        "1" : "普通用户",
        "8" : "邮箱已验证",
        "16" : "手机已绑定",
        "32" : "签约作者",
        "64" : "管理员",
        "128" : "超级管理员"
    },

    // 用户等级
    "__userLevel" : {
        "1" : "稻香萌新"
    },

    // 常用链接
    "__Links" : {
        "account" : {
            "login" : "/account/login",
            "register" : "/account/register",
            "email_verify" : "/account/email_verify",
            "login_callback" : "/account/login_callback"
        },
        "dashboard" : {
            "home" : "/dashboard",
            "work" : "/dashboard/#/work",
            "msg" : "/dashboard/#/msg",
            "feed" : "/dashboard/#/feed",
            "fav" : "/dashboard/#/fav",
            "profile" : "/dashboard/#/profile",
            "connect" : "/dashboard/#/connect",
            "publish" : "/dashboard/publish"
        }
    },

    // 其它
    "__jx3": "https://xn--3-4g8a959k.com/",     //剑网3.com
    "default_avatar": "https://img.jx3box.com/image/common/logo2.png",        //默认头像
    "feedback" : "https://mail.qq.com/cgi-bin/qm_share?t=qm_mailme&email=o8LHzsrN48nbkMHM243AzM4"   //反馈邮件地址

}

```