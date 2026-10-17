function stringify(value) {
  const SHORT = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
  const quote = (text) =>
    '"' +
    text.replace(/["\\\u0000-\u001f]/g, (c) => SHORT[c] || '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')) +
    '"';
  const skipped = (v) => v === undefined || typeof v === 'function' || typeof v === 'symbol';
  const stack = [];

  function write(key, v) {
    if (v !== null && (typeof v === 'object' || typeof v === 'function') && typeof v.toJSON === 'function') v = v.toJSON(key);
    if (v === null) return 'null';
    if (typeof v === 'boolean') return String(v);
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
    if (typeof v === 'string') return quote(v);
    if (typeof v === 'bigint') throw new TypeError('Do not know how to serialize a BigInt');
    if (skipped(v)) return undefined;
    if (stack.includes(v)) throw new TypeError('Converting circular structure to JSON');
    stack.push(v);
    let out;
    if (Array.isArray(v)) {
      const items = [];
      for (let i = 0; i < v.length; i++) items.push(write(String(i), v[i]) ?? 'null');
      out = '[' + items.join(',') + ']';
    } else {
      const fields = [];
      for (const k of Object.keys(v)) {
        const text = write(k, v[k]);
        if (text !== undefined) fields.push(quote(k) + ':' + text);
      }
      out = '{' + fields.join(',') + '}';
    }
    stack.pop();
    return out;
  }
  return write('', value);
}
