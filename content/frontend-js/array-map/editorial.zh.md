**思路**：按规范的步骤来写：

1. `callback` 不是函数，抛 `TypeError`。
2. `source = Object(this)`，`length = source.length >>> 0`。长度在**开始时**读一次，回调里改动数组长度不影响遍历范围。
3. `result = new Array(length)`。只对 `i in source` 为真的位置调用 `callback.call(thisArg, source[i], i, source)` 并写入结果，空位跳过，结果里对应的位置也保持为空位。

- 用 `result.push(...)` 会丢掉空位，`[1, , 3]` 就变成了 `[2, 6]`。
- 判断空位要用 `i in source`，不能用 `source[i] === undefined`。`[undefined]` 的第 0 项不是空位，要正常调用回调。
- `>>> 0` 把长度转成非负整数，类数组的 `length` 缺失或不合法时会得到 0。

**写到原型上**：直接赋值 `Array.prototype.myMap = …` 会得到一个**可枚举**的属性，之后所有数组的 `for...in` 都会遍历到 `myMap`。用 `Object.defineProperty` 定义，`enumerable` 默认是 `false`，和内置方法一致。
