实现一个事件中心 `class EventEmitter`：

- `on(name, listener)`：注册监听函数，返回 `this`（可以链式调用）。同一个函数注册两次就会被调用两次。
- `once(name, listener)`：注册只触发一次的监听函数，触发后自动移除，返回 `this`。
- `off(name, listener)`：移除一次注册，返回 `this`。同一个函数注册了多次时，移除**最近添加**的那一次。用 `once` 注册的函数，也可以传原函数来移除。
- `emit(name, ...args)`：按注册顺序调用这个事件的所有监听函数，`this` 指向这个 emitter，参数原样传入。有监听函数时返回 `true`，否则返回 `false`。

`emit` 进行中添加或移除监听函数，不影响这一次 `emit` 要调用的列表（按开始时的快照调用）。

```js
const bus = new EventEmitter();
bus.on('login', (user) => console.log('hi', user));
bus.once('login', () => console.log('first login'));
bus.emit('login', 'ada'); // hi ada / first login
bus.emit('login', 'lin'); // hi lin
```
