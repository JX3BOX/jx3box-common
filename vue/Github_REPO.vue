<template>
    <div class="c-github-repo">
        <a class="u-repo" :href="html_url" target="_blank">
            <i class="i-github"
                ><img svg-inline src="../img/github.svg"
            /></i>
            <span class="u-name">{{ full_name }}</span>
            <em class="u-join">Contribute</em>
        </a>
        <div class="u-detail">
            <time class="u-update">Last updated:{{ updated_at }}</time>
            <h5 class="u-contributors">Contributors</h5>
            <ul class="u-list">
                <li v-for="(c, i) in contributors" :key="c + i">
                    <a :href="c.html_url" :title="c.login" target="_blank">
                        <img :src="c.avatar_url" :alt="c.login" />
                        <span>{{ c.contributions }}</span>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
const axios = require("axios");
export default {
    name: "Github_REPO",
    props: ["REPO"],
    data: function() {
        return {
            full_name: "",
            html_url: "",
            updated_at: "",
            contributors: [],
        };
    },
    computed: {},
    methods: {},
    mounted: function() {
        axios
            .get(`https://api.github.com/repos/JX3BOX/${this.REPO}`)
            .then((res) => {
                let data = res.data;
                this.full_name = data.full_name;
                this.html_url = data.html_url;
                this.updated_at = data.updated_at;
            });
        axios
            .get(
                `https://api.github.com/repos/JX3BOX/${this.REPO}/contributors`
            )
            .then((res) => {
                let data = res.data;
                this.contributors = data;
            });
    },
};
</script>

<style lang="less">
.c-github-repo {
    background-color: @bg-light;
    border: 1px solid #eee;
    .r(4px);
    margin: 10px;

    .u-repo {
        .db;
        border-bottom: 1px solid #eee;
        padding:5px;
        .h(32px);
        &:hover{
            .i-github{
                fill:#555;
            }
        }
    }
    .i-github {
        .dbi;
        .y(top);
        .mr(10px);
    }
    .u-name {
        .fz(1em, 32px);
        font-weight: 600;
    }
    .u-join{
        .fr;
        .fz(12px,32px);
        padding:0 5px;
        color:#999;
    }
    .u-detail{
        padding:3px 10px 0 10px;
    }
    .u-update {
        .fz(12px, 2);
        color: #555;
    }
    .u-contributors {
        padding: 0;
        margin: 0 0 10px 0;
    }
    .u-list {
        list-style: none;
        .clearfix;
        padding: 0;
        margin: 0;
        li {
            .mr(10px);
            .mb(10px);
            .fl;
        }
        a {
            .db;
            .size(32px);
            img {
                .db;
                .size(100%);
            }
            span {
                .none;
            }
        }
    }
}
</style>
