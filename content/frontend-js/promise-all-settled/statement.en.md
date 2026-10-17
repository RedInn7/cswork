Without `Promise.allSettled`, implement `promiseAllSettled(iterable)`: wait until every item settles (fulfills or rejects), then fulfill with the results in **input order**. The returned Promise never rejects.

Each result looks like:

- fulfilled: `{ status: 'fulfilled', value }`
- rejected: `{ status: 'rejected', reason }`

```js
await promiseAllSettled([Promise.resolve(1), Promise.reject('no'), 3]);
// [{ status: 'fulfilled', value: 1 },
//  { status: 'rejected', reason: 'no' },
//  { status: 'fulfilled', value: 3 }]
```

During the tests `Promise.allSettled` and `Promise.all` are replaced by functions that throw.
