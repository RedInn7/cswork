**Idea**: a recursive `write(key, value)` that returns the JSON text for a value, or `undefined` when it should be skipped. The caller decides what skipping means:

- in an object: an `undefined` result leaves the property out;
- in an array: an `undefined` result becomes `null` (`write(...) ?? 'null'`);
- at the top: return `undefined` as it is.

Details:
1. Check `toJSON` first and carry on with what it returns; that's how a `Date` becomes a string.
2. Test numbers with `Number.isFinite`: `NaN` and `±Infinity` become `null`. `String(-0)` is `'0'`, as in the built-in.
3. Escape strings with one regex, `/["\\\u0000-\u001f]/g`: short forms where they exist, `\u00xx` otherwise.
4. Detect cycles with a stack of the **current path**: push when entering an object, pop when leaving. Only an object already on the current path is a cycle; the same object in two branches is not (the last test). A "seen" set that only grows would report false cycles.

The built-in also handles `replacer`, `space`, boxed primitives (`new Number(1)`) and escaping lone surrogates.
