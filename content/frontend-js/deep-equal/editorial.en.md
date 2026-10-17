**Idea**: settle the easy cases first, then compare keys recursively.

1. `a === b`: equal (the same object, or equal primitives).
2. Two numbers can now be equal only if both are `NaN`.
3. If either is not an object, or is `null`, they differ. `typeof null === 'object'`, so check `null` separately.
4. If one is an array and the other isn't, they differ.
5. `Date`s compare `getTime()`.
6. Keys: compare the counts, then check that each key of `a` exists in `b` (with `hasOwnProperty`) and that the values are deeply equal.

Comparing `b[key]` alone isn't enough: `{ a: undefined }` and `{ b: undefined }` have the same number of keys and `b.a` is `undefined`, so they would pass as equal. Check that the key exists first.

Time grows with the total size of both values. React's `shallowEqual` is this function without the recursion: it compares one level only.
