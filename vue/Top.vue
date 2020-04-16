<template>
    <header class="m-top">
        <a :href="homepage">
            <img
                class="u-pic"
                svg-inline
                src="../img/logo.svg"
            />
            JX3BOX
        </a>
        <hr />
        <p>{{data_title}}</p>
    </header>
</template>

<script>
const { JX3BOX } = require('../main');
export default {
    name: "Top",
    props:['data_title'],
    data: function() {
        return {
            homepage: JX3BOX.__Root,
        };
    },
};
</script>

<style lang="less">
@black: #24292e;
@bg: #f6f8fa;
@border: #e1e4e8;
@space: 20px;
@ipad: 1024px;
@ipad-y: 768px;

.m-top {
    margin: 0 auto;
    text-align: center;

    .u-pic {
        width: 60px;
        height: 60px;
        vertical-align: top;
    }
    a {
        display: inline-block;
        font-size: 32px;
        line-height: 60px;
        font-family: Calibri, -apple-system, BlinkMacSystemFont, Segoe UI,
            Helvetica Neue, Helvetica, sans-serif;
        font-weight: 600;
        letter-spacing: 2px;
        -webkit-font-smoothing: antialiased;
        margin: 0;
        color: @black;
    }
    hr {
        border: none;
        max-width: 40%;
        height: 1px;
        background-color: @border;
        margin: @space auto;
    }
    p {
        position: relative;
        font-size: 13px;
        letter-spacing: @space;
        top: -42px;
        background: @bg;
        display: inline-block;
        padding-left: @space;
        color: #777;
    }
}
</style>
