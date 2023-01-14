# Utils

```javascript
import Utils from '@jx3box/jx3box-common/js/utils.js
或
import {__showAvatar} from '@jx3box/jx3box-common/js/utils.js'
```

## 图片处理函数
### [showAvatar]('../js/utils#L40')(url,size) 头像图片处理
- 为空时会返回默认头像，并做对应处理
- 可指定字符串预设样式s,m,l或指定一个数字,总是返回方形
```javascript
// 1.使用指定尺寸头像
showAvatar(url,100)
// => https://cdn.jx3box.com/path/to/pic.jpg?x-oss-process=image/auto-orient,1/resize,m_fill,w_100,h_100/quality,Q_100

// 2.使用预设尺寸头像 
showAvatar(url,'s') 
// => https://cdn.jx3box.com/path/to/pic.jpg?x-oss-process=style/avatar_s

// 3.当不希望使用中转CDN时，显式设置第3个参数为false
showAvatar(url,100,false)
// => https://oss.jx3box.com/path/to/pic.jpg?x-oss-process=image/auto-orient,1/resize,m_fill,w_100,h_100/quality,Q_100
```

### [getThumbnail]('../js/utils#L95')(url,size) 图片OSS通用处理
- 为空时不会处理，会返回空字符串（没有默认头像、需自行本地处理为空时返回值）
- 默认使用88*88方形，可返回方形(传递单数字)或者指定任意居中剪裁尺寸(传递数组)或指定任意预设样式(传递字符串)
```javascript
// 1.设置一个指定数字方形 
getThumbnail(url,100) 
// => https://cdn.jx3box.com/path/to/pic.jpg?x-oss-process=image/auto-orient,1/resize,m_fill,w_100,h_100/quality,Q_100

// 2.设置指定宽高长方形（等比缩放后居中剪裁）
getThumbnail(url,[180,100])
// => https://cdn.jx3box.com/path/to/pic.jpg?x-oss-process=image/auto-orient,1/resize,m_fill,w_180,h_100/quality,Q_100

// 3.设置指定预设oss样式（cms通用栏目目前预设为mini_banner:168*88)
getThumbnail(url,'mini_banner')
// => https://cdn.jx3box.com/path/to/pic.jpg?x-oss-process=style/mini_banner

// 4.当不希望使用中转CDN时，显式设置第3个参数为false
getThumbnail(url,100,false)
// => https://oss.jx3box.com/path/to/pic.jpg?x-oss-process=image/auto-orient,1/resize,m_fill,w_100,h_100/quality,Q_100
```

## 快捷过滤器
### [getLink]('../js/utils#L137') 文章链接
- 匹配不到对应应用类型时返回$appType/$id形式
```javascript
getLink(type,id,level)
// => https://www.jx3box.com/macro/1
```

### iconLink 图标地址
- 为空时会返回指定默认空图标
```javascript
iconLink(id)
// => https://icon.jx3box.com/icon/$id.png
```

### editLink 编辑地址
```javascript
editLink(type,id)
// => https://www.jx3box.com/dashboard/publish/#/$type/$id
```

### publishLink 发布地址
```javascript
publishLink(type)
// => https://www.jx3box.com/dashboard/publish/#/$type
```

### authorLink 用户主页
```javascript
authorLink(id)
// => https://www.jx3box.com/author/$id
```

### tvLink 直播间地址
```javascript
tvLink(type,id)
// => https://www.$type.com/_room_path/$id
```