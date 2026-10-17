不用 `Promise.allSettled`，实现 `promiseAllSettled(iterable)`：等每一项都定下来（兑现或拒绝），再按**输入顺序**返回结果。返回的 Promise 不会拒绝。

每项结果的形状：

- 兑现：`{ status: 'fulfilled', value }`
- 拒绝：`{ status: 'rejected', reason }`

```js
await promiseAllSettled([Promise.resolve(1), Promise.reject('no'), 3]);
// [{ status: 'fulfilled', value: 1 },
//  { status: 'rejected', reason: 'no' },
//  { status: 'fulfilled', value: 3 }]
```

测试期间 `Promise.allSettled` 和 `Promise.all` 被替换成会报错的函数。
