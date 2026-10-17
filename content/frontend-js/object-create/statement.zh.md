不用 `Object.create`，实现 `objectCreate(proto, properties)`：

- 返回一个新对象，它的原型是 `proto`；
- `proto` 为 `null` 时，新对象没有原型；
- `proto` 既不是对象也不是 `null` 时（包括 `undefined`），抛 `TypeError`；
- 传了 `properties` 时，按属性描述符定义到新对象上（与 `Object.defineProperties` 相同）。

```js
const animal = { speak() { return `${this.name} makes a sound`; } };
const dog = objectCreate(animal);
dog.name = 'Rex';
dog.speak();  // 'Rex makes a sound'

const bare = objectCreate(null);
'toString' in bare; // false
```

测试期间 `Object.create` 被替换成会报错的函数。
