**Idea**: turn the iterable into an array with `Array.from` and count what's left in `left`. Wrap each item in `Promise.resolve(item)`, so plain values and thenables both become Promises.

- On fulfillment, write the value at index `i`. Don't `push`, or you get finishing order.
- Each fulfillment decrements `left`; at 0, `resolve(results)`. Don't test `results.length`: `new Array(n)` has length `n` from the start.
- Any rejection goes straight to the outer `reject`. A Promise settles once, so later `resolve` or `reject` calls do nothing.
- An empty input never enters `forEach`, so resolve `[]` yourself.

It takes as long as the slowest item; O(n) extra space.
