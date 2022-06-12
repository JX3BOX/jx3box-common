import { $helper, $node } from "./https";

function getPet(petid, params) {
    return $node().get(`/pet/${petid}`, {
        params
    });
}

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
    post({ type, data, client }, params) {
        return $helper().post(`/api/wiki/post`, {
            post: {
                ...data,
                type,
            },
            client
        }, {
            params: params
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
    },
    // 获取兼容攻略
    handleMix(source_type, source_id, client, params) {
        let post = '';
        let source = '';
        let isEmpty = true;
        let compatible = false;
        if (client === 'std') {
            return this.get({ type: source_type, id: source_id }, {client, ...params}).then(res => {
                post = res.data.data.post;
                source = res.data.data.source;
                post && (isEmpty = false);
                console.log("获取重制攻略");
                return { post, source, isEmpty, compatible };
            })
        } else {
            return this.get({ type: source_type, id: source_id }, {client, ...params}).then(res => {
                source = res.data.data.source;
                post = res.data.data.post;
                post && (isEmpty = false);
                console.log("获取缘起攻略");
                return !!res.data.data.post;
            }).then(data => {
                if (!data) {
                    console.log("兼容：获取重制攻略");
                    return this.get({ type: source_type, id: source_id }, {client: 'std', ...params}).then(res => {
                        post = res.data.data.post;
                        if (!source) source = res.data.data.source
                        post && (isEmpty = false);
                        compatible = true;
                        return { post, source, isEmpty, compatible };
                    })
                }
                return { post, source, isEmpty, compatible };
            })
        }
    },
    // 兼容怀旧服
    mix({ type, id, client }, params) {
        let source_type = '';
        let source_id = '';
        if (type === 'cj') {
            source_type = 'achievement';
        } else if (type === 'pet') {
            source_type = 'item';
        } else {
            source_type = type || 'achievement';
        }

        if (id) {
            source_id = id;
            if (type === 'pet') {
                getPet(id, { client }).then(res => {
                    let pet = res.data;
                    let source_id = pet.ItemTabType + "_" + pet.ItemTabIndex;
                    return this.handleMix(source_type, source_id, client, params);
                })
            } else {
                return this.handleMix(source_type, source_id, client, params);
            }
        }
    },
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

export { wiki, getBread, wikiComment };
