实现两个函数：

- `compose(...fns)`：**从右往左**依次调用，`compose(f, g, h)(x)` 等于 `f(g(h(x)))`；
- `pipe(...fns)`：**从左往右**依次调用，`pipe(f, g, h)(x)` 等于 `h(g(f(x)))`。

最先被调用的那个函数可以接收多个参数，其余函数都只接收上一步的返回值。没有传函数时，返回的函数原样返回它收到的第一个参数。

```js
const slug = pipe((s) => s.trim(), (s) => s.toLowerCase(), (s) => s.replace(/\s+/g, '-'));
slug('  Hello World '); // 'hello-world'
```
