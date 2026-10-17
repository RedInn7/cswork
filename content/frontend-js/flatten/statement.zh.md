实现 `flatten(array, depth = 1)`：把嵌套数组展开 `depth` 层，返回新数组，不改动原数组。

- `depth` 为 `0` 时返回浅拷贝；为 `Infinity` 时完全展开。
- 只展开数组，其他值（包括字符串和类数组对象）原样保留。

```js
flatten([1, [2, [3, [4]]]]);            // [1, 2, [3, [4]]]
flatten([1, [2, [3, [4]]]], 2);         // [1, 2, 3, [4]]
flatten([1, [2, [3, [4]]]], Infinity);  // [1, 2, 3, 4]
```

测试期间 `Array.prototype.flat` 和 `flatMap` 被替换成会报错的函数。
