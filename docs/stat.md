# Stat 统计中心

```javascript
import {
    postStat,
    getStat,
    getStatRank,
} from "@jx3box/jx3box-common/js/stat.js";
```

参数说明
- type : 应用类型，例如macro,item
- id : 应用内ID，例如文章ID
- action : 动作，可选值：views(浏览次数),fav(收藏次数),like(点赞次数)
- sort : 排序方式，可选值：yesterday(昨日),today(今日),7days(7日),30days(最近30日)

## 发送统计
同一个 ip 的同一篇文章的同一个动作 10 分钟内不重复统计  
```javascript
postStat(type, id, action = "views")
```

## 获取统计
30秒缓存，返回一个Promise
```javascript
getStat(type, id)
```

## 获取指定统计排行榜
```javascript
getStatRank(type, action = "views", limit = 10, sort = "7days")
```