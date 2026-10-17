**Idea**: a recursive `add(arg)` that branches on type and collects names in an array, joined with `' '` at the end.

- `if (!arg) return;` rules out `null`, `undefined`, `''`, `0` and `false` in one line.
- A string or number: add it as a string.
- An array: call `add` on each item.
- A plain object: walk `Object.keys` and add the keys with truthy values.
- Anything else (`true`, functions, `Symbol`s): nothing.

Collecting first and joining once is simpler than deciding about spaces while concatenating, and leaves no stray spaces at either end.

The real `classnames` package also honors an object's own `toString` (CSS Modules class objects, for instance); mentioning it is enough in an interview.
