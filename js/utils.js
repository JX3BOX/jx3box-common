import {
    default_avatar,
    __sourceType,
    __postType,
    __wikiType,
    __appType,
    __gameType,
    __imgPath,
    __iconPath,
    __clients,
    __ossMirror,
} from "../data/jx3box.json";
import tvmap from "../data/tvmap.json";
import * as cheerio from "cheerio";

export function resolveImagePath(str) {
    if (str && str.length) {
        str = str.replace(/oss\.jx3box\.com/g, "cdn.jx3box.com");
        str = str.replace(/http:/g, "https:");
        return str;
    } else {
        return "";
    }
}

export function checkImageLoad(jq) {
    jq.length &&
        jq.one("error", function () {
            var img_url = $(this).attr("src");
            var fix_url = img_url.replace(
                /cdn\.jx3box\.com/g,
                "oss.jx3box.com"
            );
            $(this).attr("src", fix_url);
        });
}

/**
 * 头像
 * 为空时会返回默认头像
 * 可指定字符串预设样式s,m,l或指定一个数字,总是返回方形
 * @param {*} url
 * @param {*} size
 * @param {*} replace
 * @returns
 */
export function showAvatar(url, size = "s", replace = true) {
    // url
    let avatar = "";
    if (url) {
        // QQ头像协议问题
        avatar = url.replace(/http:/g, "https:");
    } else {
        avatar = default_avatar;
    }

    // size
    const styleMap = {
        s: "?x-oss-process=style/avatar_s",
        m: "?x-oss-process=style/avatar_m",
        l: "?x-oss-process=style/avatar_l",
    };

    if (styleMap[size]) {
        // 预设样式
        avatar += styleMap[size];
    } else {
        // 指定尺寸
        let suffix = `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size},h_${size}/quality,Q_100`;
        avatar += suffix;
    }

    // CDN
    if (replace) {
        avatar = avatar.replace(/oss\.jx3box\.com/g, "cdn.jx3box.com");
    }

    return avatar;
}

/**
 * 海报
 * 为空时不会处理
 * 默认使用mini_banner（cms通用168*88海报），可在oss定制其它预设样式
 */
export function showBanner(url, style = "mini_banner", replace = true) {
    if (!url) return "";

    url = url.replace(/http:/g, "https:");

    if (replace) {
        url = url.replace(/oss\.jx3box\.com/g, "cdn.jx3box.com");
    }

    url += `?x-oss-process=style/${style}`;

    return url;
}

/**
 * 缩略图
 * 为空时不会处理
 * 默认使用88*88方形，可返回方形(传递单数字)或者指定任意居中剪裁尺寸(传递数组)或指定任意预设样式(传递字符串)
 * @param {*} url
 * @param {*} size
 * @param {*} replace
 * @returns
 **/
export function getThumbnail(url, size = 88, replace = true) {
    if (!url) return "";

    url = url.replace(/http:/g, "https:");

    if (replace) {
        url = url.replace(/oss\.jx3box\.com/g, "cdn.jx3box.com");
    }

    if (Array.isArray(size)) {
        url += `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size[0]},h_${size[1]}/quality,Q_100`;
    } else if (isNaN(size)) {
        url += `?x-oss-process=style/${size}`;
    } else {
        url += `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size},h_${size}/quality,Q_100`;
    }

    return url;
}

/**
 * 快捷过滤器（根据应用类型+ID获取对应帖子着陆页或链接）
 * @param {*} icon_id
 * @param {*} client
 * @returns
 */
export function iconLink(icon_id, client = "std") {
    if (!icon_id || isNaN(parseInt(icon_id)) || icon_id == -1) {
        return `${__imgPath}image/common/nullicon.png`;
    } else {
        let iconpath = client == "origin" ? "origin_icon" : "icon";
        return `${__iconPath}${iconpath}/${icon_id}.png`;
    }
}

/**
 * 获取应用图标
 */
export function getAppIcon(key, colorful = false) {
    return (
        __imgPath +
        (colorful ? "image/box-colorful/" : "image/box/") +
        key +
        ".svg"
    );
}

/**
 * 编辑url
 */
export function editLink(type, id) {
    return "/publish/#/" + type + "/" + id;
}

/**
 * 发布url
 * @param {*} type
 */
export function publishLink(type) {
    return "/publish/#/" + type;
}

/**
 * 文章url
 * @param {*} type
 * @param {*} pid
 */
export function postLink(type, pid) {
    return "/" + type + "/" + pid;
}

/**
 * 获取链接
 */
export function getLink(type, id, level) {
    id = id || "";

    // 核心作品、休闲数据
    if (
        __sourceType.cms_types.includes(type) ||
        __sourceType.pvx_types.includes(type)
    ) {
        return "/" + type + "/" + id;

        // 百科类型
    } else if (__sourceType.wiki_types.includes(type)) {
        if (type === "item_plan") return "/item/plan_view/" + id;
        if (type === "achievement") type = "cj";
        if (type === "wiki") type = "knowledge";
        return "/" + `${type}/view/${id}`;

        // 应用类型
    } else if (__sourceType.app_types.includes(type)) {
        return "/" + `${type}/view/${id}`;

        // DBM
    } else if (__sourceType.dbm_types.includes(type)) {
        return "/dbm/" + `${type}/${id}`;

        // 数据库
    } else if (__sourceType.db_types.includes(type)) {
        let link = "/" + `app/database/?type=${type}&query=${id}`;
        if (level) link += `&level=${level}`;
        return link;

        // 团队
    } else if (__sourceType.team_types.includes(type)) {
        return "/" + "team/" + type + "/" + id;

        // 百强榜
    } else if (type == "rank") {
        let event_id = id;
        let achieve_id = level;
        let url = "/rank/race/#/" + event_id;
        if (achieve_id) url += `?aid=${achieve_id}`;
        return url;

        // 其它杂项
    } else if (__sourceType.exam_types.includes(type)) {
        return "/" + "exam" + "/" + type + "/" + id;
    } else if (__sourceType.vip_types.includes(type)) {
        return "/" + "vip" + "/" + type + "/" + id;
    } else if (type && id) {
        return "/" + type + "/" + id;
    } else {
        return "/";
    }
}

export function authorLink(uid) {
    return "/" + "author" + "/" + uid;
}

export function tvLink(tv_type, tv_id) {
    return tvmap[tv_type] + tv_id;
}

export function getRewrite(key) {
    let val = "";
    let params = new URLSearchParams(location.search);
    let isRewrite = !params.get(key);
    if (!isRewrite) {
        val = params.get(key);
    } else {
        let arr = location.pathname.slice(1).split("/");
        val = arr[1];
    }
    return val;
}

export function getPID() {
    let params = new URLSearchParams(location.search);
    let pid = params.get("pid");
    if (pid && !isNaN(pid)) {
        return pid;
    } else {
        return 0;
    }
}

export function getAppID() {
    let arr = location.pathname.slice(1).split("/");
    if (arr.length && !isNaN(arr[1])) {
        return arr[1];
    } else {
        return 0;
    }
}

export function getAppType() {
    return location.pathname.slice(1).split("/")[0];
}

export function getQuery(key) {
    let params = new URLSearchParams(location.search);
    return params.get(key);
}

export function getTypeLabel(type) {
    let types = Object.assign(
        {},
        __postType,
        __wikiType,
        __appType,
        __gameType
    );
    return types[type] || "未知";
}

// 其它工具函数
export function buildTarget(edge = 1025) {
    return window.innerWidth < edge ? "_self" : "_blank";
}

/**
 * 将php时间戳转为字符串格式
 * @param {*} timestamp
 * @param {*} opt
 * @returns
 */
export function ts2str(timestamp, opt = { polished: true, separator: "-" }) {
    let dt = new Date(parseInt(timestamp) * 1000);
    let year = dt.getFullYear();
    let month = dt.getMonth() + 1;
    let date = dt.getDate();
    let str = opt.polished
        ? `${year}${opt.separator}${polish(month)}${opt.separator}${polish(
              date
          )}`
        : `${year}${opt.separator}${month}${opt.separator}${date}`;
    return str;

    function polish(val) {
        return val < 10 ? "0" + val : val;
    }
}

// 剑三
export function jx3ClientType() {
    return location.hostname.includes("origin") ? 2 : 1;
}

/**
 * 将游戏内的形如`<Text>text="****" font="**" **=***</text>`的字符串进行解析
 * 返回一个包含font、text等属性的对象，方便进行进一步的渲染或者其他处理。
 * @param {String} str
 */
export function extractTextContent(str) {
    if (!str || typeof str !== "string") return [];
    let result = [];
    const innerHTML = str.replace(
        /<Text>(.*?)<\/text>/gimsy,
        `<span $1></span>`
    );
    let $ = cheerio.load(`<div>${innerHTML}</div>`);
    let spans = $("span");
    if (!spans.length) return [];
    for (let span of spans) result.push(Object.assign({}, span.attribs));
    return result;
}

/**
 * school_id : 数字、中文名称
 * @param {*} school_id
 * @returns
 */
export function showSchoolIcon(school_id) {
    return __imgPath + "image/school/" + school_id + ".png";
}

/**
 * 另一套门派ID
 * @param {*} force_id
 * @returns
 */
export function showForceIcon(force_id) {
    return __imgPath + "image/force/" + force_id + ".png";
}

export function showMountIcon(mount_id) {
    return __imgPath + "image/xf/" + mount_id + ".png";
}

export function showClientLabel(client) {
    return __clients[client];
}

export function getMedalLink(event_id, subtype) {
    if (subtype === "rank" || subtype === "superstar")
        return `/rank/race/#/${event_id}/${subtype}`;
    return `${subtype}/${event_id}`;
}

export function convertUrlToProtocol(url) {
    const pattern = /https?:\/\/([^/.]+)\.jx3box\.com\/(.*)/;
    const match = url.match(pattern);

    if (match) {
        const protocol = match[1];
        const path = match[2];
        const convertedUrl = `${protocol}:/${path}`;

        return convertedUrl;
    }

    return url;
}

export * as default from "module";
