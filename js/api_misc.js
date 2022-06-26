import { $helper, $cms } from './https'

// 面包屑
function getBreadcrumb(key) {
    return $helper()
        .get(`/api/breadcrumb/${key}`)
        .then((res) => {
            return res.data.data.breadcrumb.html || "";
        });
}

// 菜单
function getMenu(key) {
    return $helper().get(`/api/menu_group/${key}`).then((res) => {
        return res.data.data.menu_group.menus || []
    })
}

function getArticle(id) {
    return $cms()
        .get(`/api/cms/post/${id}`)
        .then((res) => {
            return res.data.data.post_content;
        });
}


export { getBreadcrumb, getMenu, getArticle };
