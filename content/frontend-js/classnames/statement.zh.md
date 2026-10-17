写组件时经常要按条件拼 `class` 名。实现 `classNames(...args)`，返回用单个空格连接的字符串：

- 字符串和数字：真值就加入（空字符串、`0` 忽略）；
- 对象：值为真的**键**加入；
- 数组：递归处理其中的每一项；
- `null`、`undefined`、`false`、`true` 等其他值忽略。

结果按参数的先后顺序排列，不去重，首尾没有多余的空格。

```js
classNames('btn', { active: true, disabled: false }, ['lg', ['round']]);
// 'btn active lg round'
classNames(null, '', 0, 'ok'); // 'ok'
```
