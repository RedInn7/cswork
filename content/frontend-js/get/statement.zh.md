实现 `get(object, path, defaultValue)`：按路径读取嵌套的值，路径上任何一层不存在都不报错。

- `path` 可以是字符串，用 `.` 分隔属性，用 `[数字]` 表示下标，例如 `'user.tags[0].name'`；也可以是键的数组，例如 `['user', 'tags', '0', 'name']`。
- 路径中途遇到 `null` 或 `undefined`，或者最终的值是 `undefined`，返回 `defaultValue`。
- 最终的值是 `null`、`0`、`''`、`false` 时照常返回，不用默认值。

```js
const data = { user: { tags: [{ name: 'js' }] } };
get(data, 'user.tags[0].name');        // 'js'
get(data, ['user', 'tags', '0']);      // { name: 'js' }
get(data, 'user.address.city', 'N/A'); // 'N/A'
```
