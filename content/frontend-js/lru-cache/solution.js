class LRUCache {
  #capacity;
  #entries = new Map(); // insertion order = least to most recently used

  constructor(capacity) {
    this.#capacity = capacity;
  }

  get(key) {
    if (!this.#entries.has(key)) return undefined;
    const value = this.#entries.get(key);
    this.#entries.delete(key);
    this.#entries.set(key, value);
    return value;
  }

  put(key, value) {
    this.#entries.delete(key);
    this.#entries.set(key, value);
    if (this.#entries.size > this.#capacity) this.#entries.delete(this.#entries.keys().next().value);
  }

  get size() {
    return this.#entries.size;
  }

  keys() {
    return [...this.#entries.keys()];
  }
}
