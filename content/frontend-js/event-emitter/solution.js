class EventEmitter {
  #listeners = new Map(); // name -> array of functions (once wrappers carry .original)

  on(name, listener) {
    if (!this.#listeners.has(name)) this.#listeners.set(name, []);
    this.#listeners.get(name).push(listener);
    return this;
  }

  once(name, listener) {
    const wrapper = (...args) => {
      this.off(name, wrapper);
      listener.apply(this, args);
    };
    wrapper.original = listener;
    return this.on(name, wrapper);
  }

  off(name, listener) {
    const list = this.#listeners.get(name);
    if (!list) return this;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === listener || list[i].original === listener) {
        list.splice(i, 1);
        break;
      }
    }
    if (list.length === 0) this.#listeners.delete(name);
    return this;
  }

  emit(name, ...args) {
    const list = this.#listeners.get(name);
    if (!list || list.length === 0) return false;
    for (const listener of [...list]) listener.apply(this, args);
    return true;
  }
}
