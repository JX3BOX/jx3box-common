import axios from "axios";
import { __next } from "./jx3box.json";

// 30秒缓存
function getStat(type, id) {
    return axios
        .get(__next + "api/summary-any/" + type + "-" + id + "/stat")
        .catch((err) => {
            console.log(err);
        });
}

// 同一个ip的同一篇文章的同一个动作10分钟内不重复统计
function postStat(type, id) {
    return axios.get(__next + "api/summary-any/" + type + "-" + id, {
        params: {
            type: type,
            actions: "views",
        },
    });
}
function getStatRank(type, action = "views", limit = 10, sort = "yesterday") {
    return axios.get(__next + "api/summary/visit/rank", {
        params: {
            postType: type,
            postAction: action,
            pageSize: limit,
            sort: sort, //默认"yesterday", 可选值：today,7days,30days
        },
    });
}

export { getStat, postStat, getStatRank };
