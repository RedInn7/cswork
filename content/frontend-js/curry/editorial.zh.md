**思路**：写一个能递归调用自己的收集函数 `collect(...args)`：
- 参数够了（`args.length >= func.length`）就调用 `func`；
- 不够就返回一个新函数，把新参数接在旧参数后面，再交给 `collect` 判断。

```js
function curry(func) {
  return function collect(...args) {
    if (args.length >= func.length) return func.apply(this, args);
    return (...more) => collect.apply(this, [...args, ...more]);
  };
}
```

- 每次都用 `[...args, ...more]` 生成**新数组**。如果往一个共享数组里 `push`，`plus10` 这类部分应用函数用过一次就被改坏了。
- `func.length` 不计算带默认值的参数和剩余参数：`(a, b = 1) => …` 的 `length` 是 1。

扩展：lodash 的 `curry` 还支持占位符 `_`，可以先固定后面的参数。
