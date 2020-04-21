<template>
    <div class="c-sidebar-left-toggle" @click="toggleLeftSide">
        <img class="u-toggle" :class="{isopen:open}" svg-inline src="../img/menu.svg" />
    </div>
</template>

<script>
    export default {
        name : 'LeftSideToggle',
        props:[],
        data : function(){
            return {
                open : false
            }
        },
        computed:{},
        methods:{
            toggleLeftSide : function (){
                this.open = !this.open
                jQuery('.c-sidebar-left').toggleClass('isopen')
            }
        },
        mounted:function(){},
        components : {
        }
    }
</script>

<style lang="less">
    .c-sidebar-left-toggle{
        .pa;.lt(0);
        padding:10px;
        .h(29px);

        svg{
            fill:@color;
            .h(29px);

            &.isopen{
                fill:@primary;
            }
        }
    }
</style>