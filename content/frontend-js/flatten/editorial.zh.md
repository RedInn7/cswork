**思路**：递归，每进一层深度减一。

```js
function flatten(array, depth = 1) {
  const out = [];
  for (const item of array) {
    if (Array.isArray(item) && depth > 0) out.push(...flatten(item, depth - 1));
    else out.push(item);
  }
  return out;
}
```

- 用 `Array.isArray` 判断是不是数组，字符串和类数组对象不会被拆开。
- `Infinity - 1` 还是 `Infinity`，所以完全展开不需要特殊处理。
- 非常深的嵌套会让递归栈溢出，可以改用显式栈：从后往前把元素和它剩下的深度压栈，弹出时按需展开。
- 子数组很大时，`push(...items)` 也可能超出参数个数上限，改成逐个 `push` 即可。

也可以用 `reduce` 写：`array.reduce((acc, x) => acc.concat(Array.isArray(x) && depth > 0 ? flatten(x, depth - 1) : [x]), [])`。注意 `concat` 每次都会复制数组，是 O(n²)。
