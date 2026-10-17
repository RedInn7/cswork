不用原生的 `map`，实现 `Array.prototype.myMap(callback, thisArg)`，行为与 `Array.prototype.map` 相同：

- 对每个元素调用 `callback(value, index, array)`，`this` 为 `thisArg`，用返回值组成**新数组**；
- 原数组中的空位（hole，比如 `[1, , 3]` 的第 2 项）不调用回调，新数组同一位置也是空位；
- 遍历范围按开始时的长度计算：回调里往数组追加的元素不会被访问；
- `callback` 不是函数时抛 `TypeError`；
- 也要能用在类数组对象上：`Array.prototype.myMap.call({ length: 2, 0: 'a', 1: 'b' }, f)`。

```js
[1, 2, 3].myMap((x) => x * 2);   // [2, 4, 6]
[1, , 3].myMap((x) => x * 2);    // [2, , 6]
```

测试期间原生的 `Array.prototype.map` 被替换成会报错的函数。
