const { __api } = require("./jx3box");

module.exports = {
    github: {
        client_id: "5fbf7a66cd7d3d0f5153",
        authorize_uri: "https://github.com/login/oauth/authorize",
        redirect_uri: `${__api}oauth/github/callback`,
    },
};
