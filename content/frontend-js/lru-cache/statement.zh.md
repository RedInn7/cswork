用 `Map` 实现一个 LRU（最近最少使用）缓存 `class LRUCache`：

- `new LRUCache(capacity)`：容量至少为 1。
- `get(key)`：键存在时返回值，并把它标记为**最近使用**；不存在时返回 `undefined`。
- `put(key, value)`：写入或更新值，并标记为最近使用。写入后数量超过容量时，删除**最久没有使用**的那一项。
- `size`：只读属性，当前的项数。
- `keys()`：返回所有键组成的数组，按从最久没用到最近使用的顺序排列。

`get` 和 `put` 都要求平均 O(1)。

```js
const cache = new LRUCache(2);
cache.put('a', 1);
cache.put('b', 2);
cache.get('a');      // 1，a 变成最近使用
cache.put('c', 3);   // 超出容量，删除最久没用的 b
cache.keys();        // ['a', 'c']
```
