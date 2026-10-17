**思路**：遍历一次，算出每个元素的键（转成字符串），没有这一组就先建空数组，再 `push`。

- `iteratee` 是字符串时，转成取属性的函数；函数还会收到下标。
- 判断「这一组是否已经存在」要用 `hasOwnProperty`，不能写 `if (!groups[key])`。键可能叫 `toString`、`constructor`：普通对象从原型上继承了这些方法，`groups['toString']` 拿到的是函数，`push` 就会报错。
- 另一种做法是用 `Object.create(null)` 建一个没有原型的对象，原生的 `Object.groupBy` 就是这样做的。

时间 O(n)。需要非字符串的键（比如对象）时，改成用 `Map` 分组。
