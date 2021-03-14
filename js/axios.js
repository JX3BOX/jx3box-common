import Vue from "vue";
import { Message, Notification } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
const POP = new Vue();

import axios from "axios";
function PopNextworkError(err){
    if (err.response && err.response.data) {
        POP.$message.error(`${err.response.data.msg}`);
    } else {
        POP.$message.error("网络请求异常");
    }
    console.log(err);
    return Promise.reject(err);
}
function installInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
            return PopNextworkError(err)
        }
    );
}
function installNextInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                POP.$message.error(
                    `[${response.data.code}]${response.data.msg}`
                );
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            return PopNextworkError(err)
        }
    );
}
function installHelperInterceptors(target) {
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code == 200) {
                return response;
            }else{
                POP.$message.error(
                    `[${response.data.code}]${response.data.message}`
                );
                return Promise.reject(response);
            }
        },
        function (err) {
            return PopNextworkError(err)
        }
    );
}

export {
    axios,
    POP,
    installInterceptors,
    installNextInterceptors,
    installHelperInterceptors,
};
