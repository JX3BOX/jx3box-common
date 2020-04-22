const { __server } = require("./jx3box");
const OAuth = {
    github: {
        client_id: "5fbf7a66cd7d3d0f5153",
        authorize_uri: "https://github.com/login/oauth/authorize",
        callback : `${__server}oauth/github/callback`
    },
    qq : {
        client_id : "101765136",
        authorize_uri : "https://graph.qq.com/oauth2.0/authorize",
        callback : "https://www.jx3box.com/wp-json/qqworld-passport/v1/module/qq"
    }
}

module.exports = OAuth