# OAuth

## 获取code
GET https://server.jx3box.com/oauth/jx3box/authorize  
params schema
```
client_id=<your_id>
redirect_uri=<your_callback>
```

=> 跳转至callback并附带code

## 获取token
GET https://server.jx3box.com/oauth/jx3box/access_token  
params schema
```
client_id=<your_id>
client_secret=<your_key>
code=<given_code>
```

=> 会直接返回token和uid,如无需查询资料的情况下,可只使用uid创建

## 获取资料
GET https://server.jx3box.com/user/info  
params schema
```
uid=<user_uid>
```

=> 此接口无需使用token