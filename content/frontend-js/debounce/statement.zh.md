实现 `debounce(func, wait, options)`，返回 `func` 的防抖版本。

两次调用间隔小于 `wait` 毫秒，就算同一轮。每次调用都让计时从 0 重新开始，直到 `wait` 毫秒内没有新的调用，这一轮才结束。

- `options.trailing`（默认 `true`）：这一轮结束时，用**最后一次**调用的参数和 `this` 执行一次 `func`。
- `options.leading`（默认 `false`）：这一轮的**第一次**调用立即执行 `func`。
- 两者都为 `true` 时：一轮里只调用了一次，`func` 只执行一次；调用了多次，开头和结尾各执行一次。
- 返回的函数带 `cancel()` 方法：丢弃还没执行的那次调用，下一次调用开始新的一轮。

```js
const save = debounce((text) => console.log('save', text), 300);
save('h'); save('he'); save('hello');
// 最后一次调用 300 ms 后，只打印一次：save hello
```

测试用假时钟：`setTimeout`、`clearTimeout` 和 `Date.now()` 由测试控制，不用真的等待。
