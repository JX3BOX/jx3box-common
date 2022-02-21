import {$helper} from './https'

// 面包屑
function getBreadcrumb(key) {
    return $helper()
        .get(`/api/breadcrumb/${key}`)
        .then((res) => {
            return res.data.data.breadcrumb.html || "";
        });
}

// 菜单
function getMenu(key){
    return $helper().get(`/api/menu_group/${key}`).then((res) => {
        return res.data.data.menu_group.menus || []
    })
}

export { getBreadcrumb,getMenu };
