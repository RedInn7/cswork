test.public('builds a tree', () => {
  const tree = arrayToTree([
    { id: 1, parentId: null, name: 'Docs' },
    { id: 2, parentId: 1, name: 'Guide' },
    { id: 3, parentId: 1, name: 'API' },
    { id: 4, parentId: 2, name: 'Install' },
  ]);
  expect(tree).toEqual([
    {
      id: 1,
      parentId: null,
      name: 'Docs',
      children: [
        { id: 2, parentId: 1, name: 'Guide', children: [{ id: 4, parentId: 2, name: 'Install', children: [] }] },
        { id: 3, parentId: 1, name: 'API', children: [] },
      ],
    },
  ]);
});

test.public('a parent listed after its child', () => {
  const tree = arrayToTree([
    { id: 2, parentId: 1 },
    { id: 1, parentId: null },
  ]);
  expect(tree).toEqual([{ id: 1, parentId: null, children: [{ id: 2, parentId: 1, children: [] }] }]);
});

test('several roots keep their order', () => {
  const tree = arrayToTree([
    { id: 'b', parentId: null },
    { id: 'a' },
    { id: 'c', parentId: 'a' },
  ]);
  expect(tree.map((n) => n.id)).toEqual(['b', 'a']);
  expect(tree[1].children.map((n) => n.id)).toEqual(['c']);
});

test('an orphan becomes a root', () => {
  const tree = arrayToTree([
    { id: 1, parentId: null },
    { id: 2, parentId: 99 },
  ]);
  expect(tree.map((n) => n.id)).toEqual([1, 2]);
});

test('id 0 is a real parent', () => {
  const tree = arrayToTree([
    { id: 0, parentId: null },
    { id: 1, parentId: 0 },
  ]);
  expect(tree).toHaveLength(1);
  expect(tree[0].children[0].id).toBe(1);
});

test('leaves the input alone', () => {
  const items = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
  ];
  const tree = arrayToTree(items);
  expect(items[0]).toEqual({ id: 1, parentId: null });
  expect(tree[0]).not.toBe(items[0]);
});

test('an empty list gives no roots', () => {
  expect(arrayToTree([])).toEqual([]);
});

test('a large list stays fast', () => {
  const items = [{ id: 0, parentId: null }];
  for (let i = 1; i < 20000; i++) items.push({ id: i, parentId: i - 1 });
  const started = Date.now();
  const tree = arrayToTree(items);
  expect(tree).toHaveLength(1);
  expect(Date.now() - started < 500).toBe(true);
});
