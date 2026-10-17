**思路**：用 `Map` 存「键 → 结果」，挂在返回的函数上（`memoized.cache`），这样每个记忆化函数有自己的缓存，外部也能清空。

- 判断有没有缓存要用 `cache.has(key)`，不能用 `cache.get(key) !== undefined`，否则结果为 `undefined` 时每次都会重新计算。
- `Map` 的键按 SameValueZero 比较：对象按引用比较，`NaN` 等于 `NaN`。用普通对象 `{}` 做缓存会把键转成字符串，`1` 和 `'1'`、所有对象（`'[object Object]'`）都会撞在一起。
- 多参数时，默认只用第一个参数做键，这是 lodash 的约定。要按全部参数缓存就传 `resolver`，比如 `(...a) => JSON.stringify(a)`。

**注意**：缓存会一直增长。长期运行时要设上限（参考 LRU 题），或者用 `WeakMap` 以对象为键，让对象可以被回收。
