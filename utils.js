module.exports = {
    resolveImagePath : function (str){
        return str && str.replace(/oss\.jx3box\.com/g,'console.cnyixun.com')
    },

    checkImageLoad : function (jq){
        jq.length &&
        jq.one('error',function (){
            var img_url = $(this).attr("src");
            var fix_url = img_url.replace(
                /console\.cnyixun\.com/g,
                "oss.jx3box.com"
            );
            $(this).attr("src", fix_url);
        })
    }
}