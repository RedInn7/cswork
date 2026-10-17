不用 `instanceof` 和 `isPrototypeOf`，实现 `myInstanceof(value, Constructor)`，结果与 `value instanceof Constructor` 相同：

- 沿着 `value` 的原型链向上找，遇到 `Constructor.prototype` 就返回 `true`，找到链的尽头（`null`）就返回 `false`；
- `value` 是原始值（数字、字符串、`null` 等）时返回 `false`；
- `Constructor` 不是函数，或者它的 `prototype` 不是对象（比如箭头函数没有 `prototype`）时，抛 `TypeError`。

不需要处理 `Symbol.hasInstance`。

```js
myInstanceof([], Array);          // true
myInstanceof([], Object);         // true
myInstanceof('str', String);      // false：原始值
myInstanceof(Object.create(null), Object); // false
```
