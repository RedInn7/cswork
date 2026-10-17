**思路**：`instanceof` 检查的是 `Constructor.prototype` 是否出现在 `value` 的原型链上，和 `value` 由哪个构造函数创建无关。

```js
for (let proto = Object.getPrototypeOf(value); proto !== null; proto = Object.getPrototypeOf(proto)) {
  if (proto === target) return true;
}
return false;
```

- 先处理边界，顺序和原生一致：右侧不是函数时抛 `TypeError`；左侧是原始值时返回 `false`；之后才读 `prototype`，它不是对象时再抛 `TypeError`。所以 `1 instanceof (() => {})` 是 `false`，不会报错。注意 `typeof null === 'object'`。
- 用 `Object.getPrototypeOf`，不要用 `__proto__`：`Object.create(null)` 创建的对象上没有 `__proto__` 访问器。

最后一个测试说明了 `instanceof` 的「动态」：实例创建后再给构造函数换 `prototype`，原来的实例就不再是它的 instance 了。

`Symbol.hasInstance` 可以自定义 `instanceof` 的行为，原生的 `instanceof` 会先检查它，再走原型链。
