import Vue from "vue";
import { Message, Notification } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
Vue.prototype.$message = MessageBox;
const POP = new Vue();

export default POP