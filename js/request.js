// 默认请求
import axios from "axios";

// 拦截器
import { installInterceptors, installNextInterceptors, installHelperInterceptors, installCmsInterceptors } from "./interceptors.js";

// 域名映射
import { __cms, __node, __spider, __next, __pay, __team, __lua, __helperUrl, __server, __sso } from "../data/jx3box.json";

// cms通用请求接口
function $cms(options) {
    let domain = (options && options.domain) || __cms;
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
    installCmsInterceptors(ins, options);

    return ins;
}

// helper通用请求接口
import { jx3ClientType } from "./utils";
function $helper(options) {
    let domain = (options && options.domain) || __helperUrl;

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
            "JX3-Client-Type": (options && options.client_id) || jx3ClientType(),
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
    let domain = (options && options.domain) || __next;

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
    installNextInterceptors(ins, options);

    return ins;
}

function $team(options) {
    let _options = options && Object.assign(options, { domain: __team }) || { domain: __team };
    return $next(_options);
}

function $pay(options) {
    let _options = options && Object.assign(options, { domain: __pay }) || { domain: __pay };
    return $next(_options);
}

function $lua(options) {
    let _options = options && Object.assign(options, { domain: __lua }) || { domain: __lua };
    return $next(_options);
}

// node 通用请求接口
function $node(options) {
    let domain = (options && options.domain) || __node;
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
        config.baseURL = process.env.NODE_ENV === "production" ? domain : `http://localhost:${options.port}`;
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
    installNextInterceptors(ins, options);

    return ins;
}

export { $cms, $next, $helper, $node, $team, $pay, $lua, $http, axios };
