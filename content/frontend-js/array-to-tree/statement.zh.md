后端经常返回扁平的列表，每项用 `parentId` 指向父节点，比如菜单和评论。实现 `arrayToTree(items)`，把它变成树。

- 每项形如 `{ id, parentId, ...其他字段 }`。`parentId` 为 `null` 或 `undefined` 的是根节点。
- 输出是根节点数组。每个节点是原项的**浅拷贝**，再加上 `children` 数组（没有子节点时是 `[]`）。
- 子节点和根节点都保持输入中的顺序。父节点可能排在子节点**后面**。
- `parentId` 指向不存在的节点时，把它当作根节点。
- 不要改动输入的对象。

```js
arrayToTree([
  { id: 2, parentId: 1, name: 'child' },
  { id: 1, parentId: null, name: 'root' },
]);
// [{ id: 1, parentId: null, name: 'root',
//    children: [{ id: 2, parentId: 1, name: 'child', children: [] }] }]
```
