**思路**：用 `Map` 存「事件名 → 监听函数数组」。

- `on`：取出（或新建）数组，`push`，`return this`。
- `once`：包一层 `wrapper`，执行时先 `off` 掉自己再调用原函数，并把原函数记在 `wrapper.original` 上。这样 `off(name, 原函数)` 也能认出它。
- `off`：**从后往前**找第一个匹配（`=== listener` 或 `.original === listener`），只 `splice` 掉这一个。用 `filter` 会把重复注册的全部删掉。
- `emit`：先复制一份数组（`[...list]`）再遍历。监听函数在执行中增删监听，改的是原数组，不影响这次遍历，也不会因为下标错位而跳过某个监听函数。

once 的 wrapper 要**先移除自己再调用原函数**：如果原函数里又 `emit` 同一个事件，这时它已经不在列表里了，不会无限递归（倒数第三个测试）。

用 `#listeners` 私有字段保存数据，外部代码改不到内部状态。Node 的 `EventEmitter` 还有 `error` 事件的特殊处理和监听数量上限的警告。
