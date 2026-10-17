Implement `sum(a)` for chained addition: each call passes one number, and a final call **with no argument** returns the total.

```js
sum(1)(2)(3)();   // 6
sum(5)();         // 5
const s = sum(1)(2);
s(3)();           // 6
s(10)();          // 13: s itself is unchanged
```

Intermediate functions can be reused, and separate chains don't affect each other.
