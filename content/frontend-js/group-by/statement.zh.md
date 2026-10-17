实现 `groupBy(array, iteratee)`：按 `iteratee` 算出的键分组，返回一个对象：键对应「这个键的所有元素组成的数组」。

- `iteratee` 可以是函数（接收元素和下标，返回键），也可以是字符串（取元素的这个属性）。
- 键会被转成字符串（和普通对象的属性名一样）。
- 每组内保持原来的顺序；各组的键按第一次出现的顺序排列。

```js
groupBy([6.1, 4.2, 6.3], Math.floor);   // { 6: [6.1, 6.3], 4: [4.2] }
groupBy(['one', 'two', 'three'], 'length');
// { 3: ['one', 'two'], 5: ['three'] }
```

测试期间 `Object.groupBy` 和 `Map.groupBy` 被替换成会报错的函数。
