const JX3BOX = {
    // 根目录
    __Root: "https://www.jx3box.com/",
    __Mirror: "https://mirror.jx3box.com/",


    /*资源类*/
    // OSS
    __ossRoot: "https://oss.jx3box.com/",
    __ossMirror: "https://console.cnyixun.com/",
    // OSS SUB PATH
    __iconPath : "https://console.cnyixun.com/icon/",
    __cssPath : "https://console.cnyixun.com/static/css/",
    __jsPath : "https://console.cnyixun.com/static/js/",


    /*服务类*/
    // 后端服务（主库）
    __server: "https://server.jx3box.com/",
    // 核心应用服务（资源查询、处理）
    __node: "https://node.jx3box.com/",
    // 边缘支撑服务（爬虫、官方接口）
    __spider: "https://spider.jx3box.com/",
    // 代理服务
    __proxy: "https://proxy.jx3box.com/",
    // 成就服务
    __helperUrl: "https://helper.jx3box.com/",


    /*栏目类*/
    // 搜索服务
    __searchRoot: "https://search.jx3box.com/",
    // 新版
    __v2: "https://v2.jx3box.com/",


    /*预设*/
    // 文章类型映射
    __postType: {
        posts: "论坛",
        macro: "剑三宏库",
        jx3dat: "插件数据",
        fb: "副本攻略",
        bps: "职业攻略",
        cj: "成就百科",
        share: "捏脸分享",
        tool: "教程工具",
        help: "帮助文档",
        post: "茶馆交流",
        page: "系统页面"
    },

    // OSS 图片处理样式
    default_avatar: "image/common/avatar.png",
    avatar_suffix_s: "?x-oss-process=style/avatar_s",
    avatar_suffix_m: "?x-oss-process=style/avatar_m",
    avatar_suffix_l: "?x-oss-process=style/avatar_l",


};

module.exports = { JX3BOX };
