**Idea**: turn the path into keys as in `get`, walk down to the **second-to-last** level, and assign the last key directly.

At each step down:
- if the next level is an object or array (`typeof === 'object'` and not `null`), step into it;
- otherwise create one: an array if the **next key** is a non-negative integer like `/^\d+$/`, an object if not.

```js
if (next === null || typeof next !== 'object') current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
```

- Keys in an array path may be numbers; convert them with `String` before the regex test.
- `'-1'` and `'1x'` aren't array indexes, so match the whole string with a regex instead of using `!isNaN(key)`.

**Security**: when the path comes from user input, reject the keys `__proto__`, `constructor` and `prototype`. Otherwise `set({}, '__proto__.isAdmin', true)` changes the prototype of every object (prototype pollution).
