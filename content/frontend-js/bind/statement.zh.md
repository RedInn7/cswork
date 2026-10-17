不用原生的 `bind`，实现 `Function.prototype.myBind(thisArg, ...presetArgs)`：

- 返回一个新函数 `bound`，调用它相当于以 `thisArg` 为 `this` 调用原函数，参数是 `presetArgs` 加上调用时传入的参数；
- 用 `new bound(...)` 调用时，忽略 `thisArg`，像 `new` 原函数一样创建实例：实例的原型链上有原函数的 `prototype`（`instanceof` 原函数为真），构造函数返回对象时以该对象为结果；
- 在非函数上调用时抛 `TypeError`。

可以使用 `apply` 或 `call`（或者上一题的 `myApply`）。

```js
function Point(x, y) { this.x = x; this.y = y; }
const AtOrigin = Point.myBind(null, 0);
const p = new AtOrigin(5);   // Point { x: 0, y: 5 }
p instanceof Point;          // true
```

测试期间原生的 `Function.prototype.bind` 被替换成会报错的函数。
