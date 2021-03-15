import axios from "axios";
import { __sourceType } from "../data/jx3box.json";
const { cms_types } = __sourceType;

// 发送统计：同一个ip的同一篇文章的同一个动作10分钟内不重复统计
function postStat(type, id, action = "views") {
    let api = cms_types.includes(type)
        ? "/api/summary-any/" + id
        : "/api/summary-any/" + type + "-" + id;
    return axios.get(api, {
        params: {
            type: type,
            actions: action,
        },
    });
}

// 30秒缓存
function getStat(type, id) {
    let api = cms_types.includes(type)
        ? "/api/summary-any/" + id + "/stat"
        : "/api/summary-any/" + type + "-" + id + "/stat";
    return axios.get(api);
}


// 获取统计
function getStatRank(type, action = "views", limit = 10, sort = "7days") {
    return axios.get("/api/summary/visit/rank", {
        params: {
            postType: type,
            postAction: action,
            pageSize: limit,
            sort: sort, //默认"yesterday", 可选值：today,7days,30days
        },
    });
}

export { getStat, postStat, getStatRank };
