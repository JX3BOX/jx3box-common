// 统一 API 封装（由 https_v2.js / https.js / request.js 合并）
import axios from "axios";
import domains from "../data/jx3box.json";
import { SSE } from "./sse";
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";
import utilModule, { getTokenFromUrl } from "./utils";

const { jx3ClientType } = utilModule;

function readAuthToken() {
    const tokenFromUrl = getTokenFromUrl();
    if (tokenFromUrl) return tokenFromUrl;
    return (localStorage && (localStorage.getItem("__token") || localStorage.getItem("token"))) || "";
}

let __cachedClientEnv;
function getClientEnv() {
    if (__cachedClientEnv) return __cachedClientEnv;
    const env = {};

    // Vue CLI / webpack DefinePlugin：把 process.env.X 替换为字符串字面量
    // 注意：这里用 try/catch 避免在无 bundler 的纯浏览器环境直接引用 process 报错
    try {
        Object.assign(env, {
            NODE_ENV: process.env.NODE_ENV,
            VUE_APP_PROXY_ENABLE: process.env.VUE_APP_PROXY_ENABLE,
            VUE_APP_PROXY_PREFIX: process.env.VUE_APP_PROXY_PREFIX,
            VUE_APP_CMS_API: process.env.VUE_APP_CMS_API,
            VUE_APP_NEXT_API: process.env.VUE_APP_NEXT_API,
            VUE_APP_TEAM_API: process.env.VUE_APP_TEAM_API,
            VUE_APP_PAY_API: process.env.VUE_APP_PAY_API,
            VUE_APP_LUA_API: process.env.VUE_APP_LUA_API,
            VUE_APP_NODE_API: process.env.VUE_APP_NODE_API,
            VUE_APP_HELPER_API: process.env.VUE_APP_HELPER_API,
            VUE_APP_PULL_API: process.env.VUE_APP_PULL_API,
        });
    } catch (e) {
        // noop
    }

    // 运行时注入（推荐）：由宿主项目（Vue CLI / Vite / Nginx）注入
    if (typeof globalThis !== "undefined" && globalThis.__ENV__ && typeof globalThis.__ENV__ === "object") {
        Object.assign(env, globalThis.__ENV__);
    }

    // Vue CLI / webpack DefinePlugin 注入：在构建时把 process.env 替换为对象字面量
    if (typeof process !== "undefined" && process.env && typeof process.env === "object") {
        Object.assign(env, process.env);
    }

    __cachedClientEnv = env;
    return env;
}

function isLocalLikeHost(hostname) {
    const host = String(hostname || "")
        .trim()
        .toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;
    if (host.endsWith(".local")) return true;

    // 简单覆盖常见内网 IP 段
    if (host.startsWith("10.")) return true;
    if (host.startsWith("192.168.")) return true;
    const m = host.match(/^172\.(\d+)\./);
    if (m) {
        const seg = Number(m[1]);
        if (seg >= 16 && seg <= 31) return true;
    }
    return false;
}

function readEnv(key) {
    const env = getClientEnv();
    if (Object.prototype.hasOwnProperty.call(env, key)) return env[key] ?? "";
    return "";
}

function localProxyEnabled(options) {
    if (options && options.proxy === false) return false;
    if (options && options.proxy === true) return true;

    const raw = (readEnv("VUE_APP_PROXY_ENABLE") || "").toString().toLowerCase();
    if (raw) return raw === "1" || raw === "true" || raw === "yes" || raw === "on";

    // 宿主未注入 VUE_APP_PROXY_ENABLE 的情况下：本地开发默认启用（避免 CORS）
    // 前提是 running on a local-like host；生产环境一般不会是本地 host
    if (typeof window !== "undefined" && isLocalLikeHost(window.location && window.location.hostname)) return true;

    return false;
}

function localProxyBase(serviceKey) {
    const prefix = readEnv("VUE_APP_PROXY_PREFIX") || "/__proxy";
    return `${prefix}/${serviceKey}`;
}

function loadPop(msg, popType = "message") {
    const message = msg || "网络请求异常";
    switch (popType) {
        case "message":
            ElMessage({ message, type: "error" });
            break;
        case "alert":
            ElMessageBox.alert(message, "错误");
            break;
        case "notify":
            ElNotification({ title: "错误", message, duration: 3000 });
            break;
        default:
            ElMessage({ message, type: "error" });
            break;
    }
}

function throwError(err) {
    console.log(err?.response);
    return Promise.reject(err);
}

function loadDefaultRequestErrorPop(err, popType = "message") {
    const status = err?.response?.status ?? "";
    const statusText = err?.response?.statusText ?? "Request Error";
    loadPop(`[${status}]${statusText}`, popType);
}

function installInterceptors(target, options) {
    const popType = (options && options.popType) || "message";
    target.interceptors.response.use(
        (response) => response,
        (err) => {
            if (!options || !options.mute) {
                if (err?.response?.data?.msg) {
                    loadPop(err.response.data.msg, popType);
                } else {
                    loadDefaultRequestErrorPop(err, popType);
                }
            }
            return throwError(err);
        },
    );
}

function installStandardInterceptors(target, options) {
    const popType = (options && options.popType) || "message";
    target.interceptors.response.use(
        (response) => {
            if (response?.data?.code) {
                if (!options || !options.mute) {
                    response.data.msg && loadPop(`[${response.data.code}]${response.data.msg}`, popType);
                }
                return Promise.reject(response);
            }
            return response;
        },
        (err) => {
            if (!options || !options.mute) {
                if (err?.response?.data?.msg) {
                    loadPop(err.response.data.msg, popType);
                } else {
                    loadDefaultRequestErrorPop(err, popType);
                }
            }
            return throwError(err);
        },
    );
}

function installHelperInterceptors(target, options) {
    const popType = (options && options.popType) || "message";
    target.interceptors.response.use(
        (response) => {
            const code = response?.data?.code;
            if (code === 200 || !code) return response;
            if (!options || !options.mute) {
                loadPop(`[${code}]${response?.data?.message || ""}`, popType);
            }
            return Promise.reject(response);
        },
        (err) => {
            if (!options || !options.mute) {
                loadDefaultRequestErrorPop(err, popType);
            }
            return throwError(err);
        },
    );
}

function $cms(options = {}, axiosConfig = {}) {
    const { interceptor = true, domain, progress } = options;
    const requestDomain = domain || readEnv("VUE_APP_CMS_API") || domains.__cms;
    const token = readAuthToken();

    const config = {
        withCredentials: true,
        auth: { username: token || "", password: "cms common request" },
        baseURL: localProxyEnabled(options) ? localProxyBase("cms") : requestDomain,
        headers: {},
    };
    if (progress) config.onUploadProgress = progress;

    const ins = axios.create(Object.assign(axiosConfig, config));
    interceptor && installStandardInterceptors(ins, options);
    return ins;
}

function $helper(options = {}) {
    const domain = (options && options.domain) || readEnv("VUE_APP_HELPER_API") || domains.__helperUrl;
    const token = readAuthToken();

    const config = {
        withCredentials: true,
        auth: { username: token || "", password: "helper common request" },
        baseURL: localProxyEnabled(options) ? localProxyBase("helper") : domain,
        headers: {
            Accept: "application/prs.helper.v2+json",
            "JX3-Client-Type": (options && options.client_id) || jx3ClientType(),
        },
    };

    if (options && options.headers) {
        config.headers = Object.assign(config.headers, options.headers);
    }

    const ins = axios.create(config);
    installHelperInterceptors(ins, options);
    return ins;
}

function $next(options = {}, axiosConfig = {}) {
    const { interceptor = true, domain, progress } = options;
    const requestDomain = domain || readEnv("VUE_APP_NEXT_API") || domains.__next;
    const token = readAuthToken();
    const serviceKey = (options && options.serviceKey) || "next";

    const config = {
        withCredentials: true,
        auth: { username: token || "", password: "next common request" },
        baseURL: localProxyEnabled(options) ? localProxyBase(serviceKey) : requestDomain,
        headers: {},
    };
    if (progress) config.onUploadProgress = progress;

    const ins = axios.create(Object.assign(axiosConfig, config));
    interceptor && installStandardInterceptors(ins, options);
    return ins;
}

function $team(options = {}) {
    const requestDomain = (options && options.domain) || readEnv("VUE_APP_TEAM_API") || domains.__team;
    return $next(Object.assign({}, options, { domain: requestDomain, serviceKey: "team" }));
}

function $pay(options = {}) {
    const requestDomain = (options && options.domain) || readEnv("VUE_APP_PAY_API") || domains.__pay;
    return $next(Object.assign({}, options, { domain: requestDomain, serviceKey: "pay" }));
}

function $lua(options = {}) {
    const requestDomain = (options && options.domain) || readEnv("VUE_APP_LUA_API") || domains.__lua;
    return $next(Object.assign({}, options, { domain: requestDomain, serviceKey: "lua" }));
}

function $node(options = {}) {
    const requestDomain = (options && options.domain) || readEnv("VUE_APP_NODE_API") || domains.__node;
    const token = readAuthToken();
    const config = {
        withCredentials: true,
        auth: { username: token || "", password: "node common request" },
        baseURL: localProxyEnabled(options) ? localProxyBase("node") : requestDomain,
    };
    const ins = axios.create(config);
    installInterceptors(ins, options);
    return ins;
}

function $http(options) {
    const domain = typeof options === "string" ? options : options.domain;
    const token = readAuthToken();
    const config = {
        withCredentials: true,
        auth: { username: token || "", password: "common request" },
        baseURL: domain,
        headers: Object.assign({}, (options && options.headers) || {}),
    };
    const ins = axios.create(config);
    installStandardInterceptors(ins, options);
    return ins;
}

function $pull(options) {
    const requestDomain = (options && options.domain) || readEnv("VUE_APP_PULL_API") || domains.__pull;
    return $next(Object.assign({}, options, { domain: requestDomain, serviceKey: "pull" }));
}

export {
    axios,
    SSE,
    $cms,
    $next,
    $helper,
    $node,
    $team,
    $pay,
    $lua,
    $http,
    $pull,
    // 兼容：少数脚本会直接用到拦截器
    installInterceptors,
    installStandardInterceptors,
    installHelperInterceptors,
};
