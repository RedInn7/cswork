**Idea**: one global regex and a `replace` callback:

```js
template.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, (_, path) => /* look up the path */);
```

- `\{\{` and `\}\}` match paired double braces only; `\s*` allows inner spaces; `([\w$.]+)` captures the path.
- In the callback, walk the path by `.` and stop at `null` or `undefined`. Return `''` for an empty result and `String(value)` otherwise; `value || ''` would blank out `0` and `false`.
- `replace` scans the original string once, so inserted text is never matched again: a `{{b}}` inside a value isn't rendered a second time.
- Pass a **function**, not a string, as the replacement: in a string replacement `$&` and `$1` mean something, and a value containing them would come out wrong (the last test).

A real template engine also escapes HTML against XSS: before user data goes into a page, escape at least `<`, `>`, `&`, `"` and `'`.
