**思路**：ES5 之前的经典写法：借一个空构造函数，把它的 `prototype` 设成 `proto`，`new` 出来的对象原型就是 `proto`。

```js
function Empty() {}
Empty.prototype = proto;
object = new Empty();
```

- `proto` 为 `null` 时这个办法不行：`prototype` 不是对象时，`new` 会退回 `Object.prototype`。这时用 `Object.setPrototypeOf({}, null)`。
- 先检查参数：只接受对象、函数或 `null`，否则抛 `TypeError`。
- 第二个参数是属性描述符，交给 `Object.defineProperties`。描述符里没写的 `enumerable`、`writable`、`configurable` 默认都是 `false`，所以测试里的 `hidden` 不会出现在 `Object.keys` 里，`x` 也不能被改写。

`objectCreate(null)` 常用来做「纯字典」：没有继承来的 `toString`、`constructor` 等键，`key in dict` 不会被原型上的属性干扰。
