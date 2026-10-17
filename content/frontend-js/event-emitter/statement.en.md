Implement an event hub, `class EventEmitter`:

- `on(name, listener)`: register a listener and return `this` (so calls chain). A function registered twice is called twice.
- `once(name, listener)`: register a listener that runs once and then removes itself; return `this`.
- `off(name, listener)`: remove one registration and return `this`. If the function was registered several times, remove the **most recently added** one. A `once` listener can be removed by passing the original function.
- `emit(name, ...args)`: call the event's listeners in registration order, with `this` set to the emitter and the arguments passed through. Return `true` if there were listeners, `false` otherwise.

Adding or removing listeners while `emit` runs doesn't change that `emit`'s list: it calls a snapshot taken when it started.

```js
const bus = new EventEmitter();
bus.on('login', (user) => console.log('hi', user));
bus.once('login', () => console.log('first login'));
bus.emit('login', 'ada'); // hi ada / first login
bus.emit('login', 'lin'); // hi lin
```
