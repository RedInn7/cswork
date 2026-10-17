不用 `JSON.stringify`，实现 `stringify(value)`，对下面这些输入，输出与 `JSON.stringify(value)` 完全一致（不需要缩进和 replacer 参数）：

- `null`、`true`、`false`；
- 数字：有限数字照常输出，`NaN` 和 `±Infinity` 输出 `null`；
- 字符串：加双引号；`"` 和 `\` 前加反斜杠；`\b \f \n \r \t` 用简写；其他小于 `0x20` 的控制字符写成 `\u00xx`（小写十六进制）；
- 数组：元素之间用 `,`，不加空格；值为 `undefined`、函数、`Symbol` 的元素输出 `null`；
- 普通对象：按 `Object.keys` 的顺序输出 `"键":值`；值为 `undefined`、函数、`Symbol` 的属性跳过；
- 带 `toJSON` 方法的值（比如 `Date`）先调用 `toJSON(key)`，再序列化它的返回值；`key` 是属性名，数组中是下标字符串，最外层是 `''`；
- 最外层的值是 `undefined`、函数或 `Symbol` 时返回 `undefined`；
- 遇到循环引用或 `BigInt` 时抛 `TypeError`。

```js
stringify({ a: [1, 'x', null, undefined], b: undefined, c: new Date(0) });
// '{"a":[1,"x",null,null],"c":"1970-01-01T00:00:00.000Z"}'
```

测试期间 `JSON.stringify` 被替换成会报错的函数（测试会先用原生的算好期望值）。
