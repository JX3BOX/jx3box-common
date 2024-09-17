import { showAvatar } from "./utils";
import { $pay, $cms } from "./request";
import {
    __Links,
    default_avatar,
    __server,
    __userLevel,
} from "../data/jx3box.json";
import { tokenExpires } from "../data/conf.json";
import Fingerprint2 from "fingerprintjs2";

class User {
    constructor() {
        // TOKEN有效期
        this.expires = tokenExpires;
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

        // 资产缓存
        this.asset = "";
    }

    // 检查当前状态
    check() {
        if (this.isLogin()) {
            this.profile.uid = localStorage && localStorage.getItem("uid");
            this.profile.group =
                (localStorage && localStorage.getItem("group")) || 1;
            this.profile.token = localStorage && localStorage.getItem("token");
            this.profile.name = localStorage && localStorage.getItem("name");
            this.profile.status =
                localStorage && localStorage.getItem("status");
            this.profile.bind_wx =
                localStorage && localStorage.getItem("bind_wx");
            this.profile.avatar_origin =
                (localStorage && localStorage.getItem("avatar")) ||
                default_avatar;
            this.profile.avatar = showAvatar(this.profile.avatar_origin, "s");
            this.profile.permission =
                localStorage && localStorage.getItem("jx3box_permission");
            this.profile.is_teammate =
                localStorage && localStorage.getItem("is_teammate");
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
        this.created_at = !localStorage.getItem("created_at")
            ? -Infinity
            : localStorage.getItem("created_at");
        this.logged_in =
            localStorage.getItem("logged_in") == "true" ? true : false;
        return this.logged_in && Date.now() - this.created_at < this.expires;
    }

    // 判断是否已过期
    isExpired() {
        return Date.now() - this.created_at > this.expires;
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
                //如果localStorage不存在或已满
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

    // 获取用户基础缓存信息
    getInfo() {
        this.check();
        return this.profile;
    }

    // 销毁登录状态
    async destroy() {
        return $cms()
            .post("api/cms/user/account/email/logout")
            .finally(() => {
                localStorage.removeItem("created_at");
                localStorage.setItem("logged_in", "false");
                localStorage.removeItem("token");
                localStorage.removeItem("jx3box_permission");
            });
    }

    // 跳转至登录
    toLogin(url) {
        url = url ? encodeURIComponent(url) : encodeURIComponent(location.href);
        location.href = __Links.account.login + "?redirect=" + url;
    }

    // 获取本地令牌
    getToken() {
        return this.getInfo().token;
    }

    // 获取UUID
    getUUID() {
        return localStorage.getItem("device_id");
    }

    // 判断是否邮箱验证
    isEmailMember() {
        return this.getInfo().group >= 8;
    }

    // 判断是否绑定手机
    isPhoneMember() {
        return this.getInfo().group >= 16;
    }

    // 判断是否为管理员|编辑
    isEditor() {
        return this.getInfo().group >= 64;
    }

    // 判断是否为管理员|运营
    isAdmin() {
        return this.getInfo().group >= 128;
    }

    // 判断是否为管理员|开发
    isDeveloper() {
        return this.getInfo().group >= 256;
    }

    // 判断是否为超管
    isSuperAdmin() {
        return this.getInfo().group >= 512;
    }

    // 判断是否为签约作者
    isSuperAuthor() {
        if (this.isLogin()) {
            return $cms()
                .get("/api/cms/user/is_super_author/" + this.getInfo().uid)
                .then(res => {
                    return res.data.data;
                });
        } else {
            return new Promise((resolve, reject) => {
                resolve(false);
            });
        }
    }

    // 判断是否为团队成员
    isTeammate() {
        return this.getInfo().is_teammate == "true";
    }

    // 是否绑定微信
    hasBindwx() {
        return this.getInfo().bind_wx;
    }

    // PRE身份判断
    _isVIP(asset) {
        let isPRE = asset.was_vip;
        if (isPRE) {
            let isExpired = new Date(asset.expire_date) - new Date() > 0;
            return isExpired;
        } else {
            return false;
        }
    }
    // PRO身份判断
    _isPRO(asset) {
        let isPRO = asset.was_pro;
        if (isPRO) {
            let isExpired = new Date(asset.pro_expire_date) - new Date() > 0;
            return isExpired;
        } else {
            return false;
        }
    }

    // 判断是否为VIP
    isVIP() {
        if (this.asset) {
            return new Promise((resolve, reject) => {
                resolve(this._isPRO(this.asset) || this._isVIP(this.asset));
            });
        } else {
            return this.getAsset().then(asset => {
                return this._isPRO(asset) || this._isVIP(asset);
            });
        }
    }

    // 判断是否为PRO
    isPRO() {
        if (this.asset) {
            return new Promise((resolve, reject) => {
                resolve(this._isPRO(this.asset));
            });
        } else {
            return this.getAsset().then(asset => {
                return this._isPRO(asset);
            });
        }
    }

    // 获取用户资产
    getAsset() {
        if (!this.isLogin()) {
            return new Promise((resolve, reject) => {
                let asset = {
                    was_vip: 0,
                    expire_date: "1970-02-02T16:00:00.000Z",
                    total_day: 0,
                    was_pro: 0,
                    pro_expire_date: "1970-02-02T16:00:00.000Z",
                    pro_total_day: 0,
                    rename_card_count: 0,
                    had_renamed: 0,
                    namespace_card_count: 0,
                    box_coin: 0,
                    points: 0,
                };
                this.asset = asset;
                // 空资产
                resolve(asset);
            });
        } else {
            return $pay()
                .get("/api/vip/i")
                .then(res => {
                    let asset = res.data.data;
                    this.asset = asset;
                    return asset;
                });
        }
    }

    // 获取用户等级
    getLevel(exp) {
        for (let level in __userLevel) {
            let range = __userLevel[level];
            if (exp >= range[0] && exp < range[1]) {
                return ~~level;
            }
        }
    }

    // 用户是否有权限
    hasPermission(permission) {
        if (this.getInfo().group >= 512) return true;
        let userPermission = this.getInfo().permission;
        if (userPermission) {
            const permissions = userPermission.split(",");
            return permissions.includes(permission);
        } else {
            return false;
        }
    }

    // 生成设备指纹
    generateFingerprint(callback) {
        const cache = localStorage.getItem("jx3box_fingerprint");
        if (cache) {
            return cache;
        }
        Fingerprint2.get(function (components) {
            const values = components.map((component) => component.value);
            const murmur = Fingerprint2.x64hash128(values.join(""), 31);

            localStorage.setItem("jx3box_fingerprint", murmur);
            callback(murmur);
        });
    }

    // 获取设备指纹
    getDeviceFingerprint() {
        return localStorage.getItem("jx3box_fingerprint");
    }
}

export default new User();
