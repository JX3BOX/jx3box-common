const { default_avatar, __sourceType, __postType, __otherType, __imgPath, __iconPath, __jx3 } = require("../data/jx3box");
const tvmap = require("../data/tvmap.json");

module.exports = {
    // 图片处理函数
    resolveImagePath: function (str) {
        if (str && str.length) {
            str = str.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            str = str.replace(/http:/g, "https:");
            return str;
        } else {
            return "";
        }
    },

    checkImageLoad: function (jq) {
        jq.length &&
            jq.one("error", function () {
                var img_url = $(this).attr("src");
                var fix_url = img_url.replace(/console\.cnyixun\.com/g, "oss.jx3box.com");
                $(this).attr("src", fix_url);
            });
    },

    // 头像
    // 为空时会返回默认头像
    // 可指定字符串预设样式s,m,l或指定一个数字,总是返回方形
    showAvatar: function (url, size = "s", replace = true) {
        // url
        let avatar = "";
        if (url) {
            // QQ头像协议问题
            avatar = avatar.replace(/http:/g, "https:");
            if (replace) {
                avatar = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            }
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

        return avatar;
    },

    // 海报
    // 为空时不会处理
    // 默认使用mini_banner（cms通用168*88海报），可在oss定制其它预设样式
    showBanner: function (url, style = "mini_banner", replace = true) {
        if (!url) return "";

        url = url.replace(/http:/g, "https:");

        if (replace) {
            url = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
        }

        url += `?x-oss-process=style/${style}`;

        return url;
    },

    // 缩略图
    // 为空时不会处理
    // 默认使用88*88方形，可返回方形(传递单数字)或者指定任意居中剪裁尺寸(传递数组)或指定任意预设样式(传递字符串)
    getThumbnail: function (url, size = 88, replace = true) {
        if (!url) return "";

        url = url.replace(/http:/g, "https:");

        if (replace) {
            url = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
        }

        if (Array.isArray(size)) {
            url += `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size[0]},h_${size[1]}/quality,Q_100`;
        } else if (isNaN(size)) {
            url += `?x-oss-process=style/${size}`;
        } else {
            url += `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size},h_${size}/quality,Q_100`;
        }

        return url;
    },

    // 快捷过滤器（根据应用类型+ID获取对应帖子着陆页或链接）

    iconLink(icon_id) {
        if (!icon_id || isNaN(parseInt(icon_id))) {
            return `${__imgPath}image/common/nullicon.png`;
        } else {
            return `${__iconPath}icon/${icon_id}.png`;
        }
    },

    editLink: function (type, id) {
        return "/publish/#/" + type + "/" + id;
    },

    publishLink: function (type) {
        return "/publish/#/" + type;
    },

    postLink: function (type, pid) {
        return "/" + type + "/" + pid;
    },

    getLink: function (type, id, level) {
        if (__sourceType.cms_types.includes(type)) {
            return "/" + type + "/" + id;
        } else if (__sourceType.wiki_types.includes(type)) {
            if (type === "item_plan") return "/item/#/plan_view/" + id;
            if (type === "achievement") type = "cj";
            if (type === "wiki") type = "knowledge";
            return "/" + type + "/#/view/" + id;
        } else if (__sourceType.exam_types.includes(type)) {
            return "/" + "exam" + "/#/" + type + "/" + id;
        } else if (__sourceType.db_types.includes(type)) {
            let link = "/" + `app/database/?type=${type}&query=${id}`;
            if (level) link += `&level=${level}`;
            return link;
        } else if (__sourceType.team_types.includes(type)) {
            return "/" + "team/" + type + "/" + id;
        } else if (type == "rank") {
            let event_id = id;
            let achieve_id = level;
            let url = "/" + "rank/race/#/" + event_id;
            if (achieve_id) url += "?aid=" + achieve_id;
            return url;
        } else if (__sourceType.pvx_types.includes(type)) {
            return "/" + `bbs/#/${type}/${id}`;
        } else {
            return "";
        }
    },

    authorLink: function (uid) {
        return "/" + "author" + "/" + uid;
    },

    tvLink: function (tv_type, tv_id) {
        return tvmap[tv_type] + tv_id;
    },

    // 应用标识与ID（保留旧版）
    getRewrite: function (key) {
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
    },

    getPID: function () {
        let params = new URLSearchParams(location.search);
        let pid = params.get("pid");
        if (pid && !isNaN(pid)) {
            return pid;
        } else {
            return 0;
        }
    },

    getAppID: function () {
        let arr = location.pathname.slice(1).split("/");
        if (arr.length && !isNaN(arr[1])) {
            return arr[1];
        } else {
            return 0;
        }
    },

    getAppType: function () {
        return location.pathname.slice(1).split("/")[0];
    },

    getQuery: function (key) {
        let params = new URLSearchParams(location.search);
        return params.get(key);
    },

    // 其它工具函数
    getTypeLabel: function (type) {
        if (__postType[type]) return __postType[type];
        if (__otherType[type]) return __otherType[type];
        return type;
    },

    buildTarget: function (edge = 1025) {
        return window.innerWidth < edge ? "_self" : "_blank";
    },

    // 将php时间戳转为字符串格式
    ts2str(timestamp, opt = { polished: true, separator: "-" }) {
        let dt = new Date(parseInt(timestamp) * 1000);
        let year = dt.getFullYear();
        let month = dt.getMonth() + 1;
        let date = dt.getDate();
        let str = opt.polished ? `${year}${opt.separator}${polish(month)}${opt.separator}${polish(date)}` : `${year}${opt.separator}${month}${opt.separator}${date}`;
        return str;

        function polish(val) {
            return val < 10 ? "0" + val : val;
        }
    },
};
