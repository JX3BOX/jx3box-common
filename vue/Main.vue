<template>
    <main class="c-main" :class="{'without-right':withoutRight}">
        <slot></slot>
    </main>
</template>

<script>
    export default {
        name : 'Main',
        props:['withoutRight'],
        data : function(){
            return {
            }
        },
        computed:{},
        methods:{},
        mounted:function(){},
    }
</script>

<style lang="less">

a{
    color:@color-link;
}

// 主体
.c-main{
    .ml(@aside-left);
    .mr(@aside-right);
    .pr;
    min-height: calc(100vh - @header-height - @bread-height);
    margin-top:@header-height + @bread-height;
}
.c-main.without-right{
    .mr(0) !important;
}


// 笔记本<1440 缩小双边栏
@media screen and (max-width:@notebook){
    .c-main{
        .ml(@aside-left - 40px);
        .mr(@aside-right - 20px);
    }
}

// 平板横屏
@media screen and (max-width:@mininote){
    .c-main{
        .ml(@aside-left - 60px);
        .mr(0);
    }
}

//平板横屏与手机
@media screen and (max-width:@ipad-y){
    .c-main{
        .ml(0);
    }
}
</style>