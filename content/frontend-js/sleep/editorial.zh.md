**思路**：把 `setTimeout` 包进 `new Promise`，计时器到点时调用 `resolve`。

```js
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
```

`setTimeout` 会把额外参数传给回调，这里 `resolve` 不带参数调用，所以 Promise 的值是 `undefined`。

`sleep(0)` 也要等一个计时器任务，比 `Promise.resolve()` 慢：微任务先跑完，才轮到计时器。
