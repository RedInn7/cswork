不用 `call`、`apply`、`bind` 和 `Reflect.apply`，实现两个方法：

- `Function.prototype.myCall(thisArg, ...args)`：以 `thisArg` 作为 `this` 调用函数，参数逐个传入；
- `Function.prototype.myApply(thisArg, argsArray)`：同上，参数以数组（或类数组）传入；`argsArray` 为 `null` 或 `undefined` 时不传参数。

要求：
- 返回函数的返回值；
- `thisArg` 为 `null` 或 `undefined` 时，`this` 是全局对象 `globalThis`（非严格模式下的行为）；原始值要包装成对象（`'abc'` → `String` 对象）；
- 调用结束后，`thisArg` 上不能多出任何属性。

```js
function greet(greeting, mark) { return `${greeting}, ${this.name}${mark}`; }
greet.myCall({ name: 'Ada' }, 'Hi', '!');      // 'Hi, Ada!'
greet.myApply({ name: 'Lin' }, ['Hello', '.']); // 'Hello, Lin.'
```
