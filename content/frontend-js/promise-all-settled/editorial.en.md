**Idea**: count like `Promise.all`, except a rejection also finishes an item. Both callbacks write into the same index and decrement the counter.

- Each result has only its own keys: `status` and `value` when fulfilled, `status` and `reason` when rejected.
- The outer Promise only needs `resolve`: the second `then` callback already catches every item's rejection.
- Handle the empty input on its own.

Use it for batches where each failure is shown on its own: one failed request doesn't lose the others' results.
