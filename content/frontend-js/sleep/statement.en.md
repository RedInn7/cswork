Implement `sleep(ms)`: return a Promise that fulfills (with `undefined`) after `ms` milliseconds.

```js
async function demo() {
  console.log('start');
  await sleep(500);
  console.log('500 ms later');
}
```

The tests use a fake clock and check that the Promise does not fulfill before `ms` ms.
