import axios from "axios";
import Vue from "vue";
import { Message, Notification } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
const broadcast = new Vue();
import { __pay } from "./jx3box.json";
import User from './user'

// $pay
function installNextInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                console.log(response.data.code)
                // 自动重新登录
                if(response.data.code == 401){
                    User.destroy().then(() => {
                        User.toLogin()
                    })
                }else{
                    broadcast.$message.error(
                        `[${response.data.code}]${response.data.msg}`
                    );
                    return Promise.reject(response);
                }
            }
            return response;
        },
        function (err) {
            if (err.response && err.response.data) {
                broadcast.$message.error(`${err.response.data.msg}`);
            } else {
                broadcast.$message.error("网络请求异常");
            }
            console.log(err);
            return Promise.reject(err);
        }
    );
}

const $pay = axios.create({
    withCredentials: true,
    baseURL: process.env.NODE_ENV === "production" ? __pay : "/",
});
installNextInterceptors($pay);


// 用户资产
function getAsset() {
    return $pay.get("api/vip/i").then((res) => {
        return res.data.data;
    });
}


// VIP相关
// =============================================
// 判断函数
function hasVIP(data){
    let isPRE = data.was_vip;
    if (isPRE) {
        let isExpired = new Date(res.data.data.expire_date) - new Date() > 0;
        return isExpired
    } else {
        return false;
    }
}
function hasPRO(data){
    let isPRO = data.was_pro;
    if (isPRO) {
        let isExpired = new Date(res.data.data.pro_expire_date) - new Date() > 0;
        return isExpired
    } else {
        return false;
    }
}


// 是否为PRE
function isPRE() {
    return $pay.get("api/vip/i").then((res) => {
        if (!res.data.code) {
            return hasVIP(res.data.data)
        } else {
            reject(res.data.msg);
        }
    });
}

// 是否为PRO
function isPRO() {
    return $pay.get("api/vip/i").then((res) => {
        if (!res.data.code) {
            return hasPRO(res.data.data)
        } else {
            reject(res.data.msg);
        }
    });
}

// 是否为VIP(PRE或PRO)
function isVIP() {
    return $pay.get("api/vip/i").then((res) => {
        if (!res.data.code) {
            return hasPRO(res.data.data) || hasVIP(res.data.data) 
        } else {
            reject(res.data.msg);
        }
    });
}

export { $pay, getAsset, hasVIP,hasPRO,isPRE,isPRO,isVIP };
