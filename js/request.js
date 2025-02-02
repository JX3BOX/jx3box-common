// 默认请求
import axios from "axios";

// 拦截器
import {
    installInterceptors,
    installNextInterceptors,
    installHelperInterceptors,
    installCmsInterceptors,
} from "./interceptors.js";
import { __server, __cms, __node, __spider, __next, __pay, __helperUrl, __team, __lua } from "../data/jx3box.json";

// 域名映射
import domains from "../data/jx3box.json";

// cms通用请求接口
function $cms(options = {}, axiosConfig = {}) {
    // 解构options并设置默认值
    const { interceptor = true, domain, progress } = options;

    let requestDomain = ''
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_CMS_API || __cms;
    }

    let token = getUrlParam("__token");
    token = token ? token : (localStorage && localStorage.getItem("__token") || localStorage.getItem("token"));
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: token || "",
            password: "cms common request",
        },
        baseURL: requestDomain,
        headers: {},
    };

    progress && (config.onUploadProgress = progress);

    // 创建实例
    const ins = axios.create(Object.assign(axiosConfig, config));

    // 指定拦截器
    interceptor && installCmsInterceptors(ins, options);

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

// next通用请求接口
function $next(options = {}, axiosConfig = {}) {
    // 解构options并设置默认值
    const { interceptor = true, domain, progress } = options;

    let requestDomain = ''
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_NEXT_API || __next;
    }

    let token = getUrlParam("__token");
    token = token ? token : (localStorage && localStorage.getItem("__token") || localStorage.getItem("token"));
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: token || "",
            password: "next common request",
        },
        baseURL: requestDomain,
        headers: {},
    };

    progress && (config.onUploadProgress = progress);

    // 创建实例
    const ins = axios.create(Object.assign(axiosConfig, config));

    // 指定拦截器
    interceptor && installNextInterceptors(ins, options);

    return ins;
}

function $team(options = {}) {
    let { domain } = options;

    let requestDomain = ''
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_TEAM_API || __team;
    }
    let _options = (options && Object.assign(options, { domain: requestDomain })) || { domain: requestDomain };
    return $next(_options);
}

function $pay(options = {}) {
    let { domain } = options;

    let requestDomain = ''
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_PAY_API || __pay;
    }

    let _options = (options && Object.assign(options, { domain: requestDomain })) || { domain: requestDomain };
    return $next(_options);
}

function $lua(options = {}) {
    let { domain } = options;

    let requestDomain = ''
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_LUA_API || __lua;
    }
    let _options = (options && Object.assign(options, { domain: requestDomain })) || { domain: requestDomain };
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
    installNextInterceptors(ins, options);

    return ins;
}

// 从url中获取参数
function getUrlParam(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    return r ? decodeURIComponent(r[2]) : null;
}

export { $cms, $next, $helper, $node, $team, $pay, $lua, $http, axios };
