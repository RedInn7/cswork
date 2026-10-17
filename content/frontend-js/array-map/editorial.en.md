**Idea**: follow the spec's steps:

1. If `callback` isn't a function, throw a `TypeError`.
2. `source = Object(this)` and `length = source.length >>> 0`, read once **at the start**, so changes to the length inside the callback don't change the range.
3. `result = new Array(length)`. Only where `i in source` is true, call `callback.call(thisArg, source[i], i, source)` and store the result; holes are skipped and stay holes in the result.

- `result.push(...)` loses the holes: `[1, , 3]` would become `[2, 6]`.
- Detect holes with `i in source`, not `source[i] === undefined`: index 0 of `[undefined]` is not a hole and must get a call.
- `>>> 0` turns the length into a non-negative integer; a missing or odd `length` on an array-like becomes 0.

**Adding to the prototype**: a plain `Array.prototype.myMap = …` creates an **enumerable** property, so every later `for...in` over an array visits `myMap`. Define it with `Object.defineProperty` instead; `enumerable` defaults to `false`, like the built-ins.
