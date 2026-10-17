**思路**：`pipe` 就是对函数列表做一次 `reduce`：初始值是第一个函数的结果，之后每个函数接收上一步的值。

```js
function pipe(...fns) {
  if (fns.length === 0) return (value) => value;
  const [first, ...rest] = fns;
  return (...args) => rest.reduce((value, f) => f(value), first(...args));
}
const compose = (...fns) => pipe(...fns.reverse());
```

- 第一个函数单独调用：`first(...args)`，这样它能接收多个参数。
- `compose` 把列表反过来再交给 `pipe`。这里的 `fns` 是剩余参数生成的新数组，`reverse()` 不会改到调用者传进来的数组。如果直接对外部数组用 `reverse()`，第二次调用就反了。
- 也可以用 `reduceRight` 直接写 `compose`。

Redux 的中间件和各种「管道」写法用的都是这个思路。
