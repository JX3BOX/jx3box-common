import axios from "axios";
import JX3BOX from "../data/jx3box.json";
import { $next as $next2 } from "./https_v2";

const { __postType, __next } = JX3BOX;
const cms_types = Object.keys(__postType);
const $next = axios.create({
    baseURL: process.env.NODE_ENV === "production" ? __next : "/",
});

// 发送统计：同一个ip的同一篇文章的同一个动作10分钟内不重复统计
function postStat(type, id, action = "views") {
    let api = cms_types.includes(type) ? "/api/summary-any/" + id : "/api/summary-any/" + type + "-" + id;
    return $next.get(api, {
        params: {
            type: type,
            actions: action,
        },
    });
}

// 30秒缓存
function getStat(type, id) {
    let api = cms_types.includes(type) ? "/api/summary-any/" + id + "/stat" : "/api/summary-any/" + type + "-" + id + "/stat";
    return $next.get(api);
}

// 获取统计
function getStatRank(type, action = "views", limit = 10, sort = "7days") {
    return $next.get("/api/summary/visit/rank", {
        params: {
            postType: type,
            postAction: action,
            pageSize: limit,
            sort: sort, //默认"yesterday", 可选值：today,7days,30days
        },
    });
}

// 历史记录
/**
 * 添加历史记录
 * @param {*} data 
 * @param {*} data.source_type 例如：macro,community
 * @param {*} data.source_id 例如：文章id，帖子id
 * @param {*} data.link 例如：文章链接，帖子链接
 * @param {*} data.title 例如：文章标题，帖子标题
 * @returns 
 */
function postHistory(data) {
    return $next2({mute: true}).post("/api/next2/userdata/visit-history/item", data);
}

// 阅读记录
/**
 * 添加阅读记录
 * @param {*} data 
 * @param {*} data.id 例如：文章id，帖子id
 * @param {*} data.category 例如：文章，帖子
 * @param {*} data.subcategory 例如：文章类型，帖子类型
 * @param {*} data.visible_type 例如：2亲友可见 3密码可见 4付费可见 5粉丝可见
 * @returns 
 */
function postReadHistory(data) {
    const {id, category, subcategory, visible_type} = data;
    if (visible_type < 2) return Promise.resolve();
    return $next2({mute: true}).post(`/api/next2/userdata/common-read-history/${category}/${subcategory}/${id}`, {visible_type});
}

export { getStat, postStat, getStatRank, postHistory, postReadHistory };
