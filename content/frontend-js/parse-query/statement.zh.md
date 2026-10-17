实现 `parseQuery(query)`：把 URL 的查询字符串解析成对象。

- 开头的 `?` 可有可无；按 `&` 切分，空的片段忽略（如 `a=1&&b=2`）；
- 每段在**第一个** `=` 处分成键和值，值里可以再有 `=`；没有 `=` 的片段，值为空字符串 `''`；
- 键和值都要解码：先把 `+` 换成空格，再 `decodeURIComponent`；
- 同一个键出现多次时，值按出现顺序组成数组；
- 空字符串（或只有 `?`）返回 `{}`。

```js
parseQuery('?q=js+closure&tag=a&tag=b&debug');
// { q: 'js closure', tag: ['a', 'b'], debug: '' }
parseQuery('redirect=%2Fhome%3Fx%3D1&eq=a=b');
// { redirect: '/home?x=1', eq: 'a=b' }
```

测试期间 `URLSearchParams` 被替换成会报错的类。
