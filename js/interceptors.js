import { loadPop } from "@jx3box/jx3box-ui-pop";

function throwError(err) {
    console.log(err.response);
    return Promise.reject(err);
}

/**
 * 无包装器的拦截器
 *
 * @param {*} target
 * @param {*} options
 */
function installInterceptors(target, options) {
    let popOptions = options && options.pop;
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
            if (!options || !options.mute) {
                if (err.response && err.response.data && err.response.data.msg) {
                    (popOptions && loadPop(popOptions)) || loadPop(err.response.data.msg);
                } else {
                    loadPop("网络请求异常");
                }
            }
            return throwError(err);
        }
    );
}

/**
 * Next统一包装模式
 * go server
 * @param {*} target
 * @param {*} options
 */
function installNextInterceptors(target, options) {
    let popOptions = options && options.pop;
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                if (!options || !options.mute) {
                    (popOptions && loadPop(popOptions)) || loadPop(`[${response.data.code}]${response.data.msg}`);
                }
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if (!options || !options.mute) {
                if (err.response && err.response.data && err.response.data.msg) {
                    loadPop(err.response.data.msg);
                } else {
                    loadPop("网络请求异常");
                }
            }
            return throwError(err);
        }
    );
}

/**
 * CMS统一包装模式
 * node.js server
 * @param {*} target
 * @param {*} options
 */
function installCmsInterceptors(target, options) {
    let popOptions = options && options.pop;
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                if (!options || !options.mute) {
                    (popOptions && loadPop(popOptions)) || loadPop(`[${response.data.code}]${response.data.msg}`);
                }
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
            if (!options || !options.mute) {
                loadPop(`[${err.response.data.statusCode}]${err.response.data.message}`);
            }
            return throwError(err);
        }
    );
}

/**
 * Helper统一包装模式
 * php server
 * @param {*} target
 * @param {*} options
 */
function installHelperInterceptors(target, options) {
    let popOptions = options && options.pop;
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code == 200 || !response.data.code) {
                return response;
            } else {
                if (!options || !options.mute) {
                    (popOptions && loadPop(popOptions)) || loadPop(`[${response.data.code}]${response.data.message}`);
                }
                return Promise.reject(response);
            }
        },
        function (err) {
            if (!options || !options.mute) {
                loadPop("网络请求异常");
            }
            return throwError(err);
        }
    );
}

export { installInterceptors, installNextInterceptors, installHelperInterceptors, installCmsInterceptors };
