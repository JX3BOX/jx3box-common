<template>
    <aside class="c-sidebar-right c-sidebar">
        <slot></slot>
    </aside>
</template>

<script>
    export default {
        name : 'RightSidebar',
        props:[],
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
.c-sidebar-right{
    .pa;
    .lt(100%,0);
    .w(@aside-right);
    background-color:#fff;
    border-left:1px solid #eee;
    height:100%;
    box-sizing: border-box;
}

// 笔记本<1440 缩小双边栏
@media screen and (max-width:@notebook){
    .c-sidebar-right{
        .w(@aside-right - 20px);
    }
}

// 平板横屏
@media screen and (max-width:@mininote){
    .c-sidebar-right{
        .ps;
        .w(auto);
        border-left:none;
    }
}
</style>