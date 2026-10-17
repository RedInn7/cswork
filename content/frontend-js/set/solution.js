function set(object, path, value) {
  const keys = Array.isArray(path) ? path.map(String) : path.replace(/\[(\d+)\]/g, '.$1').split('.').filter((key) => key !== '');
  let current = object;
  keys.forEach((key, i) => {
    if (i === keys.length - 1) {
      current[key] = value;
      return;
    }
    const next = current[key];
    if (next === null || typeof next !== 'object') current[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    current = current[key];
  });
  return object;
}
