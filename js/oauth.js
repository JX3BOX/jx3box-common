const { __server } = require("./jx3box");
const OAuth = {
    github: {
        client_id: "5fbf7a66cd7d3d0f5153",
        authorize_uri: "https://github.com/login/oauth/authorize",
        callback : `${__server}oauth/github/callback`
    },
    qq : {
        client_id : "101870778",
        authorize_uri : "https://graph.qq.com/oauth2.0/authorize",
        callback : `${__server}oauth/qq/callback`
    },
    weibo : {
        client_id : "601200765",
        authorize_uri : "https://api.weibo.com/oauth2/authorize",
        // callback : `${__server}oauth/weibo/callback`
        callback : `https://www.jx3box.com/wp-json/qqworld-passport/v1/module/weibo/`
    }
}

module.exports = OAuth