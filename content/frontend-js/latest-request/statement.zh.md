搜索框每输入一个字就发一次请求，旧请求可能比新请求**晚**回来，把新结果覆盖掉。

实现 `latest(request)`：`request` 是返回 Promise 的函数（测试里是桩函数，不发真实请求）。返回一个包装函数 `run(...args)`：

- 每次调用 `run` 都立即调用 `request(...args)`（`this` 也照传），并返回一个新的 Promise。
- 有新的调用时，上一次还没定下来的 Promise **立即拒绝**，错误的 `message` 为 `'cancelled'`；它的请求之后返回什么结果都被忽略。
- 最新一次调用的 Promise 跟随它自己的请求：兑现或拒绝。
- `run.cancel()`：取消当前还没定下来的那次调用（同样以 `'cancelled'` 拒绝）。

```js
const search = latest((q) => api(`/search?q=${q}`));
search('re').catch((e) => console.log(e.message)); // 'cancelled'
search('react').then(show);                          // 只显示 react 的结果
```
