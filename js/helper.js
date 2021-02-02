import axios from "axios";
import {installInterceptors} from "@jx3box/jx3box-common/js/axios";

const qs = require("qs");
const {__helperUrl} = require("@jx3box/jx3box-common/js/jx3box.json");
const $http = axios.create({
    withCredentials: true,
    baseURL: __helperUrl,
});
installInterceptors($http);

// 百科攻略
let WikiPost = {
    // 获取最新攻略
    newest(type, id) {
        if (!id) return;
        return $http({
            method: "GET",
            url: `/api/wiki/post`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: {type: type, source_id: id},
        })
    },

    // 获取最新攻略列表
    newests(type) {
        return $http({
            method: "GET",
            url: `/api/wiki/posts/newest`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: {type: type},
        });
    },

    // 获取历史版本
    versions(type, id) {
        if (!id) return;
        return $http({
            method: "GET",
            url: `/api/wiki/post/versions`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: {type: type, source_id: id},
        });
    },

    // 获取指定攻略
    view(post_id) {
        if (!post_id) return null;
        return $http({
            method: "GET",
            url: `/api/wiki/post/${post_id}`,
            headers: {Accept: "application/prs.helper.v2+json"},
        });
    },

    // 创建/更新攻略
    save(params) {
        return $http({
            method: "POST",
            url: `/api/wiki/post`,
            headers: {Accept: "application/prs.helper.v2+json"},
            data: qs.stringify({post: params}),
        });
    },

    // 我的百科攻略列表
    myList(params) {
        return $http({
            method: "GET",
            url: `/api/my/wiki/posts`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: params,
        });
    },

    // 删除我的百科攻略
    myRemove(post_id) {
        if (!post_id) return null;
        return $http({
            method: "PUT",
            url: `/api/my/wiki/post/${post_id}/remove`,
            headers: {Accept: "application/prs.helper.v2+json"},
        });
    },
}

// 百科评论
let WikiComment = {
    // 百科评论列表
    list(type, id) {
        if (!id) return;
        return $http({
            method: "GET",
            url: `/api/wiki/comments`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: {type: type, source_id: id},
        })
    },

    // 创建百科评论
    save(params) {
        return $http({
            method: "POST",
            url: `/api/wiki/comment`,
            headers: {Accept: "application/prs.helper.v2+json"},
            data: qs.stringify({comment: params}),
        })
    },

    // 我的百科评论列表
    myList(params) {
        return $http({
            method: "GET",
            url: `/api/my/wiki/comments`,
            headers: {Accept: "application/prs.helper.v2+json"},
            params: params,
        });
    },

    // 删除我的百科评论
    myRemove(comment_id) {
        if (!comment_id) return null;
        return $http({
            method: "PUT",
            url: `/api/my/wiki/comment/${comment_id}/remove`,
            headers: {Accept: "application/prs.helper.v2+json"},
        });
    }
}

export {
    WikiPost,
    WikiComment,
};
