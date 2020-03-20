const JX3BOX = {
    /*🌸域&根*/
    __Root: "https://www.jx3box.com/",
    __Mirror: "https://mirror.jx3box.com/",
    __v2: "https://v2.jx3box.com/",
    __Domain: "www.jx3box.com",

    /*🌸资源类*/
    //oss/jx3box
    __ossRoot: "https://oss.jx3box.com/",
    __ossMirror: "https://console.cnyixun.com/",

    //oss/jx3box/icon
    __iconPath: "https://console.cnyixun.com/icon/",
    //oss/jx3box/emotion
    __emtionPath: "https://console.cnyixun.com/emotion/",

    //oss/jx3box/img
    __imgPath: "https://console.cnyixun.com/img/", //旧
    //oss/jx3box/image
    __imagePath: "https://console.cnyixun.com/image/",

    //oss/jx3box/data
    __dataPath: "https://cdn.jx3box.com/data/",
    __dataMirror : "https://cdn.jsdelivr.net/gh/JX3BOX/jx3box-oss@master/data/",

    /*🌸前端类*/
    
    //oss/jx3box-static/~wp-content|admin|includes
    __wpstatic:"https://cdn.jsdelivr.net/gh/iRuxu/jx3box-mirror/",
    __static:"https://static.jx3box.com/",

    //oss/jx3box-static/css
    __cssPath: "https://static.jx3box.com/css/", //旧
    //oss/jx3box-static/js
    __jsPath: "https://static.jx3box.com/js/", //旧

    //oss/jx3box-www/project 
    __staticPath : {
        jsdelivr : "https://cdn.jsdelivr.net/gh/JX3BOX/",   // repo@gh-pages/ + ~
        mirror: "https://mirror.jx3box.com/",    // oss/jx3box-www/repo/ + ~
    },
    

    /*🌸服务类*/
    // 公开API服务（主库）
    __api: "https://api.jx3box.com/",
    // 核心应用服务（资源查询、处理）
    __node: "https://node.jx3box.com/",
    // 边缘支撑服务（爬虫、统计）
    __spider: "https://spider.jx3box.com/",
    // Lavarel服务（成就、消息）
    __helperUrl: "https://helper.jx3box.com/",
    // 代理服务
    __proxy: "https://proxy.jx3box.com/",


    /*🌸栏目类*/
    // 搜索服务
    __search: "https://search.jx3box.com/",
    //百科
    __wiki: "https://xn--3-4g8a959k.com/",


    /*🌸预设*/
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

    //🌸OSS 图片处理样式
    default_avatar: "https://console.cnyixun.com/image/common/avatar.png",
    avatar_suffix_s: "?x-oss-process=style/avatar_s",
    avatar_suffix_m: "?x-oss-process=style/avatar_m",
    avatar_suffix_l: "?x-oss-process=style/avatar_l",

    //🌸WP API
    __restRoot: "https://www.jx3box.com/wp-json/",
    __apiRoot: "https://www.jx3box.com/wp-json/api/", //自定义
    __restPost: "https://www.jx3box.com/wp-json/wp/v2/" //文章接口，例如 macro/1  posts/2
};



const SEO = require("./js/seo");
const Utils = require("./js/utils");

module.exports = { JX3BOX, SEO, Utils };
