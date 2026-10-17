Without `Promise.any`, implement `promiseAny(iterable)`:

- Fulfill with the **first fulfilled** value; rejections are skipped for now.
- If every item rejects, reject with an `AggregateError` whose `errors` are all the reasons in **input order**.
- An empty input rejects at once with an `AggregateError` (`errors` is `[]`).
- Items may be plain values, treated as fulfilled.

```js
await promiseAny([Promise.reject('a'), later('b', 20), later('c', 10)]); // 'c'
```

Create the error with `new AggregateError(errors, message)`. During the tests `Promise.any` is replaced by a function that throws.
