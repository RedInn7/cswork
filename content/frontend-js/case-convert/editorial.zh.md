**camelToSnake**：用两条正则找出「单词边界」，插入 `_`，最后整体转小写。

```js
text.replace(/([a-z\d])([A-Z])/g, '$1_$2')   // userId → user_Id，h1Title → h1_Title
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // HTTPServer → HTTP_Server
    .toLowerCase();
```

第二条处理缩写：一串大写字母中，**最后一个**大写字母如果后面跟着小写，它其实是下一个单词的开头，所以要在它前面断开。只用第一条的话，`getHTTPResponse` 会变成 `get_httpresponse`。

**snakeToCamel**：`/(?<=[^_])_+([a-z\d])/g` 要求下划线前面有一个非下划线字符。开头的下划线前面没有字符，匹配不到，就保留下来了；结尾的下划线后面没有字母，同样保留。回调里把捕获到的字母转成大写。

下划线前面的检查特意用后行断言 `(?<=…)`：它只看不吃字符。如果写成捕获组 `([^_])_+`，单字母单词的那个字母会被这次匹配吃掉，下一个下划线前面就没有字符可以匹配了，`is_a_test` 会变成 `isA_test`。

注意 `snakeToCamel(camelToSnake(x))` 不一定能还原：`userID` 转过去再转回来是 `userId`，缩写信息已经丢了。接口字段转换最好在一个地方统一处理。
