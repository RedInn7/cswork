**Idea**: shaped like `myMap`, except the results are collected with `push`. A filtered array is always packed: holes never reach it.

1. Check that `callback` is a function.
2. Read the length once at the start: `length = Object(this).length >>> 0`.
3. Skip holes (`!(i in source)`); read `value` first, call the callback, and `push(value)` when it returns a truthy value.

**Why read `value` first**: the callback may change the array. The spec puts into the result the value read **before** the callback ran.

These polyfill problems all test the same few details: walking the length fixed at the start, skipping holes, `thisArg`, and checking the argument. Get one right and the rest follow.
