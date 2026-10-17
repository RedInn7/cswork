**Idea**: return a closure that remembers `target`, `thisArg` and the preset arguments, and joins the two argument lists on each call.

The hard part is `new`:
- A plain call: `target.apply(thisArg, all)`.
- `new bound(...)`: here `this` is the object `new` just created. Call the original with **that object** as `this`, ignoring `thisArg`. Detect `new` with `new.target` (ES2015); the older way is `this instanceof bound`.
- If the constructor returns an object (or a function), that is the result; otherwise the new object is, following the rules of `new`.
- Set `bound.prototype = Object.create(target.prototype)`, so objects made by `new bound()` have `target.prototype` on their chain: `instanceof target` holds and prototype methods work. `Object.create` instead of sharing `target.prototype` keeps later changes to `bound.prototype` from touching the original.

Binding an already-bound function again doesn't change `this`: the inner function ignores the `this` the outer one passes. The built-in `bind` behaves the same.

Still missing compared with the built-in: `bound.name` (should be `'bound hello'`) and `bound.length`; built-in bound functions also have no `prototype` property.
