Implement `deepClone(value)`: return a deep copy of `value`, so changing the copy never changes the original, and the other way round.

Handle:
- primitives (numbers, strings, `null`, `undefined`, ...) returned as they are; functions returned as they are, not copied;
- arrays and plain objects copied level by level;
- `Date`, `RegExp`, `Map` and `Set` copied as new objects of the same type (with `Map` and `Set` contents deep-copied);
- **cycles**: after `a.self = a`, the copy has `copy.self === copy`;
- **shared references**: two places pointing at one object in the original point at one (new) object in the copy;
- prototypes: a class instance's copy is an instance of the same class.

Copy own enumerable string-keyed properties only. `structuredClone` is off limits (it is replaced by a function that throws during the tests).

```js
const a = { list: [1, { x: 2 }], when: new Date(0) };
a.self = a;
const b = deepClone(a);
b.list[1].x = 99;      // a.list[1].x is still 2
b.self === b;          // true
```
