import axios from "axios";
import Vue from "vue";
import { Message, Notification,MessageBox } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
Vue.prototype.$alert = MessageBox.alert;
const POP = new Vue();
function loadPop(msg,popType='message'){
    switch (popType){
        case 'message':
            POP.$message.error(msg)
            break;
        case 'alert':
            POP.$alert(msg, '错误', {
                confirmButtonText: '确定',
            });
            break;
        case 'notify':
            POP.$notify.error({
                title: '错误',
                message: msg
              });
            break;
        default :
            break;
    }
}

function PopNextworkError(err){
    console.log(err.response);
    return Promise.reject(err);
}

function installInterceptors(target,options) {
    let popType = options && options.popType || 'message'
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
            if(!options || !options.mute){
                if (err.response && err.response.data) {
                    err.response.data.msg && loadPop(err.response.data.msg,popType);
                } else {
                    loadPop('网络请求异常',popType);
                }
            }
            return PopNextworkError(err)
        }
    );
}
function installNextInterceptors(target,options) {
    let popType = options && options.popType || 'message'
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                if(!options || !options.mute){
                    response.data.msg && loadPop(`[${response.data.code}]${response.data.msg}`,popType);
                }
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if(!options || !options.mute){
                if(err.response && err.response.data && err.response.data.msg){
                    loadPop(err.response.data.msg,popType);
                }else{
                    loadPop('接口异常',popType);
                }
            }
            return PopNextworkError(err)
        }
    );
}
function installCmsInterceptors(target,options) {
    let popType = options && options.popType || 'message'
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                if(!options || !options.mute){
                    response.data.msg && loadPop(`[${response.data.code}]${response.data.msg}`,popType);
                }
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if(!options || !options.mute){
                loadPop(`[${err.response.data.statusCode}]${err.response.data.message}`,popType);
            }
            return PopNextworkError(err)
        }
    );
}
function installHelperInterceptors(target,options) {
    let popType = options && options.popType || 'message'
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code == 200 || !response.data.code) {
                return response;
            }else{
                if(!options || !options.mute){
                    loadPop(`[${response.data.code}]${response.data.message}`,popType);
                }
                return Promise.reject(response);
            }
        },
        function (err) {
            if(!options || !options.mute){
                loadPop('网络请求异常',popType);
            }
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
    installCmsInterceptors
};