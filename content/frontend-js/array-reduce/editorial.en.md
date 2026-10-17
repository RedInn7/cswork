**Idea**: the hard part is telling whether an initial value was passed.

- Use `arguments.length >= 2`, not `initialValue === undefined`, or an explicitly passed `undefined` counts as missing.
- With no initial value, scan for the first element that isn't a hole; it becomes the accumulator and the walk starts at the **next** index. If there is none, throw a `TypeError` (as the built-in does).
- Then skip holes and compute `acc = callback(acc, source[i], i, source)` in order.

```js
let i = 0, acc;
if (arguments.length >= 2) acc = initialValue;
else {
  while (i < length && !(i in source)) i++;
  if (i >= length) throw new TypeError('Reduce of empty array with no initial value');
  acc = source[i++];
}
```

This is why `myReduce` must be a plain `function`: an arrow function has no `arguments` of its own and no `this` for the array it was called on.

With a single element and no initial value, the callback never runs; that element is returned.
