Without the `new` operator or `Reflect.construct`, implement `myNew(Constructor, ...args)` with the same result as `new Constructor(...args)`:

1. create a new object whose prototype is `Constructor.prototype`;
2. call `Constructor(...args)` with that object as `this`;
3. if the constructor returns an object (arrays and functions included), that is the result; otherwise the result is the object from step 1.

Only plain function constructors need to work (a `class` can only be called with `new`, so it's out of scope).

```js
function Dog(name) { this.name = name; }
Dog.prototype.bark = function () { return this.name + ' says woof'; };
const d = myNew(Dog, 'Rex');
d.bark();           // 'Rex says woof'
d instanceof Dog;   // true
```
