前端用 camelCase，很多后端接口用 snake_case。实现两个函数：

`camelToSnake(text)`：
- 在「小写字母或数字」与其后的大写字母之间插入 `_`：`userId` → `user_id`，`version2Beta` → `version2_beta`；
- 连续的大写字母（缩写）当作一个词，缩写后面紧跟一个「大写 + 小写」的新词时也要分开：`getHTTPResponse` → `get_http_response`，`userID` → `user_id`；
- 最后整体转成小写。

`snakeToCamel(text)`：
- 去掉单词之间的 `_`（一个或多个），并把其后的字母大写：`user_id` → `userId`，`a__b` → `aB`；
- 开头的下划线保留：`__private_value` → `__privateValue`；结尾的下划线也保留；
- 输入都是小写的 snake_case。

```js
camelToSnake('getHTTPResponse'); // 'get_http_response'
snakeToCamel('created_at');      // 'createdAt'
```
