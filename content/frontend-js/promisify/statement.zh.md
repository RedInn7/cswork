很多老接口用「错误优先」的回调：最后一个参数是回调 `callback(error, value)`，出错时 `error` 有值，成功时 `error` 为 `null`。

实现 `promisify(original)`：返回一个新函数，参数和原函数相同，只是不再传回调，而是返回一个 Promise：

- 回调收到的 `error` 为真值时拒绝，原因就是这个 `error`；
- 否则以 `value` 兑现；
- 调用时的 `this` 要原样传给 `original`。

```js
function readConfig(name, callback) {
  setTimeout(() => callback(null, { name, debug: true }), 10);
}
const readConfigAsync = promisify(readConfig);
await readConfigAsync('app'); // { name: 'app', debug: true }
```
