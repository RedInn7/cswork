APIs often return a flat list where each item points at its parent with `parentId` (menus, comment threads). Implement `arrayToTree(items)` to turn it into a tree.

- Each item looks like `{ id, parentId, ...other fields }`. Items whose `parentId` is `null` or `undefined` are roots.
- Return the array of roots. Each node is a **shallow copy** of its item plus a `children` array (`[]` when it has none).
- Children and roots keep the input order. A parent may come **after** its children.
- An item whose `parentId` points at no existing item counts as a root.
- Don't change the input objects.

```js
arrayToTree([
  { id: 2, parentId: 1, name: 'child' },
  { id: 1, parentId: null, name: 'root' },
]);
// [{ id: 1, parentId: null, name: 'root',
//    children: [{ id: 2, parentId: 1, name: 'child', children: [] }] }]
```
