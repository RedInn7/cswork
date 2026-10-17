**思路**：JS 的 `Map` 按**插入顺序**遍历，正好可以当作「从最久没用到最近使用」的队列：

- 「使用」一个键：先 `delete` 再 `set`，它就移到了最后（最近使用）；
- 淘汰：`map.keys().next().value` 拿到第一个键，也就是最久没用的那个，删掉它。

```js
put(key, value) {
  this.#entries.delete(key);
  this.#entries.set(key, value);
  if (this.#entries.size > this.#capacity) this.#entries.delete(this.#entries.keys().next().value);
}
```

`Map` 的 `has`、`get`、`set`、`delete` 平均都是 O(1)，所以 `get` 和 `put` 也是 O(1)。

- `get` 判断键是否存在要用 `has`，不能看取到的值，否则存进去的 `0`、`false` 会被当成不存在。
- 不能用普通对象代替 `Map`：普通对象的键只能是字符串，而且整数键会按数字大小排在前面，不保持插入顺序。

在不保证插入顺序的语言里（或者面试官要求不用 `Map` 的顺序），标准做法是**哈希表 + 双向链表**：哈希表从键找到链表节点，链表维护使用顺序，移动和删除节点都是 O(1)。
