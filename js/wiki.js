import { $helper } from "./https";

const wiki = {
    // 获取最新攻略
    get({ type, id }, params) {
        return $helper().get(`/api/wiki/post`, {
            params: {
                ...params,
                type,
                source_id: id,
            }
        })
    },
    // 根据post_id获取攻略
    getById(post_id, params) {
        return $helper().get(`/api/wiki/post/${post_id}`, {
            params
        })
    },
    // 获取最新攻略列表
    list({ type }, params) {
        return $helper().get(`/api/wiki/posts/newest`, {
            params: {
                ...params,
                type,
            }
        })
    },
    // 创建/更新攻略
    post({ type, data }, params) {
        return $helper().post(`/api/wiki/post`, {
            data: {
                ...data,
                type,
            },
            params: params,
        })
    },
    // 获取历史版本
    versions({ type, id }, params) {
        return $helper().get(`/api/wiki/post/versions`, {
            params: {
                ...params,
                type,
                source_id: id,
            }
        })
    },
    // 获取我的百科攻略列表
    myList(params) {
        return $helper().get(`/api/my/wiki/posts`, {
            params
        })
    },
    // 删除我的百科攻略
    delete(post_id) {
        return $helper().put(`/api/my/wiki/post/${post_id}/remove`)
    }
}

const wikiComment = {
    // 百科评论列表
    list({ type, id }, params) {
        return $helper().get(`/api/wiki/comments`, {
            params: {
                ...params,
                type,
                source_id: id,
            }
        })
    },
    post({ data }, params) {
        return $helper().post(`/api/wiki/comment`, {
            data: {
                ...data,
            },
            params: params,
        })
    },
    // 删除我的百科评论
    delete(comment_id) {
        return $helper().put(`/api/my/wiki/comment/${comment_id}/remove`)
    },
    // 获取我的百科评论列表
    myList(params) {
        return $helper().get(`/api/my/wiki/comments`, {
            params
        })
    }
}

// 面包屑
function getBread(channel) {
    return $helper().get(`/api/breadcrumb/${channel}`);
}

export { wiki, getBread }