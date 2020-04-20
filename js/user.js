const { showAvatar } = require("./utils");
const {__Links,default_avatar} = require('./jx3box');

class User {
    constructor() {
        // TOKEN有效期
        this.expires = 43200000;
        this.created_at = 0;
        // 登录状态
        this.logged_in = false;

        // 缓存资料
        this.profile = {};
        this.anonymous = {
            uid: 0,
            group: 0,
            name: "未登录",
            avatar: showAvatar(null,'s'),
            bio: "凭栏望千里，煮酒论江湖。",
            avatar_origin : default_avatar
        };
    }

    // 检查当前状态
    check() {
        if (this.isLogin()) {
            let profile = JSON.parse(localStorage.getItem("profile"));
            // 头像处理
            profile.avatar_origin = profile.avatar
            profile.avatar = showAvatar(profile.avatar_origin,'s');
            this.profile = profile;
        } else {
            this.profile = this.anonymous;
        }
        return this;
    }

    // 判断是否已登录
    isLogin() {
        this.created_at =
            localStorage.getItem("created_at") == null
                ? -Infinity
                : localStorage.getItem("created_at");
        this.logged_in =
            localStorage.getItem("logged_in") == "true" ? true : false;
        return this.logged_in && Date.now() - this.created_at < this.expires;
    }

    // 销毁登录状态
    destory() {
        // for非鉴权接口
        localStorage.removeItem("created_at");
        localStorage.setItem("logged_in", "false");
        localStorage.setItem("profile", this.anonymous);
        // for鉴权接口
        localStorage.removeItem("token");
    }

    // 跳转至登录
    toLogin(url){
        url = url || location.href
        location.href = __Links.login + '?redirect=' + url
    }

    // 获取用户基础缓存信息
    getInfo() {
        this.check();
        return this.profile;
    }

    // 获取本地令牌
    getToken() {
        return localStorage.getItem("token");
    }

    // 获取UUID
    getUUID() {
        return localStorage.getItem("device_id");
    }
}
module.exports = new User();
