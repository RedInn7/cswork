function arrayToTree(items) {
  const nodes = new Map();
  for (const item of items) nodes.set(item.id, { ...item, children: [] });
  const roots = [];
  for (const item of items) {
    const node = nodes.get(item.id);
    const parent = item.parentId === null || item.parentId === undefined ? undefined : nodes.get(item.parentId);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
