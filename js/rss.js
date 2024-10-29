import { $next } from "./https";

/**
 * 获取我的订阅列表
 * @returns {Object} 返回包含订阅概览信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {Array} returns.data.list 订阅列表
 * @returns {Object} returns.data.page 分页信息
 * @returns {string} returns.msg 响应消息
 */
export const getRss = () => {
    return $next().get("/api/next2/rss/list");
}

/**
 * 获取作者的订阅概览
 * @param {string} id 作者id
 * @returns {Object} 返回包含订阅概览信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {boolean} returns.data.subscribed 是否订阅
 * @returns {number} returns.data.total 订阅总数
 * @returns {string} returns.msg 响应消息
 */
export const getAuthorRss = ({id}) => {
    return $next({mute: true}).get(`/api/next2/rss/overview/author/${id}`);
}

/**
 * 获取论坛帖子的订阅概览
 * @param {string} id 帖子id
 * @returns {Object} 返回包含订阅概览信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {boolean} returns.data.subscribed 是否订阅
 * @returns {number} returns.data.total 订阅总数
 * @returns {string} returns.msg 响应消息
 */
export const getCommunityRss = ({id}) => {
    return $next({mute: true}).get(`/api/next2/rss/overview/community/${id}`);
}

/**
 * 获取文章订阅概览
 * @param {string} type 文章类型
 * @param {string} id 文章id
 * @returns {Object} 返回包含订阅概览信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {boolean} returns.data.subscribed 是否订阅
 * @returns {number} returns.data.total 订阅总数
 * @returns {string} returns.msg 响应消息
 */
export const getPostRss = ({type, id}) => {
    return $next({mute: true}).get(`/api/next2/rss/overview/posts/${type}/${id}`);
}

/**
 * 获取百科订阅概览
 * @param {string} type 百科类型
 * @param {string} id 百科id
 * @returns {Object} 返回包含订阅概览信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {boolean} returns.data.subscribed 是否订阅
 * @returns {number} returns.data.total 订阅总数
 * @returns {string} returns.msg 响应消息
 */
export const getWikiRss = ({type, id}) => {
    return $next({mute: true}).get(`/api/next2/rss/overview/wiki/${type}/${id}`);
}

/**
 * 获取作者的订阅排行
 * @param {Object} params 请求参数
 * @param {number} params.limit 获取数量
 * @returns {Object} 返回包含订阅排行信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {Array} returns.data.list 排行列表
 * @returns {string} returns.msg 响应消息
 */
export const getAuthorRank = ({params}) => {
    return $next().get("/api/next2/rss/rank/author", {
        params
    });
}

/**
 * 获取论坛帖子的订阅排行
 * @param {Object} params 请求参数
 * @param {number} params.limit 获取数量
 * @returns {Object} 返回包含订阅排行信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {Array} returns.data.list 排行列表
 * @returns {string} returns.msg 响应消息
 */
export const getCommunityRank = ({params}) => {
    return $next().get("/api/next2/rss/rank/community", {
        params
    });
}

/**
 * 获取文章订阅排行
 * @param {string} type 文章类型
 * @param {Object} params 请求参数
 * @param {number} params.limit 获取数量
 * @returns {Object} 返回包含订阅排行信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {Array} returns.data.list 排行列表
 * @returns {string} returns.msg 响应消息
 */
export const getPostRank = ({type, params}) => {
    return $next().get(`/api/next2/rss/rank/posts/${type}`, {
        params
    });
}

/**
 * 获取百科订阅排行
 * @param {string} type 百科类型
 * @param {Object} params 请求参数
 * @param {number} params.limit 获取数量
 * @returns {Object} 返回包含订阅排行信息的对象
 * @returns {number} returns.code 响应代码
 * @returns {Object} returns.data 数据对象
 * @returns {Array} returns.data.list 排行列表
 * @returns {string} returns.msg 响应消息
 */
export const getWikiRank = ({type, params}) => {
    return $next().get(`/api/next2/rss/rank/wiki/${type}`, {
        params
    });
}

/**
 * 订阅作者
 * @param {string} id 作者id
 * @returns {Object} 返回包含订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const subscribeAuthor = ({id}) => {
    return $next().post(`/api/next2/rss/subscribe/author/${id}`);
}

/**
 * 取消订阅作者
 * @param {string} id 作者id
 * @returns {Object} 返回包含取消订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const unsubscribeAuthor = ({id}) => {
    return $next().delete(`/api/next2/rss/subscribe/author/${id}`);
}

/**
 * 订阅论坛帖子
 * @param {string} id 帖子id
 * @returns {Object} 返回包含订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const subscribeCommunity = ({id}) => {
    return $next().post(`/api/next2/rss/subscribe/community/${id}`);
}

/**
 * 取消订阅论坛帖子
 * @param {string} id 帖子id
 * @returns {Object} 返回包含取消订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const unsubscribeCommunity = ({id}) => {
    return $next().delete(`/api/next2/rss/subscribe/community/${id}`);
}

/**
 * 订阅文章
 * @param {string} type 文章类型
 * @param {string} id 文章id
 * @returns {Object} 返回包含订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const subscribePost = ({type, id}) => {
    return $next().post(`/api/next2/rss/subscribe/posts/${type}/${id}`);
}

/**
 * 取消订阅文章
 * @param {string} type 文章类型
 * @param {string} id 文章id
 * @returns {Object} 返回包含取消订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const unsubscribePost = ({type, id}) => {
    return $next().delete(`/api/next2/rss/subscribe/posts/${type}/${id}`);
}

/**
 * 订阅百科
 * @param {string} type 百科类型
 * @param {string} id 百科id
 * @returns {Object} 返回包含订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const subscribeWiki = ({type, id}) => {
    return $next().post(`/api/next2/rss/subscribe/wiki/${type}/${id}`);
}

/**
 * 取消订阅百科
 * @param {string} type 百科类型
 * @param {string} id 百科id
 * @returns {Object} 返回包含取消订阅结果的对象
 * @returns {number} returns.code 响应代码
 * @returns {string} returns.msg 响应消息
 */
export const unsubscribeWiki = ({type, id}) => {
    return $next().delete(`/api/next2/rss/subscribe/wiki/${type}/${id}`);
}
