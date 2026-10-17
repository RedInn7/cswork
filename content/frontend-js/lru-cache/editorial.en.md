**Idea**: a JS `Map` iterates in **insertion order**, which is exactly a queue from least to most recently used:

- "using" a key: `delete` it and `set` it again, which moves it to the end (most recent);
- evicting: `map.keys().next().value` is the first key, the least recently used one; delete it.

```js
put(key, value) {
  this.#entries.delete(key);
  this.#entries.set(key, value);
  if (this.#entries.size > this.#capacity) this.#entries.delete(this.#entries.keys().next().value);
}
```

`Map`'s `has`, `get`, `set` and `delete` are O(1) on average, so `get` and `put` are too.

- In `get`, check `has` rather than the value you read, or stored `0` and `false` look missing.
- A plain object can't stand in for the `Map`: its keys are strings only, and integer keys are ordered numerically first instead of by insertion.

In languages without an ordered map (or when the interviewer rules out relying on `Map` order), the standard design is a **hash map plus a doubly linked list**: the map finds a key's node, the list keeps the usage order, and moving or removing a node is O(1).
