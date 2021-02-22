import { $pay } from "./axios";

function getAsset() {
    return $pay.get("api/vip/i").then((res) => {
        return res.data.data;
    });
}

function isVIP() {
    return $pay.get("api/vip/i").then((res) => {
        if (!res.data.code) {
            let isVIP = res.data.data.was_vip;
            if (isVIP) {
                let isExpired =
                    new Date(res.data.data.expire_date) - new Date() > 0;
                return isExpired
            } else {
                return false;
            }
        } else {
            reject(res.data.msg);
        }
    });
}

export { getAsset, isVIP };
