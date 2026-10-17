Implement `renderTemplate(template, data)`: replace each `{{ path }}` in the template with the matching value from `data`.

- Spaces inside the braces are allowed: `{{name}}` and `{{ name }}` are the same;
- paths reach nested properties with `.`, e.g. `{{ user.name }}`;
- a missing value (or `null` / `undefined`) becomes an empty string; any other value goes through `String(value)`;
- only paired double braces count; single `{` and `}` stay as they are;
- values are not rendered again: a `{{x}}` inside a value is output as it is.

```js
renderTemplate('Hi {{ user.name }}, you have {{count}} new {{ what }}.', {
  user: { name: 'Ada' }, count: 0,
});
// 'Hi Ada, you have 0 new .'
```
