const { default_avatar, __Root } = require("./jx3box");

module.exports = {
    resolveImagePath: function (str) {
        if(str && str.length){
            str = str.replace(/oss\.jx3box\.com/g, "console.cnyixun.com")
            str = str.replace(/http:/g, "https:")
            return str
        }else{
            return ""
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

        let avatar = ''
        if(url){
            avatar = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com")
            avatar = avatar.replace(/http:/g, "https:")
        }else{
            avatar = default_avatar
        }

        return avatar + styleMap[size];
    },

    showMinibanner: function (url) {
        if(url){
            url = url.replace(/oss\.jx3box\.com/g, "console.cnyixun.com");
            url = url + "?x-oss-process=style/mini_banner";
            return url;
        }else{
            return ''
        }
    },

    editLink: function (type, id) {
        return __Root + 'dashboard/publish/#/' + type + "/" + id;
    },

    publishLink: function (type) {
        return __Root + 'dashboard/publish/#/' + type;
    },

    authorLink: function (uid) {
        return __Root + 'author' + "/?uid=" + uid;
    },

    postLink: function (type, pid) {
        return __Root + type + "/?pid=" + pid;
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

    buildTarget: function (edge = 1025) {
        return window.innerWidth < edge ? "_self" : "_blank";
    },
};
