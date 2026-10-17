**思路**：把 `new` 做的三件事逐一写出来：

```js
const instance = Object.create(Constructor.prototype);       // 1. 建对象，接上原型
const result = Constructor.apply(instance, args);            // 2. 以它为 this 执行
return result !== null && (typeof result === 'object' || typeof result === 'function')
  ? result : instance;                                       // 3. 决定返回谁
```

- 第 3 步要注意 `typeof null === 'object'`，`return null` 应该被忽略，所以要单独排除。
- 返回函数也算「返回了对象」。
- `Constructor.prototype` 被设成非对象时，原生 `new` 会退回 `Object.prototype`，参考实现也照此处理。

**`class` 为什么不行**：类构造函数内部会检查自己是否通过 `new` 调用，`Constructor.apply(...)` 会直接抛 `TypeError`。要支持类只能用 `Reflect.construct(Constructor, args)`，它本身就是 `new` 的函数形式。
