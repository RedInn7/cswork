**Idea**: turn the path into an array of keys, then walk down one level at a time.

1. A string path: replace `[0]` with `.0`, split on `.`, and drop empty strings. `'a[0].b'` becomes `['a', '0', 'b']`.
2. Before each step, check whether the current value is `null` or `undefined`; if so, return the default instead of throwing `Cannot read properties of undefined`.
3. After the walk, use the default only when the value is `undefined`. `current || defaultValue` would replace `0`, `''`, `false` and `null` too.

`'0'` and `0` work the same as property names; array indexes are string keys anyway.

Modern JS has `obj?.user?.tags?.[0]?.name ?? 'N/A'`. `get` is for paths only known at run time, such as form configs or table column definitions.
