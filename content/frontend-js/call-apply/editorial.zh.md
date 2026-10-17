**思路**：利用「`obj.method()` 调用时，`this` 就是 `obj`」这条规则：把函数临时放到 `thisArg` 上，作为它的方法调用，调用完再删掉。

```js
const target = thisArg == null ? globalThis : Object(thisArg);
const key = Symbol('myCall');
Object.defineProperty(target, key, { value: this, configurable: true });
try {
  return target[key](...args);
} finally {
  delete target[key];
}
```

- 用 `Symbol` 做临时键，不会覆盖对象上已有的同名属性（比如 `fn`），`Object.keys` 也看不到它。
- 用 `defineProperty` 定义的属性默认不可枚举，调用过程中 `this` 上也不会多出可枚举的键。
- 删除写在 `finally` 里，函数抛错时也能清理干净。
- `Object(thisArg)` 把原始值包装成对象，`null` 和 `undefined` 换成 `globalThis`。
- `myApply` 把参数转成数组后交给 `myCall`。

**局限**：如果 `thisArg` 被冻结（`Object.freeze`），就加不上临时属性，而原生的 `call` 仍然可以调用。严格模式函数收到的 `this` 不会被包装或替换，这个写法也模拟不出来。这些差别值得在面试中主动提到。
