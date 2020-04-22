<template>
    <footer class="m-bottom">
        <a :href="homepage" target="_blank">&copy; JX3BOX.COM</a>
        <a class="u-feedback" :href="feedback" target="_blank" title="需要帮助? ❤Angela~ I need healing!">❤ Help</a>
    </footer>
</template>

<script>
const { JX3BOX } = require('../main');
export default {
    name: "Bottom",
    data: function() {
        return {
            homepage: JX3BOX.__Root,
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
    font-family: verdana,'Trebuchet MS',Tahoma;

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
