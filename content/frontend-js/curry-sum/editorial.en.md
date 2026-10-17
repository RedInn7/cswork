**Idea**: pass the running total down as an argument and return a **new** function each time:

```js
function sum(a) {
  return (b) => (b === undefined ? a : sum(a + b));
}
```

- With no argument, return `a`; with one, recurse with `sum(a + b)` to get a function that remembers the new total.
- Don't keep the total in an outer variable or a function property you keep updating. `s(3)` would then change `s` as well, and reuse breaks.
- Test `b === undefined`, not `!b`, or `sum(1)(0)` counts as the end.

A variant asks for `sum(1)(2)(3) == 6` with no final call, using type coercion (`valueOf` / `Symbol.toPrimitive`). In an interview it helps to explain how the two versions differ.
