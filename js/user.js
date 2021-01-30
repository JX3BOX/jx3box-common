const axios = require("axios");
const { showAvatar } = require("./utils");
const { __Links, default_avatar, __server, __pay } = require("./jx3box.json");

const $server = axios.create({
    withCredentials: true,
    baseURL: __server,
});
const $next = axios.create({
    withCredentials: true,
    baseURL: __pay,
});

class User {
    constructor() {
        // TOKEN有效期
        this.expires = 2592000000;
        this.created_at = 0;
        // 登录状态
        this.logged_in = false;

        // 缓存资料
        this.profile = {};
        this.anonymous = {
            uid: 0,
            group: 0,
            name: "未登录",
            status: 0,
            bind_wx: 0,
            avatar: showAvatar(null, "s"),
            avatar_origin: default_avatar,
        };
    }

    // 检查当前状态
    check() {
        if (this.isLogin()) {
            this.profile.uid = localStorage && localStorage.getItem("uid");
            this.profile.group = localStorage && localStorage.getItem("group") || 1;
            this.profile.name = localStorage && localStorage.getItem("name");
            this.profile.status = localStorage && localStorage.getItem("status");
            this.profile.bind_wx = localStorage && localStorage.getItem("bind_wx");
            this.profile.avatar_origin = localStorage && localStorage.getItem("avatar") || default_avatar;
            this.profile.avatar = showAvatar(this.profile.avatar_origin, "s");
        } else {
            this.profile = this.anonymous;
        }
        return this;
    }

    // 更新指定缓存字段
    refresh(key, val) {
        return localStorage.setItem(key, val);
    }

    // 判断是否已登录
    isLogin() {
        this.created_at =
            !localStorage.getItem("created_at")
                ? -Infinity
                : localStorage.getItem("created_at");
        this.logged_in =
            localStorage.getItem("logged_in") == "true" ? true : false;
        return this.logged_in && (Date.now() - this.created_at < this.expires);
    }

    // 保存用户资料
    _save(data) {
        localStorage.setItem("created_at", Date.now());
        localStorage.setItem("logged_in", true);
        localStorage.setItem("token", data.token);
        localStorage.setItem("uid", data.uid);
        localStorage.setItem("group", data.group);
        localStorage.setItem("name", data.name);
        localStorage.setItem("status", data.status);
        localStorage.setItem("bind_wx", data.bind_wx);
        localStorage.setItem("avatar", data.avatar);
    }

    // 更新用户资料
    update(data) {
        return new Promise((resolve, reject) => {
            try {
                this._save(data);
                resolve(this);
            } catch (err) {
                //如果localstorage不存在或已满
                if (localStorage) {
                    localStorage.clear();
                    this._save(data);
                    resolve(value);
                } else {
                    reject(new Error("localStorage不可用"));
                }
            }
        });
    }

    // 销毁登录状态
    destroy() {
        return $server.post("account/logout").then((res) => {
            localStorage.removeItem("created_at");
            localStorage.setItem("logged_in", "false");
            localStorage.removeItem("token");
            return res;
        });
    }

    // 跳转至登录
    toLogin(url) {
        url = url ? encodeURIComponent(url) : encodeURIComponent(location.href);
        location.href = __Links.account.login + "?redirect=" + url;
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

    // 判断是否邮箱验证
    isEmailMember() {
        return this.isLogin() && this.profile.group >= 8;
    }

    // 判断是否绑定手机
    isPhoneMember() {
        return this.isLogin() && this.profile.group >= 16;
    }

    // 判断是否为签约作者
    isSuperAuthor() {
        return this.isLogin() && this.profile.group >= 32;
    }

    // 判断是否为管理员
    isAdmin() {
        return this.isLogin() && this.profile.group >= 64;
    }

    // 判断是否为超级管理员
    isSuperAdmin() {
        return this.isLogin() && this.profile.group >= 128;
    }

    // 判断是否为系统管理员
    isSystemAdmin() {
        return this.isLogin() && this.profile.group >= 256;
    }

    // 是否绑定微信
    hasBindwx() {
        return localStorage.getItem("bind_wx");
    }

    // 判断是否为VIP
    isVIP() {
        return $next.get("api/vip/i").then((res) => {
            if (!res.data.code) {
                let isVIP = res.data.data.was_vip;
                if (isVIP) {
                    let isExpired =
                        new Date(res.data.data.expire_date) - new Date() > 0;
                    return isExpired
                } else {
                    return false;
                }
            } else {
                reject(res.data.msg);
            }
        });
    }
}

module.exports = new User();
