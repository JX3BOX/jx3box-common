const { showAvatar } = require("./utils");
const {__Links,default_avatar} = require('./jx3box');

class User {
    constructor() {
        // TOKEN有效期
        this.expires = 14400000;
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
            this.profile.uid = localStorage.getItem("uid");
            this.profile.group = localStorage.getItem("group") || 1;
            this.profile.name = localStorage.getItem("name");
            this.profile.avatar_origin = localStorage.getItem("avatar") || default_avatar;
            this.profile.avatar = showAvatar(this.profile.avatar_origin,'s')
            this.profile.bio = localStorage.getItem("bio") || '';
        } else {
            this.profile = this.anonymous;
        }
        return this;
    }

    // 更新指定缓存字段
    refresh(key,val){
        return localStorage.setItem(key,val);
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

    // 保存用户资料
    _save(data){
        localStorage.setItem("created_at", Date.now());
        localStorage.setItem("logged_in", true);
        localStorage.setItem("token", data.token);
        localStorage.setItem("uid", data.uid);
        localStorage.setItem("group", data.group);
        localStorage.setItem("name", data.name);
        localStorage.setItem("avatar", data.avatar);
        localStorage.setItem("bio", data.bio);
    }

    // 更新用户资料
    update(data){
        return new Promise((resolve,reject)=>{
            try {
                this._save(data)
                resolve(this)
            } catch (err) {
                //如果localstorage不存在或已满
                if (localStorage) {
                    localStorage.clear();
                    this._save(data)
                    resolve(value)
                } else {
                    reject(new Error('localStorage不可用'))
                }
            }
        })
    }

    // 销毁登录状态
    destroy() {
        // for非鉴权接口
        localStorage.removeItem("created_at");
        localStorage.setItem("logged_in", "false");
        // for鉴权接口
        localStorage.removeItem("token");
    }

    // 跳转至登录
    toLogin(url){
        url = encodeURIComponent(url) || encodeURIComponent(location.href)
        location.href = __Links.account.login + '?redirect=' + url
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
