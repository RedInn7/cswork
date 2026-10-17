Implement an LRU (least recently used) cache, `class LRUCache`, with a `Map`:

- `new LRUCache(capacity)`: the capacity is at least 1.
- `get(key)`: return the value and mark the key as **most recently used**; `undefined` if the key is missing.
- `put(key, value)`: insert or update, and mark as most recently used. If that puts the cache over capacity, remove the **least recently used** entry.
- `size`: a read-only property, the number of entries.
- `keys()`: an array of all keys, from least to most recently used.

`get` and `put` must be O(1) on average.

```js
const cache = new LRUCache(2);
cache.put('a', 1);
cache.put('b', 2);
cache.get('a');      // 1; a is now the most recent
cache.put('c', 3);   // over capacity: drop b, the least recent
cache.keys();        // ['a', 'c']
```
