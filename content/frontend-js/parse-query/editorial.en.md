**Idea**: strip the leading `?`, split on `&`, find the **first** `=` in each piece with `indexOf('=')`, and decode both halves.

- Don't use `split('=')`: `eq=a=b` splits into three parts and loses part of the value.
- Decode in this order: replace `+` with a space **first**, **then** `decodeURIComponent`. The other way round, `%2B` (a real plus) decodes to `+` and then turns into a space.
- Repeated keys: store a string the first time, turn it into an array the second time, then keep pushing.
- Check for an existing key with `hasOwnProperty`, or keys like `constructor` and `toString` find the prototype's methods.

In real code use `new URLSearchParams(query)`: `getAll` returns repeated keys, and its `+` and percent-encoding rules match this problem.
