// 面包屑
function getBreadcrumb(key) {
    return $helper()
        .get(`/api/breadcrumb/${key}`)
        .then((res) => {
            return res.data?.data?.breadcrumb?.html || "";
        });
}

export { getBreadcrumb };
