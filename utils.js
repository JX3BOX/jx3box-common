module.exports = {
    resolveImagePath : function (url){
        return url.replace(JX3BOX.__ossRoot,JX3BOX.__ossMirror)
    }
}