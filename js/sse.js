/**
 * 服务器主动推送工具类
 *
 * @property {string} url
 * @property {EventSource} eventSource
 */
export class SSE {
    /**
     * @param {string} url
     */
    constructor(url) {
        this.url = url;
        this.eventSource = null;
    }

    /**
     * 连接服务器
     *
     * @returns {void}
     */
    connect() {
        const url = this.url;
        this.eventSource = new EventSource(url);
    }

    /**
     * 断开服务器
     *
     * @returns {void}
     */
    disconnect() {
        this.eventSource.close();
    }

    /**
     * 绑定事件
     *
     * @param {string} event
     * @param {EventListenerOrEventListenerObject} callback
     */
    on(event, callback) {
        this.eventSource.addEventListener(event, callback);
    }

    /**
     * 取消绑定事件
     *
     * @param {string} event
     * @param {EventListenerOrEventListenerObject} callback
     */
    off(event, callback) {
        this.eventSource.removeEventListener(event, callback);
    }
}