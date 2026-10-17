Frontends use camelCase while many APIs use snake_case. Implement two functions:

`camelToSnake(text)`:
- insert `_` between a lowercase letter or digit and the capital that follows: `userId` → `user_id`, `version2Beta` → `version2_beta`;
- a run of capitals (an acronym) is one word, split off from a following "capital + lowercase" word: `getHTTPResponse` → `get_http_response`, `userID` → `user_id`;
- then lowercase everything.

`snakeToCamel(text)`:
- remove the `_` (one or more) between words and capitalize the letter after it: `user_id` → `userId`, `a__b` → `aB`;
- keep leading underscores: `__private_value` → `__privateValue`; keep trailing ones too;
- inputs are lowercase snake_case.

```js
camelToSnake('getHTTPResponse'); // 'get_http_response'
snakeToCamel('created_at');      // 'createdAt'
```
