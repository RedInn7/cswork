**Idea**: move the index forward by `size` and take each piece with `slice(i, i + size)`. `slice` stops at the end of the array by itself, so the short last chunk needs no special case.

```js
const step = Math.floor(size);
if (!(step >= 1)) return [];
for (let i = 0; i < array.length; i += step) out.push(array.slice(i, i + step));
```

- Check `size` first. With a size of 0, `i += 0` never moves and the loop never ends.
- `!(step >= 1)` also stops `NaN`, since `NaN >= 1` is `false`.

O(n) time. Typical uses: pagination, sending a large batch of requests in smaller groups.
