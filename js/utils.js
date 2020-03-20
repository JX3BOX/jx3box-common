const dict = require('../includes/dict.js');

module.exports = {
    resolveImagePath : function (str){
        return (str && str.length) ?  str.replace(/oss\.jx3box\.com/g,'console.cnyixun.com') : ''
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
    },

    cn2tw : function (str){
        if(str.length){
            let arr = new Array(str.length)
            let i = -1
            for(let char of str){
                i = dict['cn'].indexOf(char)
                i > -1 ? arr.push(dict['tw'][i]) : arr.push(char)
            }
            return arr.join('')
        }else{
            return ''
        }
    }
}