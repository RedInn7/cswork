实现 `deepClone(value)`：返回 `value` 的深拷贝，改动拷贝不会影响原值，反过来也一样。

需要处理：
- 原始值（数字、字符串、`null`、`undefined` 等）原样返回；函数也原样返回，不拷贝；
- 数组和普通对象逐层拷贝；
- `Date`、`RegExp`、`Map`、`Set` 拷贝成同类型的新对象（`Map` 和 `Set` 里的内容也要深拷贝）；
- **循环引用**：`a.self = a` 拷贝后 `copy.self === copy`；
- **共享引用**：原值里两处指向同一个对象，拷贝里这两处也指向同一个（新）对象；
- 保留原型：类实例拷贝后仍是同一个类的实例。

只需要拷贝自身可枚举的字符串键属性。不能用 `structuredClone`（测试期间它被替换成会报错的函数）。

```js
const a = { list: [1, { x: 2 }], when: new Date(0) };
a.self = a;
const b = deepClone(a);
b.list[1].x = 99;      // a.list[1].x 仍是 2
b.self === b;          // true
```
