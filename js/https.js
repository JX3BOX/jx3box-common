import {
    axios,
    installInterceptors,
    installNextInterceptors,
    installHelperInterceptors,
} from "./axios";
import {
    __server,
    __uc,
    __cms,
    __node,
    __spider,
    __next,
    __pay,
    __helperUrl,
    __team
} from "../data/jx3box.json";
import { tokenExpires } from "../data/conf.json";
function isLogin() {
    let created_at = !localStorage.getItem("created_at")
        ? -Infinity
        : localStorage.getItem("created_at");
    let logged_in = localStorage.getItem("logged_in") == "true" ? true : false;
    return logged_in && Date.now() - created_at < tokenExpires;
}

const server_map = {
    server: __server,
    uc: __uc,
    cms: __cms,
    node: __node,
    spider: __spider,
    next: __next,
    pay: __pay,
    team: __team,
    helper: __helperUrl,
};
const interceptor_map = {
    helper: installHelperInterceptors,
    next: installNextInterceptors,
    default: installInterceptors,
};

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

    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
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

// cms通用请求接口
function $cms(options) {
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "cms common request",
        },
        baseURL: __cms,
        headers: {},
    };

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL = process.env.NODE_ENV === "production" ? __cms : "/";
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installNextInterceptors(ins, options);

    return ins;
}

// helper通用请求接口
function $helper(options) {
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "helper common request",
        },
        baseURL: __helperUrl,
        headers: {
            Accept: "application/prs.helper.v2+json",
        },
    };

    // 是否需要开启本地代理作为测试
    if (options && options.proxy) {
        config.baseURL =
            process.env.NODE_ENV === "production" ? __helperUrl : "/";
    }

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installHelperInterceptors(ins, options);

    return ins;
}

// next通用请求接口
function $next(options) {
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "next common request",
        },
        baseURL: process.env.NODE_ENV === "production" ? __next : "/",
        headers: {},
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installNextInterceptors(ins, options);

    return ins;
}

// team通用请求接口
function $team(options) {
    let config = {
        // 同时发送cookie和basic auth
        withCredentials: true,
        auth: {
            username: (localStorage && localStorage.getItem("token")) || "",
            password: "team common request",
        },
        baseURL: process.env.NODE_ENV === "production" ? __team : "/",
        headers: {},
    };

    // 创建实例
    const ins = axios.create(config);

    // 指定拦截器
    installNextInterceptors(ins, options);

    return ins;
}

export { $https, $_https, $cms, $helper, $next ,$team};
