<template>
    <footer class="m-bottom">
        &copy;
        <a :href="about" target="_blank">About JX3BOX</a>
        <a class="u-feedback" :href="feedback" target="_blank">❤ 反馈建议</a>
    </footer>
</template>

<script>
const { JX3BOX } = require('../main');
export default {
    name: "Bottom",
    data: function() {
        return {
            about: JX3BOX.about,
            feedback: JX3BOX.feedback,
        };
    },
};
</script>

<style lang="less">
@gray: #888;
@space: 20px;
@pink: #f39;

.m-bottom {
    font-size: 12px;
    color: @gray;
    margin-top: @space;

    a {
        color: @gray;
        &:hover {
            color: @pink;
        }
    }

    .u-feedback {
        float: right;
    }
}
</style>
