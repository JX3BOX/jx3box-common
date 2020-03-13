const JX3BOX = {
    // 根目录
    __Root: "https://www.jx3box.com/",


    /*资源类*/
    // OSS
    __ossRoot: "https://oss.jx3box.com/",
    __ossMirror: "https://console.cnyixun.com/",
    
    __iconPath : "https://console.cnyixun.com/icon/",
    __emtionPath : 'https://console.cnyixun.com/emotion/',

    __imgPath : "https://console.cnyixun.com/img/", //旧
    __imagePath : "https://console.cnyixun.com/image/",
    __dataPath : "https://cdn.jx3box.com/data/",

    __cssPath : "https://static.jx3box.com/css/",
    __jsPath : "https://static.jx3box.com/js/",
    __Mirror: "https://mirror.jx3box.com/", //旧


    /*服务类*/
    // 后端服务（主库）
    __api: "https://api.jx3box.com/",
    // 核心应用服务（资源查询、处理）
    __node: "https://node.jx3box.com/",
    // 边缘支撑服务（爬虫、官方接口）
    __spider: "https://spider.jx3box.com/",
    // Lavarel服务（成就、消息）
    __helperUrl: "https://helper.jx3box.com/",
    // 代理服务
    __proxy: "https://proxy.jx3box.com/",


    /*栏目类*/
    // 搜索服务
    __searchRoot: "https://search.jx3box.com/",
    // 新版
    __v2: "https://v2.jx3box.com/",
    //百科
    __wiki : "https://xn--3-4g8a959k.com",


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

    // WP API
    __restRoot : 'https://www.jx3box.com/wp-json/',
    __apiRoot : 'https://www.jx3box.com/wp-json/api/',  //自定义
    __restPost : 'https://www.jx3box.com/wp-json/wp/v2/',  //文章接口，例如 macro/1  posts/2


};

module.exports = { JX3BOX };
