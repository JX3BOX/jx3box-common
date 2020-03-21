<template>
    <header class="c-header" id="c-header">
        <div class="c-header-inner">
            <!-- logo -->
            <a class="c-header-logo" id="c-header-logo" :href="JX3BOX.__Root">
                <img class="u-pic" svg-inline src="../img/logo.svg" />
                <span class="u-txt">JX3BOX</span>
            </a>

            <!-- search -->
            <div class="c-header-search" id="c-header-search">
                <div class="c-search">
                    <form
                        class="u-form"
                        :action="JX3BOX.__search"
                        :target="isPhone ? '_self' : '_blank'"
                    >
                        <input
                            class="u-text"
                            type="text"
                            autocomplete="off"
                            name="q"
                            placeholder="搜索.."
                        />
                        <input class="u-btn" type="submit" value="" />
                    </form>
                </div>
            </div>

            <div class="c-header-nav">
                <ul>
                    <li v-for="(item,type) in nav" :key="'nav-'+type">
                        <a :href="item.path" :class="{on:isFocus(type)}">{{item.name}}</a>
                    </li>
                </ul>
            </div> 

            <!-- user -->
            <div class="c-header-user" id="c-header-user">
                <!-- user msg -->
                <div class="c-header-msg" id="c-header-msg">
                    <i class="u-pop" style="display:none;" v-show="pop"></i>
                    <a
                        class="u-msg"
                        @click="expandList($event, 'msg')"
                        :href="JX3BOX.__user_msg"
                        ><i class="u-icon u-icon-msg"
                            >
                            <img svg-inline src="../img/msg.svg"/>
                            </i
                    ></a>
                    <div
                        class="u-list"
                        style="display:none;"
                        v-show="!fold.msg"
                    >
                        <ul v-if="msgs.length">
                            <li v-for="(msg, i) in msgs" :key="'user-msg-' + i">
                                <span
                                    :class="msg.read ? 'u-read' : 'u-unread'"
                                    >{{ msg.content }}</span
                                >
                                <em
                                    :class="msg.read ? 'u-read' : 'u-unread'"
                                    @click="markthis($event, msg)"
                                >
                                    {{ msg.read ? "已读" : "未读" }}
                                </em>
                                <time>{{ msg.created | formatDatetime }}</time>
                            </li>
                        </ul>
                        <div v-else class="u-null">暂无消息</div>

                        <div class="u-misc">
                            <em
                                class="u-all u-read"
                                :class="{ markall: pop }"
                                @click="markall($event)"
                            >
                                {{ pop ? "全部标记" : "全部已读" }}
                            </em>
                            <a class="u-more" :href="JX3BOX.__user_msg"
                                >查看更多 &raquo;</a
                            >
                        </div>
                    </div>
                </div>

                <!-- user panel -->
                <div
                    class="c-header-panel"
                    id="c-header-panel"
                    @click="expandList($event, 'panel')"
                >
                    <svg
                        class="u-add"
                        viewBox="0 0 12 16"
                        version="1.1"
                        width="12"
                        height="16"
                        aria-hidden="true"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M12 9H7v5H5V9H0V7h5V2h2v5h5v2z"
                        ></path>
                    </svg>
                    <span class="u-dropdown"></span>
                    <ul
                        class="u-menu"
                        style="display:none;"
                        v-show="!fold.panel"
                    >
                        <li>
                            <a :href="JX3BOX.__post_macro">+ 剑三宏</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_jx3dat">+ 插件数据</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_fb">+ 副本攻略</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_bps">+ 职业攻略</a>
                        </li>
                        <hr />
                        <li>
                            <a :href="JX3BOX.__post_cj">+ 成就攻略</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_share">+ 捏脸数据</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_tool">+ 教程工具</a>
                        </li>
                        <li>
                            <a :href="JX3BOX.__post_bbs">+ 交流讨论</a>
                        </li>
                    </ul>
                </div>

                <!-- user info -->
                <div class="c-header-info">
                    <div
                        class="c-header-profile"
                        id="c-header-profile"
                        @click="expandList($event, 'info')"
                    >
                        <img
                            class="u-avatar"
                            :src="user.avatar"
                            :alt="user.name"
                        />
                        <span class="u-dropdown"></span>
                        <ul
                            class="u-menu"
                            style="display:none;"
                            v-show="!fold.info"
                        >
                            <li>
                                <a
                                    :href="JX3BOX.__user_dashboard"
                                    >我的作品</a
                                >
                            </li>
                            <li>
                                <a
                                    :href="JX3BOX.__user_cmt"
                                    >我的评论</a
                                >
                            </li>
                            <li>
                                <a
                                    :href="JX3BOX.__user_fav"
                                    >我的收藏</a
                                >
                            </li>
                            <hr />
                            <li>
                                <a
                                    :href="JX3BOX.__user_setting"
                                    >设置</a>
                            </li>
                            <li>
                                <a :href="JX3BOX.__user_logout"
                                    >登出</a>
                            </li>
                        </ul>
                    </div>

                    <div class="c-header-login none">
                        <div class="u-default">
                            <a :href="JX3BOX.__user_login">登录</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>

<script>
const { JX3BOX } = require("@jx3box/jx3box-common");
const axios = require("axios");
const moment = require("moment");

const MSG_API = JX3BOX.__helperUrl + "api/messages";
const MARK_API = JX3BOX.__helperUrl + "api/messages/read";

export default {
    name: "Header",
    data: function() {
        return {
            JX3BOX,
            isPhone : false,

            uid: 8, //TODO:修改ID
            user:{},

            //nav
            nav:JX3BOX.__channel,

            //user
            msgs: [],
            pop: false,
            fold: {
                msg: true,
                panel: true,
                info: true
            },
        };
    },
    methods: {
        isFocus:function (type){
            return location.pathname.includes(type)
        },
        expandList: function(e, current) {
            if (current == "msg") {
                if (this.isPhone) {
                    return;
                } else {
                    e.preventDefault();
                }
            }

            e.stopPropagation();

            for (let _key in this.fold) {
                if (_key == current) {
                    this.fold[current] = !this.fold[current];
                } else {
                    this.fold[_key] = true;
                }
            }
        },
        markthis: function(e, msg) {
            e.stopPropagation();
            axios({
                method: "put",
                url: MARK_API,
                data: {
                    user_id: this.uid,
                    ids: [msg.ID]
                }
            }).then(res => {
                msg.read = 1;
            });
        },
        markall: function(e) {
            e.stopPropagation();
            axios({
                method: "put",
                url: MARK_API,
                data: {
                    user_id: this.uid,
                    ids: []
                }
            }).then(res => {
                this.pop = false;
                this.msgs.forEach(function(msg) {
                    msg.read = 1;
                });
            });
        }
    },
    filters: {
        formatDatetime: function(timestamp) {
            let dt = new Date(timestamp * 1000);
            return moment(dt).format("YYYY-MM-DD HH:mm:ss");
        }
    },
    mounted: function() {
        // 面板
        this.isPhone = window.innerWidth < 720 ? true : false
        const vm = this;
        jQuery("body").on("click", function(e) {
            for (let _key in vm.fold) {
                vm.fold[_key] = true;
            }
        });

        // 消息
        let condition = encodeURIComponent("where[user_id]");
        if (Number(this.uid)) {
            axios({
                method: "get",
                url: MSG_API + "?" + condition + "=" + this.uid + "&length=3"
            }).then(res => {
                this.msgs = res.data.data.messages;
                if (res.data.data.unread_count) {
                    this.pop = true;
                }
            });
        }

        // 用户
        axios.get(`${JX3BOX.__wpRest.classic}users/me`).then((res) => {
            console.log(res)
        })
        
        
    }
};
</script>

<style lang="less">
.c-header {
    .pf;
    .lt(0, 0);
    .z(500);
    .w(100%);
    .h(@header-height);
    background-color: @bg-black;
    color: #fff;
}
.c-header-inner {
    // padding: 16px;
    .clearfix;
}

//logo
.c-header-logo {
    .db;
    .fl;
    padding:16px 10px 16px 10px;

    .u-pic {
        .size(@logo-size);
        margin-right: 5px;
        .fl;
        fill: #fff;
    }
    .u-txt {
        .color(#fff);
        font-family: Consolas;
        .fz(20px, @logo-size);
        // font-style: italic;
    }

    transition:background-color 0.1s ease-in;
    &:hover{
        background-color: @color-link;
    }

    margin-right: 10px;
}
@media screen and (max-width: @phone) {
    .c-header-logo {
        .u-pic {
            margin: 0;
        }
        .u-txt {
            .none;
        }
        .mr(0);
    }
}

//搜索
.c-header-search {
    .fl;
    .w(304px);
    padding:16px 0;

    .u-form {
        .pr;
    }

    .u-text {
        background-color: hsla(0, 0%, 100%, 0.125);
        border: 0;
        box-shadow: none;
        color: #fff;
        height: @logo-size;
        box-sizing: border-box;
        border-radius: 3px;
        .fz(14px, @logo-size);
        padding: 0.625em 0.4375em;
        .w(100%);

        &:focus {
            background-color: #fff;
            color: #1a1a1a;
            outline: 0;
        }
        transition:background-color 0.1s ease-in;
    }

    .u-btn {
        border: 0;
        .pa;
        .rt(8px, 6px);
        .db;
        .size(19px, 20px);
        padding: 0;
        &,
        &:hover {
            background: url("@{url}header/search-key-slash.svg") no-repeat 0 0;
        }
    }

    margin-right: 10px;
}
@media screen and (max-width: @phone) {
    .c-header-search {
        float: none;
        .w(auto);

        margin-left: @logo-size + 20px;
        margin-right: 140px;
    }
}

//菜单
.c-header-nav{
    .fl;

    font-family: Montserrat, "Helvetica Neue", sans-serif;

    ul{
        .clearfix;
        margin:0;
        padding:0;
    }
    ul li {
        .lh(@logo-size);//.bold;
        .fl;
        // margin-right:10px;
        // padding:0 10px;
        padding:0;
        margin:0;
        list-style:none;

        a{
            // .color(#fff,@color-blue);
            .db;
            .fz(14px,@logo-size);
            color:#fff;
            // font-weight:300;
            &:hover{
                background-color: lighten(@color-link,20%);
            }
            &.on{
                background-color: @color-link;
            }
            padding:16px 15px;
            transition:0.1s ease-in;
        }
        &.current-menu-item a{
            color:@color-blue;.bold;
            border-bottom:2px solid @color-blue;
        }
    }
}
@media screen and (max-width:@ipad){
    .c-header-nav{
        .none;
    }
}

//用户相关
.c-header-user {
    .fz(14px);
    .pa;
    .rt(10px,0);

    .u-dropdown {
        border-bottom: 0 solid transparent;
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top-style: solid;
        border-top-width: 4px;
        content: "";
        display: inline-block;
        height: 0;
        vertical-align: middle;
        width: 0;
    }

    .u-avatar {
        .size(24px);
    }

    .u-menu {
        // .none;

        background-clip: padding-box;
        background-color: #fff;
        color: @color;
        border: 1px solid rgba(27, 31, 35, 0.15);
        border-radius: 4px;
        box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15);
        right: 0;
        list-style: none;
        margin: -6px 0 0 0;
        padding: 5px 0;
        position: absolute;
        top: 100%;
        width: 160px;
        z-index: 100;

        &:before {
            content: "";
            display: inline-block;
            position: absolute;
            left: auto;
            right: 9px;
            top: -16px;
            border: 8px solid transparent;
            border-bottom-color: rgba(27, 31, 35, 0.15);
        }

        &:after {
            content: "";
            display: inline-block;
            position: absolute;
            left: auto;
            right: 10px;
            top: -14px;
            border: 7px solid transparent;
            border-bottom-color: #fff;
        }

        a {
            .db;
            .lh(21px);
            .color(#454545, #fff);
            outline: none;
            text-decoration: none;
            overflow: hidden;
            padding: 4px 10px 4px 16px;
            text-overflow: ellipsis;
            white-space: nowrap;

            &:hover {
                background-color: @color-link;
            }
        }

        hr {
            .mt(2px);
            .mb(2px);
        }
    }
}

//消息面板
.c-header-msg {
    .fl;
    .pr;
    .h(32px);
    padding:16px 0;

    .u-msg {
        .db;
        .h(100%);
        margin-top: 4px;
        padding: 6px 10px;
        &:hover {
            .tm(0.7);
        }
        .pointer;
    }
    .u-icon-msg {
        .size(15px, 16px);
        .db;
        // margin-top: 9px;
        svg {
            .size(100%);
        }
    }
    .u-pop {
        .size(10px);
        color: #fff;
        background-image: linear-gradient(#54a3ff, #006eed);
        background-clip: padding-box;
        border: 2px solid #24292e;
        border-radius: 50%;
        .pa;
        .rt(2px, 0);
    }
    .u-list {
        // .none;
        .pa;
        .rt(-2px, 100%);
        margin-top: -6px;
        z-index: 100;
        background-color: #fff;
        box-sizing: content-box;
        .w(300px);
        min-height: 80px;
        max-height: 210px;
        border-radius: 4px;
        box-shadow: 0 3px 12px rgba(27, 31, 35, 0.15);
        color: #666;
        border: 1px solid #ccc;
        padding: 10px;

        ul {
            padding: 0;
            margin: 0;
            list-style: none;
            .clearfix;
        }

        // overflow-y:auto;
        // &::-webkit-scrollbar {
        //     width: 4px;
        // }
        // &::-webkit-scrollbar-track,&::-webkit-scrollbar-track-piece {
        //     background-color: #fafafa;
        //     border-radius: 6px;
        // }
        // &::-webkit-scrollbar-thumb {
        //     background-color: #eee;
        //     border-radius: 6px;
        // }
        // &::-webkit-scrollbar-button,&::-webkit-scrollbar-corner,&::-webkit-resizer {
        //     display: none;
        // }

        li {
            .mb(5px);
            padding-bottom: 10px;
            .clearfix;
            border-bottom: 1px solid #eee;

            &.isdone {
                color: #999;
            }
        }

        span {
            .db;
            .nobreak;
            .fz(13px);
            .lh(1.6);
            &.u-read {
                color: #999;
            }
        }

        em {
            .fr;
            .fz(12px);
            &.u-unread {
                // color:@color-link;
                cursor: pointer;
                // &:hover{
                color: #fff;
                background-color: @color-link;
                &:hover {
                    background-color: lighten(@color-link, 10%);
                }
                // }
            }
            &.u-read {
                color: #999;
            }
            padding: 1px 5px;
            .r(2px);
        }
        .markall {
            border: 1px solid #ddd;
            .r(2px);
            .pointer;
            &:hover {
                color: #666;
                border-color: #ccc;
            }
        }

        time {
            .fz(12px);
            color: #999;
            .db;
            .mt(3px);
            .fl;
        }

        .u-misc {
            padding: 5px 0 0 0;
        }

        .u-more,
        .u-feedback {
            .fz(12px);
            .underline(@color-link);
            //.fl;
        }

        .u-all {
            .fr;
        }

        &:before {
            content: "";
            display: inline-block;
            position: absolute;
            left: auto;
            right: 9px;
            top: -15px;
            border: 8px solid transparent;
            border-bottom-color: #fff;
        }

        &:after {
            content: "";
            display: inline-block;
            position: absolute;
            left: auto;
            right: 10px;
            top: -14px;
            border: 7px solid transparent;
            border-bottom-color: #fff;
        }
    }
    &.on {
        .u-list {
            .db;
        }
    }
    .u-null {
        padding: 20px 0;
        .x;
    }
}

//操作面板
.c-header-panel {
    .fl;
    .pr;
    .h(32px);
    padding: 16px+6px 10px 10px 10px;
    user-select: none;
    .pointer;

    .u-add {
        fill: #fff;
        .y;
        margin-right: 4px;
    }

    &.on {
        .u-menu {
            .db;
        }
    }

    &:hover {
        .u-add,
        .u-dropdown {
            .tm(0.7);
        }
    }
}

//登录、用户信息
.c-header-info{
    .fl;
    padding:16px 0;

    .c-header-login{

        transition: .4s;
        border:1px solid @border-hr;
        .r(3px);
        .clearfix;

        .u-default,.u-extend{.fl;}

        // .u-default{
        //     border-right:1px solid #eee;
        // }
        .u-default a{
            .db;
            .lh(@logo-size - 2px);
            padding:0 8px;
            color: #fff;
            &:hover{
                color: hsla(0,0%,100%,.75);
            }
        }

        .u-extend{
            //background-color: hsla(0,0%,100%,.125);
            background-color: #fafafa;
            .h(@logo-size - 2px);
            padding-left:5px;

            .c-passport{
                .clearfix;
                padding:(@logo-size - 24px - 2px) / 2 0;
            }

            a{
                .fl;
                .db;
                margin-right:5px;
            }

            img{
                .y;
                .size(24px,auto) !important;
            }

            .none;
        }

    }

    .c-header-profile{
        .pointer;
        .pr;
        padding:6px 5px 2px 6px;

        .u-menu{
            margin-top:8px;
        }
        .u-name{
            .lh(30px);
            padding:0 16px;
            .nobreak;
            b{.bold;.db;.fl;.nobreak;max-width:60px;}
            span{color:#666;letter-spacing:0.5px;.ml(3px);}
            cursor:default;
        }
        .u-avatar{
            .y;
            margin-right:2px;
        }

        hr{
            margin:8px 0;
            border-top: 1px solid @border-hr;
        }

        &.on{
            .u-menu{.db;}
        }
        .u-hr{
            border-top: 1px solid @border-hr;
        }

        &:hover{
            .u-dropdown{
                .tm(0.7);
            }
        }
    }
}

</style>
