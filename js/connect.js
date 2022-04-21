import { __server } from "../data/jx3box.json";
import oauth from "../data/oauth.json";
const connect = {
    github: `${oauth.github.authorize_uri}?client_id=${oauth.github.id}&redirect_uri=${__server}${oauth.github.callback}&state=login`,
    qq: `${oauth.qq.authorize_uri}?client_id=${oauth.qq.id}&redirect_uri=${__server}${oauth.qq.callback}&response_type=code&scope=get_user_info&state=login`,
    weibo: `${oauth.weibo.authorize_uri}?client_id=${oauth.weibo.id}&response_type=code&redirect_uri=${__server}${oauth.weibo.callback}&state=login`,
    wechat: `${oauth.wechat.authorize_uri}?appid=${oauth.wechat.id}&redirect_uri=${__server}${oauth.wechat.callback}&response_type=code&scope=snsapi_login&state=login#wechat_redirect`,
};
export default connect;
