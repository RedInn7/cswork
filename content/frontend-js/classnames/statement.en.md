Components often build `class` names from conditions. Implement `classNames(...args)`, returning the names joined by single spaces:

- strings and numbers: added when truthy (an empty string and `0` are skipped);
- objects: each **key** with a truthy value is added;
- arrays: every item is handled recursively;
- anything else (`null`, `undefined`, `false`, `true`, ...) is ignored.

Names follow the argument order, duplicates stay, and there are no leading or trailing spaces.

```js
classNames('btn', { active: true, disabled: false }, ['lg', ['round']]);
// 'btn active lg round'
classNames(null, '', 0, 'ok'); // 'ok'
```
