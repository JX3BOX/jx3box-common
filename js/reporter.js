import { Reporter } from "@jx3box/reporter";
import { __Domain } from "../data/jx3box.json";
import { v4 as uuidv4 } from "uuid";
import User from "./user";

/**
 * 16进制转int
 * @param {string} str
 * @returns
 */
function int162hex(str) {
    let hex = str.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

/**
 * 二进制转hex
 * @param {string} str
 * @returns
 */
function bin2hex(str) {
    let result = "";
    for (let i = 0; i < str.length; i++) {
        result += int162hex(str.charCodeAt(i));
    }
    return result;
}

/**
 * 获取uuid
 */
function getUUID(domain = __Domain) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const txt = domain;
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText(txt, 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText(txt, 4, 17);

    const b64 = canvas.toDataURL().replace("data:image/png;base64,", "");
    const bin = atob(b64);
    const crc = bin2hex(bin.slice(-16, -12));
    return crc;
}

function getCookies() {
    const cookies = localStorage.getItem("reporter_cookies");
    if (cookies) {
        return cookies;
    } else {
        const uuid = uuidv4();
        localStorage.setItem("reporter_cookies", uuid);
        return uuid;
    }
}

// 立即上报，不通过指令
export function reportNow(binding) {
    const { use_query = false, caller, data } = binding;
    const R = new Reporter({
        caller,
        userId: User.getInfo().uid,
        use_query: use_query,
    });
    R.p({ uuid: getUUID(), cookies: getCookies(), ...data });
}

/**
 * 统计指令
 *
 * 使用方法
 * 1. 在main.js中引入，reporter.install(Vue); import reporter from "@jx3box/jx3box-common/js/reporter"
 * 2. 在需要上报的元素上添加v-reporter指令
 * 3. v-reporter指令的值为一个对象，包含以下属性
 *  user_id: 用户id 使用User.getInfo().uid获取
 *  use_query: 是否上报当前页面中url中的参数 默认false
 *  caller: 上报来源
 *  data: 上报数据
 */
const reporter = {
    /**
     * 上报指令 vue2
     * @param {boolean} use_query 是否上报当前页面中url中的参数 默认false
     * @param {string} caller 上报来源
     * @param {object} data 上报数据
     */
    install(Vue) {
        Vue.directive("reporter", {
            bind: function (el, binding) {
                const { use_query = false, caller, data } = binding.value;

                const R = new Reporter({
                    caller,
                    use_query, // 上报当前页面中url中的参数 默认false
                    userId: User.getInfo().uid, // 当前登录用户id
                });
                el.clickHandler = function () {
                    R.p({ uuid: getUUID(), cookies: getCookies(), ...data });
                };

                el.addEventListener("click", el.clickHandler);
            },
            unbind: function (el) {
                el.removeEventListener("click", el.clickHandler);
                el.clickHandler = null;
            },
        });
    },

    /**
     * 上报指令 vue3
     * @param {string} user_id 用户id 使用User.getInfo().uid获取
     * @param {boolean} use_query 是否上报当前页面中url中的参数 默认false
     * @param {string} caller 上报来源
     * @param {object} data 上报数据
     */
    installVue3(app) {
        app.directive("reporter", {
            mounted(el, binding) {
                const { user_id, use_query = false, caller, data } = binding.value;

                const R = new Reporter({
                    caller,
                    use_query, // 上报当前页面中url中的参数 默认false
                    userId: user_id, // 当前登录用户id
                });
                el.clickHandler = function () {
                    R.p({ uuid: getUUID(), ...data });
                };

                el.addEventListener("click", el.clickHandler);
            },
            unmounted(el) {
                el.removeEventListener("click", el.clickHandler);
                el.clickHandler = null;
            },
        });
    },
};

export default reporter;
