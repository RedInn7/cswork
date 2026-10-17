Without `JSON.stringify`, implement `stringify(value)` so that for the inputs below it outputs exactly what `JSON.stringify(value)` does (no indentation or replacer argument):

- `null`, `true`, `false`;
- numbers: finite numbers as usual; `NaN` and `±Infinity` become `null`;
- strings: in double quotes; a backslash before `"` and `\`; the short forms `\b \f \n \r \t`; other control characters below `0x20` as `\u00xx` (lowercase hex);
- arrays: elements separated by `,` with no spaces; `undefined`, functions and `Symbol`s become `null`;
- plain objects: `"key":value` in `Object.keys` order; properties whose value is `undefined`, a function or a `Symbol` are left out;
- a value with a `toJSON` method (a `Date`, say): call `toJSON(key)` and serialize what it returns; `key` is the property name, the index as a string inside arrays, and `''` at the top level;
- a top-level `undefined`, function or `Symbol` returns `undefined`;
- throw a `TypeError` on a cycle or a `BigInt`.

```js
stringify({ a: [1, 'x', null, undefined], b: undefined, c: new Date(0) });
// '{"a":[1,"x",null,null],"c":"1970-01-01T00:00:00.000Z"}'
```

During the tests `JSON.stringify` is replaced by a function that throws (the tests work out the expected strings with the built-in first).
