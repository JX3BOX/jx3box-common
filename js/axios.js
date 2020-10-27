import axios from "axios";
import { __next, __pay, __server } from "./jx3box.json";
import Vue from "vue";
import { Message, Notification } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
const broadcast = new Vue();

const $ = axios.create({
    withCredentials: true,
});
function installInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
            if (err.response && err.response.data) {
                broadcast.$message.error(`${err.response.data.msg}`);
            } else {
                broadcast.$message.error("网络请求异常");
            }
            console.log(err);
            return Promise.reject(err);
        }
    );
}
installInterceptors(axios);
installInterceptors($);

function installNextInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                broadcast.$message.error(
                    `[${response.data.code}]${response.data.msg}`
                );
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if (err.response && err.response.data) {
                broadcast.$message.error(`${err.response.data.msg}`);
            } else {
                broadcast.$message.error("网络请求异常");
            }
            console.log(err);
            return Promise.reject(err);
        }
    );
}

const $next = axios.create({
    withCredentials: true,
    baseURL: process.env.NODE_ENV === 'production' ?  __next : '/',
});
installNextInterceptors($next);
const $pay = axios.create({
    withCredentials: true,
    baseURL: __pay,
});
installNextInterceptors($pay);
const $server = axios.create({
    withCredentials: true,
    baseURL: __server,
});
installNextInterceptors($server);

export { $, axios, $next, $pay, $server }
