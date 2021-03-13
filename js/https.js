import axios from "axios";
import { __next, __pay, __server } from "./jx3box.json";
import Vue from "vue";
import { Message, Notification } from "element-ui";
Vue.prototype.$notify = Notification;
Vue.prototype.$message = Message;
const broadcast = new Vue();