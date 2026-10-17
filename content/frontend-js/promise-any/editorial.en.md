**Idea**: `Promise.any` mirrors `Promise.all`.
- `all`: one rejection rejects it; it fulfills only when all fulfill.
- `any`: one fulfillment fulfills it; it rejects only when all reject.

Hand `resolve` straight to every item, so the first fulfillment wins. On a rejection, store the reason at its index; when the count reaches 0, reject with `new AggregateError(errors, message)`.

- Keep the reasons in **input order**, not in the order they rejected.
- An empty input has nothing that could fulfill, so it rejects at once, unlike `Promise.race`, which waits forever.

Use it for mirrors: take whichever source answers successfully first.
