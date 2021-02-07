import { $pay } from "./axios";

function getAsset() {
    return $pay.get("api/vip/i").then((res) => {
        return res.data.data;
    });
}

function isVIP() {
    return $pay.get("api/vip/i").then((res) => {
        let expire_date = new Date(res.data.data.expire_date);
        let today_data = new Date()
        let isExpired = (today_data - expire_date) > 0
        return !isExpired
    });
}

export { getAsset, isVIP };
