**camelToSnake**: two regexes find the word boundaries and insert `_`; then lowercase everything.

```js
text.replace(/([a-z\d])([A-Z])/g, '$1_$2')   // userId → user_Id, h1Title → h1_Title
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2') // HTTPServer → HTTP_Server
    .toLowerCase();
```

The second one handles acronyms: in a run of capitals, the **last** capital followed by a lowercase letter actually starts the next word, so break before it. With the first regex alone, `getHTTPResponse` becomes `get_httpresponse`.

**snakeToCamel**: `/(?<=[^_])_+([a-z\d])/g` needs a non-underscore character before the underscores. Leading underscores have nothing before them, so they never match and stay; trailing ones have no letter after them and stay too. The callback capitalizes the captured letter.

The check before the underscores is a lookbehind `(?<=…)` on purpose: it looks without consuming. Capturing the character instead, as in `([^_])_+`, uses up the letter of a one-letter word, so the next underscore has nothing left to match against: `is_a_test` would come out as `isA_test`.

`snakeToCamel(camelToSnake(x))` doesn't always give `x` back: `userID` comes back as `userId`, because the acronym is lost. Convert API field names in one place.
