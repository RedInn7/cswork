实现 `set(object, path, value)`：按路径写入值，路径上缺少的层级自动创建，返回 `object` 本身（直接修改它）。

- `path` 的格式和 `get` 题相同：`'a.b[0].c'` 或 `['a', 'b', '0', 'c']`。
- 某一层不存在，或者不是对象（比如是数字、`null`）时，新建一层来替换它：**下一个键是非负整数**就建数组 `[]`，否则建对象 `{}`。
- 已经存在的对象和数组原样保留，只往里写入。

```js
const config = {};
set(config, 'server.ports[0]', 8080);
// { server: { ports: [8080] } }
set(config, 'server.host', 'localhost');
// { server: { ports: [8080], host: 'localhost' } }
```
