// 默认请求
import axios from "axios";
// 域名映射
import domains from "../data/jx3box.json";
// 错误组件
import { ElMessage, ElMessageBox, ElNotification } from "element-plus";

import { SSE } from "./sse";

// cms通用请求接口
function $cms(options) {
    let domain = (options && options.domain) || domains.__cms;
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "cms common request",
        },
        baseURL: process.env.NODE_ENV === "production" ? domain : "/",
        headers: {},
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installStandardInterceptors(ins, options);

    return ins;
}

// helper通用请求接口
import utilModule from "./utils";
const { jx3ClientType } = utilModule;
function $helper(options) {
    let domain = (options && options.domain) || domains.__helperUrl;

    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "helper common request",
        },
        baseURL: domain,
        headers: {
            Accept: "application/prs.helper.v2+json",
            "JX3-Client-Type":
                (options && options.client_id) || jx3ClientType(),
        },
    };

    // 附加headers
    if (options && options.headers) {
        config.headers = Object.assign(config.headers, options.headers);
    }

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL = process.env.NODE_ENV === "production" ? domain : "/";
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installHelperInterceptors(ins, options);

    return ins;
}

// next 通用请求接口
function $next(options) {
    let domain = (options && options.domain) || domains.__next;

    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "next common request",
        },
        baseURL: process.env.NODE_ENV === "production" ? domain : "/",
        headers: {},
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installStandardInterceptors(ins, options);

    return ins;
}

function $team(options) {
    let _options = (options &&
        Object.assign(options, { domain: domains.__team })) || {
        domain: domains.__team,
    };
    return $next(_options);
}

function $pay(options) {
    let _options = (options &&
        Object.assign(options, { domain: domains.__pay })) || {
        domain: domains.__pay,
    };
    return $next(_options);
}

function $lua(options) {
    let _options = (options &&
        Object.assign(options, { domain: domains.__lua })) || {
        domain: domains.__lua,
    };
    return $next(_options);
}

// node 通用请求接口
function $node(options) {
    let domain = (options && options.domain) || domains.__node;
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "node common request",
        },
        baseURL: domain,
    };

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL =
            process.env.NODE_ENV === "production"
                ? domain
                : `http://localhost:${options.port}`;
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installInterceptors(ins, options);

    return ins;
}

// 默认请求
function $http(options) {
    let domain = typeof options == "string" ? options : options.domain;
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "common request",
        },
        baseURL: domain,
        headers: Object.assign({}, options.headers || {}),
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installStandardInterceptors(ins, options);

    return ins;
}

function loadPop(msg, popType = "message") {
    switch (popType) {
        case "message":
            ElMessage({
                message: msg,
                type: "error",
            });
            break;
        case "alert":
            ElMessageBox.alert(msg, "错误");
            break;
        case "notify":
            ElNotification({
                title: "错误",
                message: msg,
                duration: 3000,
            });
            break;
        default:
            break;
    }
}

function throwError(err) {
    console.log(err.response);
    return Promise.reject(err);
}

function loadDefaultRequestErrorPop(err, popType = "message") {
    loadPop(`[${err.response.status}]${err.response.statusText}`, popType);
}

/**
 * 无包装器的拦截器
 *
 * @param {*} target
 * @param {*} options
 */
function installInterceptors(target, options) {
    let popType = (options && options.popType) || "message";
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
            if (!options || !options.mute) {
                if (err.response && err.response.data) {
                    err.response.data.msg &&
                        loadPop(err.response.data.msg, popType);
                } else {
                    loadDefaultRequestErrorPop(err);
                }
            }
            return throwError(err);
        }
    );
}

/**
 * 标准统一包装模式
 * go/nodejs server
 * @param {*} target
 * @param {*} options
 */
function installStandardInterceptors(target, options) {
    let popType = (options && options.popType) || "message";
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                if (!options || !options.mute) {
                    response.data.msg &&
                        loadPop(
                            `[${response.data.code}]${response.data.msg}`,
                            popType
                        );
                }
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if (!options || !options.mute) {
                console.log(err.response);
                if (
                    err.response &&
                    err.response.data &&
                    err.response.data.msg
                ) {
                    loadPop(err.response.data.msg, popType);
                } else {
                    loadDefaultRequestErrorPop(err);
                }
            }
            return throwError(err);
        }
    );
}

/**
 * Helper统一包装模式
 * php server
 * @param {*} target
 * @param {*} options
 */
function installHelperInterceptors(target, options) {
    let popType = (options && options.popType) || "message";
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code == 200 || !response.data.code) {
                return response;
            } else {
                if (!options || !options.mute) {
                    loadPop(
                        `[${response.data.code}]${response.data.message}`,
                        popType
                    );
                }
                return Promise.reject(response);
            }
        },
        function (err) {
            if (!options || !options.mute) {
                loadDefaultRequestErrorPop(err);
            }
            return throwError(err);
        }
    );
}

export { $cms, $next, $helper, $node, $team, $pay, $lua, $http, axios, SSE };
