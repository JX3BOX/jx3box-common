import Top from './Top.vue'
import Bottom from './Bottom.vue'
import Header from './Header.vue'
import Github_REPO from './Github_REPO.vue'
import RightSideMsg from './RightSideMsg.vue'
import LeftSideToggle from './LeftSideToggle.vue'

const components = {
    Top,
    Bottom,
    Header,
    Github_REPO,
    RightSideMsg,
    LeftSideToggle
}

const install = function (Vue, Option) {
     Object.keys(components).forEach((key) => {
        Vue.component(components[key].name, components[key])
    })
}

export default {
    install
}