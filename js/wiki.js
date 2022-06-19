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
    async handleMix(source_type, source_id, client, params) {
        let post = '';
        let source = '';
        let isEmpty = true;
        let compatible = false;
        let users = [];
        if (client === 'std') {
            const res = await this.get({ type: source_type, id: source_id }, { client, ...params });
            post = res.data.data.post;
            source = res.data.data.source;
            users = res.data.data.users;
            post && (isEmpty = false);
            console.log("获取重制攻略");
            return { post, source, isEmpty, compatible, type: source_type, source_id: source_id, users };
        } else {
            const res_1 = await this.get({ type: source_type, id: source_id }, { client, ...params });
            source = res_1.data.data.source;
            post = res_1.data.data.post;
            users = res_1.data.data.users;
            post && (isEmpty = false);
            console.log("获取缘起攻略");
            const data = !!res_1.data.data.post;
            if (!data) {
                console.log("兼容：获取重制攻略");
                return this.get({ type: source_type, id: source_id }, { client: 'std', ...params }).then(res_2 => {
                    post = res_2.data.data.post;
                    if (!source)
                        source = res_2.data.data.source;
                    post && (isEmpty = false);
                    users = res_2.data.data.users;
                    compatible = true;
                    return { post, source, isEmpty, compatible, type: source_type, source_id: source_id, users };
                });
            }
            return { post, source, isEmpty, compatible, type: source_type, source_id: source_id, users };
        }
    },
    // 兼容怀旧服
    async mix({ type, id, client }, params) {
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
                const res = await getPet(id, { client });
                let pet = res.data;
                let source_id = pet.ItemTabType + "_" + pet.ItemTabIndex;
                return this.handleMix(source_type, source_id, client, params);
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
            ...data
        }, {
            params
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

export { wiki, wikiComment };
