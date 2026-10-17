**思路**：下标每次前进 `size`，用 `slice(i, i + size)` 取一段。`slice` 的结束位置超过数组长度时会自动截断，所以最后不满的一组不用特殊处理。

```js
const step = Math.floor(size);
if (!(step >= 1)) return [];
for (let i = 0; i < array.length; i += step) out.push(array.slice(i, i + step));
```

- 一定要先检查 `size`。`size` 为 0 时 `i += 0` 永远不前进，会死循环。
- 写成 `!(step >= 1)`，`NaN` 也会被挡掉，因为 `NaN >= 1` 是 `false`。

时间 O(n)。常见用途：分页、把一批请求分成小批发送。
