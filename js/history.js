import { $next } from "./https";

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
export function postHistory(data) {
    return $next({mute: true}).post("/api/next2/userdata/visit-history/item", data);
}