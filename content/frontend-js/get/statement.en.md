Implement `get(object, path, defaultValue)`: read a nested value by path, never throwing when a level is missing.

- `path` is either a string, with `.` between properties and `[number]` for indexes such as `'user.tags[0].name'`, or an array of keys such as `['user', 'tags', '0', 'name']`.
- If the walk meets `null` or `undefined` on the way, or the final value is `undefined`, return `defaultValue`.
- A final value of `null`, `0`, `''` or `false` comes back as it is, not replaced by the default.

```js
const data = { user: { tags: [{ name: 'js' }] } };
get(data, 'user.tags[0].name');        // 'js'
get(data, ['user', 'tags', '0']);      // { name: 'js' }
get(data, 'user.address.city', 'N/A'); // 'N/A'
```
