rewrite ^/$ /index redirect;
#pve
#rewrite ^/macro/(\d+)\/?$    /macro/?pid=$1 permanent;
rewrite ^/macro/(\d+)\/?$    /macro/ last;
#rewrite ^/jx3dat/(\d+)\/?$    /jx3dat/?pid=$1 permanent;
rewrite ^/jx3dat/(\d+)\/?$    /jx3dat/ last;
#rewrite ^/fb/(\d+)\/?$    /fb/?pid=$1 permanent;
rewrite ^/fb/(\d+)\/?$    /fb/ last;
#rewrite ^/bps/(\d+)\/?$    /bps/?pid=$1 permanent;
rewrite ^/bps/(\d+)\/?$    /bps/ last;
#tool
#rewrite ^/tool/(\d+)\/?$    /tool/?pid=$1 permanent;
rewrite ^/tool/(\d+)\/?$    /tool/ last;
rewrite ^/help/(\d+)\/?$    /tool/$1 permanent;
#bbs
rewrite ^/bbs/(\d+)\/?$    /bbs/ last;
rewrite ^/discuz/(\d+)\/?$    /bbs/$1 permanent;
rewrite ^/memory/(\d+)\/?$    /bbs/$1 permanent;
#misc
#rewrite ^/author/(\d+)\/?$    /author/?uid=$1 permanent;
rewrite ^/author/(\d+)\/?$    /author/ last;
#pvx
#rewrite ^/house/(\d+)\/?$    /house/?pid=$1 permanent;
rewrite ^/house/(\d+)\/?$    /house/ last;
#rewrite ^/share/(\d+)\/?$    /share/?pid=$1 permanent;
rewrite ^/share/(\d+)\/?$    /share/ last;
#other
rewrite ^/wp-json/qqworld-passport/v1/module/weibo/(.*) https://server.jx3box.com/oauth/weibo/callback$1 permanent;


<!-- 团队栏目 -->
location /team {
    try_files $uri $uri/ /team/index.html;
}
location /rank/race {
    try_files $uri $uri/ /rank/race/index.html;
}

<!-- 百科栏目 -->
rewrite ^/wiki(.*) https://www.jx3box.com/knowledge$1 permanent;
