const { default_avatar, __sourceType, __postType, __wikiType, __appType, __gameType, __imgPath, __iconPath, __clients, __ossMirror } = require("../data/jx3box.json");
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
            avatar = avatar.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
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

    iconLink(icon_id, client = "std") {
        if (!icon_id || isNaN(parseInt(icon_id))) {
            return `${__imgPath}image/common/nullicon.png`;
        } else {
            let iconpath = client == "origin" ? "origin_icon" : "icon";
            return `${__iconPath}${iconpath}/${icon_id}.png`;
        }
    },

    getAppIcon(key) {
        return __imgPath + "image/box/" + key + ".svg";
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
        id = id || "";

        // 核心作品、休闲应数据
        if (__sourceType.cms_types.includes(type) || __sourceType.pvx_types.includes(type)) {
            return "/" + type + "/" + id;

        // 百科类型
        } else if (__sourceType.wiki_types.includes(type)) {
            if (type === "item_plan") return "/item/#/plan_view/" + id;
            if (type === "achievement") type = "cj";
            if (type === "wiki") type = "knowledge";
            return "/" + type + "/#/view/" + id;

        // 应用类型
        } else if (__sourceType.app_types.includes(type)) {
            return "/" + `${type}/view/${id}`;

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
            let url = "/" + "rank/race/#/" + event_id;
            if (achieve_id) url += "/rank?aid=" + achieve_id;
            return url;

        // 其它杂项
        } else if (__sourceType.bbs_types.includes(type)) {
            return "/" + `bbs/#/${type}/${id}`;
        } else if (__sourceType.exam_types.includes(type)) {
            return "/" + "exam" + "/" + type + "/" + id;
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
        let types = Object.assign({}, __postType, __wikiType, __appType, __gameType);
        return types[type] || "未知";
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

    // 剑三
    jx3ClientType() {
        return location.hostname.includes("origin") ? 2 : 1;
    },

    // 游戏内TEXT文本格式化
    extractTextContent(str) {
        // 匹配分段
        const regex = /<Text>text=(.*?)font=(\d+).*?<\/text>/gimsy;
        let matches = [];
        let match;
        while ((match = regex.exec(str))) {
            matches.push(match);
        }

        // 格式化分段
        let result = [];
        for (let group of matches) {
            result.push({
                font: ~~group[2],
                text: group[1].slice(1, -2).replace(/[\\n]/g, ""),
            });
        }
        return result;
    },

    // 游戏内图标
    // school_id : 数字、中文名称
    showSchoolIcon(school_id) {
        return __imgPath + "image/school/" + school_id + ".png";
    },
    showForceIcon(force_id) {
        //另一套门派ID
        return __imgPath + "image/force/" + force_id + ".png";
    },
    showMountIcon(mount_id) {
        return __imgPath + "image/xf/" + mount_id + ".png";
    },
    showClientLabel(client) {
        return __clients[client];
    },
    // 获取勋章对应链接
    getMedalLink(event_id, subtype) {
        return `/rank/race/#/${event_id}/${subtype}`
    }
};
