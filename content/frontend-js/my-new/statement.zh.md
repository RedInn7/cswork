不用 `new` 运算符和 `Reflect.construct`，实现 `myNew(Constructor, ...args)`，结果与 `new Constructor(...args)` 相同：

1. 创建一个新对象，它的原型是 `Constructor.prototype`；
2. 以这个对象为 `this` 调用 `Constructor(...args)`；
3. 构造函数返回的是对象（包括数组和函数）时，结果是这个返回值；否则结果是第 1 步的新对象。

只需支持普通函数形式的构造函数（`class` 必须用 `new` 调用，这里不考虑）。

```js
function Dog(name) { this.name = name; }
Dog.prototype.bark = function () { return this.name + ' says woof'; };
const d = myNew(Dog, 'Rex');
d.bark();           // 'Rex says woof'
d instanceof Dog;   // true
```
