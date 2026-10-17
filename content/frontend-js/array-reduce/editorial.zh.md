**思路**：难点在于判断「有没有传初始值」。

- 要用 `arguments.length >= 2` 判断，不能用 `initialValue === undefined`，否则显式传入的 `undefined` 会被当成没传。
- 没传初始值时，从头找第一个不是空位的元素作为初始值，从它的**下一项**开始遍历；找不到就抛 `TypeError`（与原生的报错一致）。
- 之后跳过空位，依次计算 `acc = callback(acc, source[i], i, source)`。

```js
let i = 0, acc;
if (arguments.length >= 2) acc = initialValue;
else {
  while (i < length && !(i in source)) i++;
  if (i >= length) throw new TypeError('Reduce of empty array with no initial value');
  acc = source[i++];
}
```

所以 `myReduce` 必须写成普通 `function`：箭头函数没有自己的 `arguments`，也拿不到调用它的数组 `this`。

只有一个元素且没传初始值时，回调一次也不会被调用，直接返回这个元素。
