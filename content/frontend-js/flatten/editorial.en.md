**Idea**: recurse, one level less each time.

```js
function flatten(array, depth = 1) {
  const out = [];
  for (const item of array) {
    if (Array.isArray(item) && depth > 0) out.push(...flatten(item, depth - 1));
    else out.push(item);
  }
  return out;
}
```

- `Array.isArray` decides what counts as an array, so strings and array-likes stay whole.
- `Infinity - 1` is still `Infinity`, so full flattening needs no special case.
- Very deep nesting can overflow the stack; use an explicit stack instead, pushing items with their remaining depth from the back and expanding them as they pop.
- A very large child array can also exceed the argument limit of `push(...items)`; push one at a time instead.

A `reduce` version works too: `array.reduce((acc, x) => acc.concat(Array.isArray(x) && depth > 0 ? flatten(x, depth - 1) : [x]), [])`. But `concat` copies the array every time, so it's O(n²).
