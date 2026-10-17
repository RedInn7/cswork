实现 `sleep(ms)`：返回一个 Promise，`ms` 毫秒后兑现（值为 `undefined`）。

```js
async function demo() {
  console.log('start');
  await sleep(500);
  console.log('500 ms later');
}
```

测试用假时钟，会检查 Promise 不早于 `ms` 毫秒兑现。
