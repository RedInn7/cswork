**思路**：递归拷贝，再用一个 `Map` 记录「原对象 → 拷贝」，同时解决两个问题：
- 循环引用：递归回到见过的对象，直接返回它的拷贝，不会无限递归；
- 共享引用：同一个对象只拷贝一次，后面再遇到都用同一份拷贝。

关键在于**先登记，再递归**：创建空的拷贝后，马上 `seen.set(value, copy)`，再去拷贝子属性。顺序反过来的话，`a.self = a` 递归进去时还查不到 `a`，就会栈溢出。

- `Date` 用时间戳新建；`RegExp` 用 `source` 和 `flags` 新建。
- `Map`、`Set` 新建空容器，逐项递归拷贝。
- 普通对象用 `Object.create(Object.getPrototypeOf(value))`，保留原型。
- 函数不拷贝，直接返回引用。

**`JSON.parse(JSON.stringify(x))` 的问题**：遇到循环引用直接报错；`Date` 变成字符串；`Map`、`Set` 变成 `{}`；`undefined` 和函数被丢掉；原型也没了。

浏览器和 Node 现在都有 `structuredClone`，能处理循环引用和大多数内置类型，但不保留类的原型，也不能拷贝函数。
