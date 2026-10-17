**Idea**: one timer stands for "the burst is still going". Every call clears the old timer and sets a new one, so the callback fires only after `wait` quiet milliseconds.

- `timer === null` means this is the first call of a burst. With `leading`, run it now and do **not** keep it as pending; otherwise a single call would run again at the end.
- Every other call stores its `this` and arguments in `pending`; the trailing edge uses only the last one.
- When the timer fires, set `timer` back to `null` first, so the next call counts as the start of a new burst.
- `cancel()` clears the timer and `pending`.

**Common bugs**: using the first call's arguments at the end; losing `this` by calling through an arrow function; running a single call twice when both edges are on.

O(1) per call, and only one pending call is kept.
