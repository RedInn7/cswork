**思路**：返回一个闭包，记住原函数 `target`、`thisArg` 和预设参数，调用时把两段参数拼起来。

难点在 `new`：
- 普通调用：`target.apply(thisArg, all)`。
- `new bound(...)`：此时 `this` 是 `new` 刚创建的对象，应该用**这个对象**作为 `this` 调用原函数，忽略 `thisArg`。判断是否通过 `new` 调用可以用 `new.target`（ES2015），老写法是 `this instanceof bound`。
- 构造函数显式返回对象（或函数）时，结果是这个返回值，否则是新对象，与 `new` 的规则一致。
- 设置 `bound.prototype = Object.create(target.prototype)`，这样 `new bound()` 创建的对象原型链上有 `target.prototype`，`instanceof target` 为真，也能用原型上的方法。用 `Object.create` 而不是直接赋值 `target.prototype`，是为了以后修改 `bound.prototype` 时不影响原函数。

已经绑定过的函数再绑定，`this` 不会改变：外层调用内层时传的 `this` 会被内层忽略。原生 `bind` 也是这样。

和原生 `bind` 相比还差：`bound.name`（应为 `'bound hello'`）和 `bound.length`；原生绑定函数没有 `prototype` 属性。
