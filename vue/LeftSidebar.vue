<template>
    <aside class="c-sidebar-left c-sidebar">
        <slot></slot>

    </aside>
</template>

<script>
    export default {
        name : 'LeftSidebar',
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
.c-sidebar-left{
    .w(@aside-left);
    box-sizing:border-box;
    padding:10px;
    .pf;
    left:0;
    top:@header-height + @bread-height;
    bottom:0;
    background-color:@bg-light;
    border-right:1px solid #eee;

    &::-webkit-scrollbar {
        width: 4px;
    }
    &::-webkit-scrollbar-track,&::-webkit-scrollbar-track-piece {
        background-color: #fafafa;
        border-radius: 6px;
    }
    &::-webkit-scrollbar-thumb {
        background-color: #eee;
        border-radius: 6px;
    }
    &::-webkit-scrollbar-button,&::-webkit-scrollbar-corner,&::-webkit-resizer {
        display: none;
    }
    
}

// 笔记本<1440 缩小双边栏
@media screen and (max-width:@notebook){
    .c-sidebar-left{
        .w(@aside-left - 40px);
    }
}

// 平板横屏
@media screen and (max-width:@mininote){
    .c-sidebar-left{
        .w(@aside-left - 60px);
    }
}

//平板横屏与手机
@media screen and (max-width:@ipad-y){
    .c-sidebar-left{
        .pf;
        .z(500);
        transition: 0.2s ease-in-out;
        transform:translateX(-100%);
        &.isopen{
            transform:translateX(0);
            box-shadow: 0 5px 5px rgba(0,0,0,.2);
        }
    }
}
</style>