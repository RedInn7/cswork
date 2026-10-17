实现 `curry(func)`：返回 `func` 的柯里化版本。

- 需要的参数个数取 `func.length`。
- 每次调用可以传任意多个参数，参数会累积；累积到 `func.length` 个或更多时，用全部参数调用 `func` 并返回结果，否则返回一个继续收集参数的函数。
- 中间得到的部分应用函数可以**重复使用**，互不影响。
- `func.length` 为 0 时，调用一次（不带参数）就执行。

```js
const volume = curry((l, w, h) => l * w * h);
volume(2)(3)(4);   // 24
volume(2, 3)(4);   // 24
const base = volume(2);
base(3)(4);        // 24
base(5, 5);        // 50
```
