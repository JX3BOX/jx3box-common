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
    target["interceptors"]["response"].use(
        function (response) {
            return response;
        },
        function (err) {
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
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
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
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code) {
                return Promise.reject(response);
            }
            return response;
        },
        function (err) {
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
    target["interceptors"]["response"].use(
        function (response) {
            if (response.data.code == 200 || !response.data.code) {
                return response;
            }
            return Promise.reject(response);
        },
        function (err) {
            return throwError(err);
        }
    );
}

export { installInterceptors, installNextInterceptors, installHelperInterceptors, installCmsInterceptors };
