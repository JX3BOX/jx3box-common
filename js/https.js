import {
    axios,
    installInterceptors,
    installNextInterceptors,
    installHelperInterceptors,
    installCmsInterceptors,
} from "./axios";
import { SSE } from "./sse";
import {
    __server,
    __cms,
    __node,
    __spider,
    __next,
    __pay,
    __helperUrl,
    __team,
    __lua,
} from "../data/jx3box.json";
import { getTokenFromUrl } from "./utils";

const server_map = {
    server: __server,
    cms: __cms,
    node: __node,
    spider: __spider,
    pay: __pay,
    team: __team,
    helper: __helperUrl,
};

// cms通用请求接口
function $cms(options = {}, axiosConfig = {}) {
    // 解构options并设置默认值
    const { interceptor = true, domain, progress } = options;

    let requestDomain = "";
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_CMS_API || __cms;
    }

    let token = getTokenFromUrl();
    token = token
        ? token
        : (localStorage && localStorage.getItem("__token")) ||
          localStorage.getItem("token");
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
    let domain = (options && options.domain) || __helperUrl;
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username:
                (localStorage && localStorage.getItem("__token")) ||
                localStorage.getItem("token") ||
                "",
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

    let requestDomain = "";
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_NEXT_API || __next;
    }

    let token = getTokenFromUrl();
    token = token
        ? token
        : (localStorage && localStorage.getItem("__token")) ||
          localStorage.getItem("token");
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

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL = process.env.NODE_ENV === "production" ? domain : "/";
    }

    // 创建实例
    const ins = axios.create(Object.assign(axiosConfig, config));

    // 指定拦截器
    interceptor && installNextInterceptors(ins, options);

    return ins;
}

function $team(options = {}) {
    let { domain } = options;

    let requestDomain = "";
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_TEAM_API || __team;
    }
    let _options = (options &&
        Object.assign(options, { domain: requestDomain })) || {
        domain: requestDomain,
    };
    return $next(_options);
}

function $pay(options = {}) {
    let { domain } = options;

    let requestDomain = "";
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_PAY_API || __pay;
    }

    let _options = (options &&
        Object.assign(options, { domain: requestDomain })) || {
        domain: requestDomain,
    };
    return $next(_options);
}

function $lua(options = {}) {
    let { domain } = options;

    let requestDomain = "";
    if (domain) {
        requestDomain = domain;
    } else {
        requestDomain = process.env.VUE_APP_LUA_API || __lua;
    }
    let _options = (options &&
        Object.assign(options, { domain: requestDomain })) || {
        domain: requestDomain,
    };
    return $next(_options);
}

// node
function $node(options) {
    const domain = (options && options.domain);

    const requestDomain = domain || process.env.VUE_APP_NODE_API || __node;

    let token = getTokenFromUrl();
    token = token
        ? token
        : (localStorage && localStorage.getItem("__token")) ||
          localStorage.getItem("token");
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: token || "",
            password: "node common request",
        },
        baseURL: requestDomain,
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installInterceptors(ins, options);

    return ins;
}

import { tokenExpires } from "../data/conf.json";
function isLogin() {
    let created_at = !localStorage.getItem("created_at")
        ? -Infinity
        : localStorage.getItem("created_at");
    let logged_in = localStorage.getItem("logged_in") == "true" ? true : false;
    return logged_in && Date.now() - created_at < tokenExpires;
}

// 不带鉴权的请求
function $https(server, options) {
    let config = {
        headers: {},
    };

    // Helper指定请求头
    if (server == "helper") {
        config.headers.Accept = "application/prs.helper.v2+json";
    }

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL =
            process.env.NODE_ENV === "production" ? server_map[server] : "/";
    } else {
        config.baseURL = server_map[server];
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    if (options && options.interceptor) {
        interceptor_map[options.interceptor](ins, options);
    } else {
        installInterceptors(ins, options);
    }

    return ins;
}

// 带鉴权的请求
function $_https(server, options) {
    // 如果前端已经退出不发起请求
    if (!isLogin()) {
        return Promise.reject("请先登录");
    }

    let token = getTokenFromUrl();
    token = token
        ? token
        : (localStorage && localStorage.getItem("__token")) ||
          localStorage.getItem("token");

    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: token || "",
            password: "$_https common request",
        },
        baseURL:
            process.env.NODE_ENV === "production" ? server_map[server] : "/",
        headers: {},
    };

    // Helper指定请求头
    if (server == "helper") {
        config.headers.Accept = "application/prs.helper.v2+json";
    }

    // 是否需要开启本地代理作为测试
    if (!options || options.proxy || options.proxy === undefined) {
        config.baseURL =
            process.env.NODE_ENV === "production" ? server_map[server] : "/";
    } else {
        config.baseURL = server_map[server];
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    if (options && options.interceptor) {
        interceptor_map[options.interceptor](ins, options);
    } else {
        installInterceptors(ins, options);
    }

    return ins;
}

export {
    $https,
    $_https,
    $cms,
    $helper,
    $next,
    $team,
    $pay,
    $node,
    $lua,
    axios,
    SSE,
};
