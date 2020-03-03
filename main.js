const JX3BOX = {
    // 根目录
    __Root: "https://www.jx3box.com/",
    // OSS
    __ossRoot: "https://oss.jx3box.com/",
    // OSS MIRROR
    __ossMirror: "https://console.cnyixun.com/",
    // 图标目录
    __iconPath: this.__ossRoot + "icon/",

    // SSO服务
    __sso: "https://sso.jx3box.com/",
    // APP服务
    __node: "https://node.jx3box.com/",
    // 边缘支撑服务（爬虫、官方接口）
    __spider: "https://spider.jx3box.com/",
    // 代理服务
    __sg: "https://sg.jx3box.com/",
    // 成就服务
    __helperUrl: "https://helper.jx3box.com/",
    // 搜索服务
    __searchRoot: "https://search.jx3box.com/",

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
    }
};

module.exports = { JX3BOX };
