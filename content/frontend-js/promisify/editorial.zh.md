**思路**：返回的函数里 `new Promise`，在调用者的参数后面追加一个回调，再调用原函数。回调里有错误就 `reject`，否则 `resolve`。

- 返回值要写成普通的 `function`，不能写箭头函数，这样才能拿到调用时的 `this`，再用 `original.call(this, ...args, callback)` 传下去。Promise 执行器里的箭头函数沿用的就是这个 `this`。
- 判断失败要看 `error` 是否为真值，不能看 `value`：`value` 可能本来就是 `0` 或 `''`。

Node 自带 `util.promisify`，还支持自定义的 `util.promisify.custom`，原理相同。
