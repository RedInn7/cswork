**思路**：闭包里放两个变量：`called` 标记是否执行过，`result` 存结果。

- 「执行过」要用单独的布尔值记，不能用 `result === undefined` 判断，否则返回 `undefined` 的函数会一直被执行。
- 返回值写成普通 `function`，用 `func.apply(this, args)` 传 `this`。
- `func` 抛错时，题目要求下一次调用可以重试。所以要先执行 `func`，**成功后**再把 `called` 设为 `true`：

```js
return function (...args) {
  if (!called) {
    result = func.apply(this, args);
    called = true;
  }
  return result;
};
```

适用场景：初始化、只绑定一次的事件、防止重复提交。
