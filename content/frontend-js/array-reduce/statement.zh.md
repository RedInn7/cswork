不用原生的 `reduce`，实现 `Array.prototype.myReduce(callback, initialValue)`，行为与 `Array.prototype.reduce` 相同：

- 依次调用 `callback(accumulator, value, index, array)`，返回值作为下一次的 `accumulator`，最后返回它；
- **传了** `initialValue`（哪怕传的是 `undefined`）就从它和第 0 项开始；**没传**就用第一个非空位的元素作初始值，从它的下一项开始；
- 空位跳过；
- 数组为空（或全是空位）又没传初始值时，抛 `TypeError`；
- `callback` 不是函数时抛 `TypeError`。

```js
[1, 2, 3].myReduce((sum, x) => sum + x);      // 6
[1, 2, 3].myReduce((sum, x) => sum + x, 10);  // 16
[].myReduce((a, b) => a + b, 'init');         // 'init'
```

测试期间原生的 `reduce` 和 `reduceRight` 被替换成会报错的函数。
