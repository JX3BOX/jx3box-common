import qs from "qs";
import { $helper } from "./https";

// 百科攻略
let WikiPost = {
    // 获取最新攻略
    newest(type, id, supply = 1) {
        if (!id) return;
        return $helper()({
            method: "GET",
            url: `/api/wiki/post`,
            params: { type: type, source_id: id, supply: supply },
        });
    },

    // 获取最新攻略列表
    newests(type) {
        return $helper()({
            method: "GET",
            url: `/api/wiki/posts/newest`,
            params: { type: type },
        });
    },

    // 获取历史版本
    versions(type, id) {
        if (!id) return;
        return $helper()({
            method: "GET",
            url: `/api/wiki/post/versions`,
            params: { type: type, source_id: id },
        });
    },

    // 获取指定攻略
    view(post_id, params = {}) {
        if (!post_id) return null;
        return $helper()({
            method: "GET",
            url: `/api/wiki/post/${post_id}`,
            params: params,
        });
    },

    // 创建/更新攻略
    save(params) {
        return $helper()({
            method: "POST",
            url: `/api/wiki/post`,
            data: qs.stringify({ post: params }),
        });
    },

    // 我的百科攻略列表
    myList(params) {
        return $helper()({
            method: "GET",
            url: `/api/my/wiki/posts`,
            params: params,
        });
    },

    // 删除我的百科攻略
    myRemove(post_id) {
        if (!post_id) return null;
        return $helper()({
            method: "PUT",
            url: `/api/my/wiki/post/${post_id}/remove`,
        });
    },
};

// 百科评论
let WikiComment = {
    // 百科评论列表
    list(type, id) {
        if (!id) return;
        return $helper()({
            method: "GET",
            url: `/api/wiki/comments`,
            params: { type: type, source_id: id },
        });
    },

    // 创建百科评论
    save(params) {
        return $helper()({
            method: "POST",
            url: `/api/wiki/comment`,
            data: qs.stringify({ comment: params }),
        });
    },

    // 我的百科评论列表
    myList(params) {
        return $helper()({
            method: "GET",
            url: `/api/my/wiki/comments`,
            params: params,
        });
    },

    // 删除我的百科评论
    myRemove(comment_id) {
        if (!comment_id) return null;
        return $helper()({
            method: "PUT",
            url: `/api/my/wiki/comment/${comment_id}/remove`,
        });
    },
};

// 面包屑
function getBread(channel) {
    return $helper().get("/api/breadcrumb/" + channel, {});
}

export { WikiPost, WikiComment, getBread };
