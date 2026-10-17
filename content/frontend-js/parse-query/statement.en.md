Implement `parseQuery(query)`: parse a URL query string into an object.

- A leading `?` is optional; split on `&` and ignore empty pieces (as in `a=1&&b=2`);
- split each piece at the **first** `=` into key and value, so values may contain `=`; a piece without `=` has the value `''`;
- decode keys and values: replace `+` with a space first, then `decodeURIComponent`;
- a key that appears several times gets an array of its values, in order;
- an empty string (or a lone `?`) gives `{}`.

```js
parseQuery('?q=js+closure&tag=a&tag=b&debug');
// { q: 'js closure', tag: ['a', 'b'], debug: '' }
parseQuery('redirect=%2Fhome%3Fx%3D1&eq=a=b');
// { redirect: '/home?x=1', eq: 'a=b' }
```

During the tests `URLSearchParams` is replaced by a class that throws.
