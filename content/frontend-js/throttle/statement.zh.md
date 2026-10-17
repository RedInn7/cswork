实现 `throttle(func, wait)`，返回 `func` 的节流版本：不管调用多频繁，`func` 每 `wait` 毫秒最多执行一次。

- 空闲时的第一次调用**立即**执行，并开始一个 `wait` 毫秒的冷却窗口。
- 窗口内的调用不立即执行，只记住**最后一次**的参数和 `this`；窗口结束时用它执行一次，并紧接着开始下一个窗口。
- 窗口结束时没有记下的调用，就回到空闲状态，下一次调用又会立即执行。
- 返回的函数带 `cancel()` 方法：丢弃记下的调用并回到空闲状态。

```js
const onScroll = throttle((y) => console.log(y), 100);
onScroll(10);  // 立即打印 10
onScroll(20);  // 记下
onScroll(30);  // 覆盖为 30
// 100 ms 时打印 30
```

测试用假时钟：`setTimeout`、`clearTimeout` 和 `Date.now()` 由测试控制。
