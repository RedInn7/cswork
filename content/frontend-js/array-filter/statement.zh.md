不用原生的 `filter`，实现 `Array.prototype.myFilter(callback, thisArg)`，行为与 `Array.prototype.filter` 相同：

- 对每个元素调用 `callback(value, index, array)`，`this` 为 `thisArg`；返回真值的元素按原顺序放进**新数组**；
- 空位不调用回调，也不会出现在结果里；
- 遍历范围按开始时的长度计算；
- `callback` 不是函数时抛 `TypeError`；
- 也要能用在类数组对象上。

```js
[1, 2, 3, 4].myFilter((x) => x % 2 === 0); // [2, 4]
['a', '', 'b'].myFilter(Boolean);          // ['a', 'b']
```

测试期间原生的 `Array.prototype.filter` 被替换成会报错的函数。
