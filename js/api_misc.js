import { $cms } from './https'

// 面包屑
function getBreadcrumb(key) {
    return $cms()
        .get(`/api/cms/breadcrumb/${key}`)
        .then((res) => {
            return res.data.data.html || "";
        });
}

// 菜单
function getMenu(key) {
    return $cms().get(`/api/cms/menu-group/${key}`).then((res) => {
        return res.data.data.menus || []
    })
}

function getArticle(id) {
    return $cms()
        .get(`/api/cms/post/${id}`)
        .then((res) => {
            return res.data.data.post_content;
        });
}

// 公共菜单
function getMenus(params) {
    return $cms().get(`/api/cms/menu-group`, {
        params: params
    }).then((res) => {
        return res.data.data;
    })
}


export { getBreadcrumb, getMenu, getArticle, getMenus };
