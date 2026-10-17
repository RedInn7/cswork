**Idea**: the throttle is either idle (`timer === null`) or inside a cooldown window.

- A call while idle runs now and opens a window of `wait` ms.
- A call inside the window only overwrites `kept`, so the last `this` and arguments win.
- When the window ends: if something was kept, run it and **open a new window at once**, or the next call could run too soon after it; otherwise go idle.

Compared with debounce: debounce waits until the calls stop, so a steady stream may never run it; throttle runs at least once per window.

**Common bugs**: not opening a new window after the trailing call, so two runs end up less than `wait` apart; checking timestamps only and losing the last call of the window.
