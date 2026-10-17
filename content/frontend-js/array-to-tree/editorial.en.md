**Idea**: two passes and a `Map`, O(n) overall.

1. First pass: build every node as `{ ...item, children: [] }` and store it in a `Map` by `id`.
2. Second pass, in input order: look up the node for `parentId`. If found, push into its `children`; if not (a root or an orphan), push into `roots`.

Every node exists after the first pass, so a parent listed later is fine, and attaching in input order keeps every level in input order.

- `{ ...item }` copies the item before adding `children`, so the input stays as it was.
- Test for roots with `parentId === null || parentId === undefined`, not `!parentId`, or a parent with id `0` is ignored.

**Common bugs**: finding each node's children with `filter`, which is O(n²) and slow with tens of thousands of rows; building recursively, which can overflow the stack on a very deep chain (the last test).
