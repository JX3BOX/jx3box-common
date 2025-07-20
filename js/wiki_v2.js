import { $cms, $node } from "./https";

const getPet = (petid, params) => {
    return $node().get(`/pet/${petid}`, {
        params
    });
}

const client = location.href.includes("origin") ? "origin" : "std";

export const wiki = {
    // 最新攻略
    latest({ type }, params) {
        return $cms().get(`/api/cms/wiki/post/latest`, {
            params: {
                client,
                ...params,
                type,
            }
        })
    },
    // 我的
    mine(params) {
        return $cms().get(`/api/cms/wiki/post/mine`, {
            params
        })
    },
    // 统计
    counter({ type }, params) {
        return $cms().get(`/api/cms/wiki/post/counter`, {
            params: {
                client,
                ...params,
                type,
            }
        })
    },
    // 成就列表
    achievements(params) {
        return $node().get(`/achievement/list`, {
            params: {
                client,
                ...params,
            }
        })
    },
    // 详情
    get({ type, id }, params) {
        return $cms().get(`/api/cms/wiki/post/type/${type}/source/${id}`, {
            params: {
                client,
                ...params,
            }
        })
    },
    getById(post_id) {
        return $cms().get(`/api/cms/wiki/post/id/${post_id}`)
    },
    post(data) {
        return $cms().post(`/api/cms/wiki/post`, data)
    },
    update(post_id, data) {
        return $cms().put(`/api/cms/wiki/post/${post_id}`, data)
    },
    remove(post_id) {
        return $cms().delete(`/api/cms/wiki/post/${post_id}`)
    },
    // 获取历史版本
    versions({ type, id }, params) {
        return $cms().get(`/api/cms/wiki/post/type/${type}/source/${id}/versions`, {
            params: {
                client,
                ...params,
            }
        })
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
            console.log("获取旗舰攻略");
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
                console.log("兼容：获取旗舰攻略");
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

export const wikiComment = {
    // 百科评论列表
    list({ type, id }, params) {
        return $cms().get(`/api/cms/wiki/comment`, {
            params: {
                ...params,
                type,
                source_id: id,
            }
        })
    },
    post(data) {
        return $cms().post(`/api/cms/wiki/comment`, data)
    },
    delete(comment_id) {
        return $cms().delete(`/api/cms/wiki/comment/${comment_id}`)
    },
    myList(params) {
        return $cms().get(`/api/cms/wiki/comment/mine`, {
            params
        })
    },
    star(comment_id, data) {
        return $cms().put(`/api/cms/manage/wiki/comment/${comment_id}/star`, data)
    },
    top(comment_id, data) {
        return $cms().put(`/api/cms/manage/wiki/comment/${comment_id}/top`, data)
    },
}
