import axios from "axios";
import { __server } from "@jx3box/jx3box-common/js/jx3box.json";
import { installInterceptors } from "@jx3box/jx3box-common/js/axios";
const $ = axios.create({
    withCredentials: true,
    baseURL: __server,
});
installInterceptors($);

function getConfig(key) {
    return $.get("index/config")
        .then((res) => {
            let _config = {};
            res.data.data.forEach((item) => {
                _config[item.key] = item.val;
            });
            if (key) {
                return _config[key];
            } else {
                return _config;
            }
        })
}

function getArticle(id) {
    return $.get('post/find',{
        params : {
            id : id
        }
    }).then((res) => {
        return res.data.data.post.post_content
    })
}

export { $, getConfig, getArticle };
