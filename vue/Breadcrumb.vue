<template>
    <div class="c-breadcrumb">
        <div class="u-menu" @click.stop="toggleLeftSide">
            <img class="u-toggle" :class="{isopen:open}" svg-inline src="../img/menu.svg" />
        </div>
        <slot></slot>
    </div>
</template>

<script>
export default {
    name: "Breadcrumb",
    props: [],
    data: function() {
        return {
            open : false
        };
    },
    computed: {},
    methods: {
        toggleLeftSide : function (){
            this.open = !this.open
            jQuery('.c-sidebar-left').toggleClass('isopen')
        }
    },
    mounted: function() {
        const vm = this
        jQuery("body").on("click", function(e) {
            vm.open = false
            jQuery('.c-sidebar-left').removeClass('isopen')
        });
    },
};
</script>

<style lang="less">
.c-breadcrumb {
    .pf;top:@header-height;
    .z(499);.w(100%);
    .h(@bread-height);
    // background-color: @bg-light;
    background-color: #fff;
    padding: 10px;
    box-sizing: border-box;
    .lh(28px);
    border-bottom: 1px solid @border-hr;

    .u-menu{
        .pa;.lt(0,2px);
        padding:10px;
        .none;

        svg{
            .h(29px);
            fill:@color;
        }

        .isopen{
            fill:@primary;
        }
    }

    .u-channel {
        .fl;
        span {
            .bold;
            // .fz(16px);
            // font-weight: 300;
            color: @color;
        }
        .mr(30px);
        &:hover{
            .u-title{
                color:@color-link;
            }
            .u-channel-logo{
                fill:@color-link;
            }
        }
    }
    .u-channel-logo {
        .fl;
        .size(28px);
        .mr(10px);
        fill: @bg-black;
    }
    
    .u-publish {
        .pa;.rt(8px,8px);
        padding: 8px 18px;
    }
}
@media screen and (max-width:@ipad){
    .c-breadcrumb{
        .u-publish{.none;}
    }
}
@media screen and (max-width:@ipad-y){
    .c-breadcrumb {
        .u-menu{
            .db;
        }
        .u-channel-logo{
            .none;
        }
        padding-left:40px;
    }
}
</style>
