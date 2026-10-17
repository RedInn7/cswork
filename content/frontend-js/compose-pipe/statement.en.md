Implement two functions:

- `compose(...fns)` calls them **right to left**: `compose(f, g, h)(x)` is `f(g(h(x)))`;
- `pipe(...fns)` calls them **left to right**: `pipe(f, g, h)(x)` is `h(g(f(x)))`.

The first function to run may take several arguments; each of the others gets only the previous result. With no functions, the result returns the first argument it gets unchanged.

```js
const slug = pipe((s) => s.trim(), (s) => s.toLowerCase(), (s) => s.replace(/\s+/g, '-'));
slug('  Hello World '); // 'hello-world'
```
