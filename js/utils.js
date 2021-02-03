const {
    default_avatar,
    __Root,
    __sourceType,
    __postType,
    __otherType,
    __imgPath,
    __iconPath,
} = require("./jx3box");
const tvmap = {
    douyu :'https://www.douyu.com/',
    bilibili :  'https://live.bilibili.com/',
    huya : 'https://www.huya.com/'
}

module.exports = {
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
                var fix_url = img_url.replace(
                    /console\.cnyixun\.com/g,
                    "oss.jx3box.com"
                );
                $(this).attr("src", fix_url);
            });
    },

    showAvatar: function (url, size = "s") {
        const styleMap = {
            s: "?x-oss-process=style/avatar_s",
            m: "?x-oss-process=style/avatar_m",
            l: "?x-oss-process=style/avatar_l",
        };

        let avatar = "";
        if (url) {
            avatar = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            avatar = avatar.replace(/http:/g, "https:");
        } else {
            avatar = default_avatar;
        }

        return avatar + styleMap[size];
    },

    showMinibanner: function (url) {
        if (url) {
            url = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            url = url + "?x-oss-process=style/mini_banner";
            return url;
        } else {
            return "";
        }
    },

    getThumbnail : function (url,size = 88,replace = false){

        if(!url) return ''

        if (replace) {
            url = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            url = url.replace(/http:/g, "https:");
        }

        return url + `?x-oss-process=image/auto-orient,1/resize,m_fill,w_${size},h_${size}`;
    },

    editLink: function (type, id) {
        return __Root + "dashboard/publish/#/" + type + "/" + id;
    },

    publishLink: function (type) {
        return __Root + "dashboard/publish/#/" + type;
    },

    authorLink: function (uid) {
        return __Root + "author" + "/" + uid;
    },

    postLink: function (type, pid) {
        return __Root + type + "/" + pid;
    },

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

    getPID : function (){
        let params = new URLSearchParams(location.search);
        let pid = params.get("pid")
        if(pid && !isNaN(pid)){
            return pid
        }else{
            return 0
        }
    },

    getAppID : function (){
        let arr = location.pathname.slice(1).split("/");
        if(arr.length && !isNaN(arr[1])){
            return arr[1]
        }else{
            return 0
        }
    },

    getAppType : function (){
        return location.pathname.slice(1).split("/")[0];
    },

    getQuery : function (key){
        let params = new URLSearchParams(location.search);
        return params.get(key)
    },

    buildTarget: function (edge = 1025) {
        return window.innerWidth < edge ? "_self" : "_blank";
    },

    // 根据帖子类型+ID获取对应帖子着陆页
    getLink: function (type, id, level) {
        if (__sourceType.cms_types.includes(type)) {
            return __Root + type + "/" + id;
        } else if (__sourceType.wiki_types.includes(type)) {
            if (type === 'item_plan') return __Root + "item/#/plan_view/" + id;
            if (type === 'achievement') type = 'cj';
            return __Root + type + "/#/view/" + id;
        } else if (__sourceType.exam_types.includes(type)) {
            return __Root + "exam" + "/#/" + type + "/" + id;
        } else if (__sourceType.db_types.includes(type)) {
            return __Root + 'app/database/?type=' + type + '&query=' + id + '&level=' + level
        } else if (__sourceType.team_types.includes(type)) {
            return __Root + 'team/#/' + type + '/view/' + id
        } else {
            return __Root
        }
    },
    
    // 根据帖子类型获取对应展示名称
    getTypeLabel: function (type) {
        if (__postType[type]) return __postType[type];
        if (__otherType[type]) return __otherType[type];
        return type;
    },

    // 直播平台
    getTVlink : function (tv_type,tv_id){
        return tvmap[tv_type] + tv_id
    },

    // 将时间戳转为字符串格式
    ts2str(timestamp, opt = {polished: true, separator: '-'}) {
        let dt = new Date(parseInt(timestamp) * 1000);
        let year = dt.getFullYear();
        let month = dt.getMonth() + 1;
        let date = dt.getDate();
        let str = opt.polished ?
            `${year}${opt.separator}${polish(month)}${opt.separator}${polish(date)}` :
            `${year}${opt.separator}${month}${opt.separator}${date}`;
        return str;

        function polish(val) {
            return val < 10 ? ('0' + val) : val
        }
    },

    // 剑三图标链接
    iconLink(icon_id) {
        if (isNaN(parseInt(icon_id))) {
            return `${__imgPath}image/common/nullicon.png`;
        } else {
            return `${__iconPath}icon/${icon_id}.png`;
        }
    },
};
