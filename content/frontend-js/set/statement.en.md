Implement `set(object, path, value)`: write a value at a path, creating missing levels on the way, and return `object` itself (changed in place).

- `path` has the same form as in `get`: `'a.b[0].c'` or `['a', 'b', '0', 'c']`.
- When a level is missing or isn't an object (a number, `null`, ...), replace it with a new one: an array `[]` if the **next key is a non-negative integer**, otherwise an object `{}`.
- Existing objects and arrays stay; values are written into them.

```js
const config = {};
set(config, 'server.ports[0]', 8080);
// { server: { ports: [8080] } }
set(config, 'server.host', 'localhost');
// { server: { ports: [8080], host: 'localhost' } }
```
