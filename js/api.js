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

function readEnv(key) {
    // 需要在 vite.config.js 配置 envPrefix 包含 VUE_APP_
    return (import.meta && import.meta.env && import.meta.env[key]) || "";
}

function localProxyEnabled(options) {
    if (!import.meta?.env?.DEV) return false;
    if (options && options.proxy === false) return false;
    if (options && options.proxy === true) return true;
    const raw = (readEnv("VUE_APP_PROXY_ENABLE") || "").toString().toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
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
        }
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
        }
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
        }
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
    // 兼容：少数脚本会直接用到拦截器
    installInterceptors,
    installStandardInterceptors,
    installHelperInterceptors,
};
