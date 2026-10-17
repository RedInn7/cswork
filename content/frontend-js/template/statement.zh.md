实现 `renderTemplate(template, data)`：把模板里的 `{{ 路径 }}` 换成 `data` 里对应的值。

- 花括号内侧可以有空格：`{{name}}` 和 `{{ name }}` 等价；
- 路径可以用 `.` 访问嵌套属性，例如 `{{ user.name }}`；
- 值不存在（或为 `null`、`undefined`）时替换成空字符串；其余值用 `String(value)` 转换；
- 只处理成对的双花括号，单个 `{` `}` 原样保留；
- 不对值做二次替换：值里出现的 `{{x}}` 原样输出。

```js
renderTemplate('Hi {{ user.name }}, you have {{count}} new {{ what }}.', {
  user: { name: 'Ada' }, count: 0,
});
// 'Hi Ada, you have 0 new .'
```
