<template>
    <footer class="c-footer" id="c-footer">
        <el-backtop target="body"></el-backtop>
        <div class="c-footer-left">
            <img class="u-flag" svg-inline src="../img/china.svg" />
            <a href="http://beian.miit.gov.cn/" class="u-beian" target="_blank">湘ICP备13012123号</a>
        </div>
        <div class="c-footer-right">
            <a class="u-about" :href="about" target="_blank">关于我们</a>
            <em>|</em>
            <a class="u-feedback" :href="feedback" target="_blank">帮助反馈</a>
        </div>
    </footer>
</template>

<script>
const {JX3BOX} = require('../main');
export default {
    name: "Footer",
    data: function() {
        return {
            about: JX3BOX.__Links.about,
            feedback: JX3BOX.feedback,
        };
    },
};
</script>

<style lang="less">
@pink:#f39;
.c-footer{
    padding:10px;
    .fz(13px);
    .clearfix;
    background-color: @bg-light;
    border:1px solid #eee;
    .r(4px);
    margin-bottom:10px;
    color:#999;
    a{color:#999;}
}
.c-footer-left{
    .fl;
    .u-flag{
        .size(18px);
        .y(-3px);
        .mr(5px);
    }
    .u-beian{
        .italic;
        &:hover{
            color:@pink;
            box-shadow:0 1px @pink;
        }
    }
}
.c-footer-right{
    .fr;

    em{
        margin:0 10px;
    }
    a{
        &:hover{
            color:@pink;
            box-shadow:0 1px @pink;
        }
    }
}
</style>
