不用 `Promise.race`，实现 `promiseRace(iterable)`：返回一个 Promise，跟随**最先定下来**的那一项：它兑现就兑现，它拒绝就拒绝。

- 元素可以是普通值，按已兑现处理。
- 空输入时，返回的 Promise 永远保持等待（与原生行为一致）。

```js
const later = (value, ms) => new Promise((r) => setTimeout(() => r(value), ms));
await promiseRace([later('slow', 50), later('fast', 10)]); // 'fast'
```

常见用法是给请求加超时：让请求和一个到点就拒绝的 Promise 赛跑。

测试期间 `Promise.race` 被替换成会报错的函数。
