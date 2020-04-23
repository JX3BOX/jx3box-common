<template>
    <div class="c-sidebar-right-msg">
        <i class="u-icon"><img svg-inline src="../img/ac.svg"/></i>
        <div class="u-msg">
            <slot></slot>
        </div>
    </div>
</template>

<script>
    export default {
        name : 'RightSideMsg',
        props:['msg'],
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
.c-sidebar-right-msg {
    @aiconh: 22px;

    border: 1px solid #0366d6;
    margin: 15px 15px 5px 15px;
    padding: 10px 10px 10px 30px;
    .r(6px);
    .pr;

    .u-icon {
        .db;
        .fl;
        .size(16px,@aiconh);
        svg {
            .size(16px);
        }
        .pa;
        .lt(10px, 50%);
        margin-top: -@aiconh / 2 + 2px;
    }

    .u-msg {
        .fz(12px, @aiconh);
    }
}
</style>
