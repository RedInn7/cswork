**Idea**: a `Map` from event name to an array of listeners.

- `on`: get (or create) the array, `push`, `return this`.
- `once`: wrap the listener in a `wrapper` that first `off`s itself and then calls the original, and remember the original on `wrapper.original`, so `off(name, original)` recognizes it too.
- `off`: search **from the end** for the first match (`=== listener` or `.original === listener`) and `splice` out that one only. `filter` would remove every duplicate registration.
- `emit`: copy the array (`[...list]`) before looping. Listeners that add or remove listeners change the original array, not the copy, so nothing gets skipped by shifting indexes.

The once wrapper must **remove itself before calling the original**: if the original emits the same event again, it's already off the list and can't recurse forever (the third-to-last test).

The `#listeners` private field keeps outside code away from the internal state. Node's `EventEmitter` also special-cases the `error` event and warns when too many listeners pile up.
