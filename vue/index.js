import Header from './Header.vue'
import Breadcrumb from './Breadcrumb.vue'

import Footer from './Footer.vue'
import Bottom from './Bottom.vue'

import RightSidebar from './RightSidebar.vue'
import RightSideMsg from './RightSideMsg.vue'
import Github_REPO from './Github_REPO.vue'

import LeftSidebar from './LeftSidebar.vue'

import Main from './Main.vue'


const components = {
    Header,
    Breadcrumb,

    Footer,
    Bottom,
    
    RightSidebar,
    RightSideMsg,
    Github_REPO,

    LeftSidebar,

    Main
}

const install = function (Vue, Option) {
     Object.keys(components).forEach((key) => {
        Vue.component(components[key].name, components[key])
    })
}

export default {
    install
}