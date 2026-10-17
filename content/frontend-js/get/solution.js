function get(object, path, defaultValue) {
  const keys = Array.isArray(path) ? path : path.replace(/\[(\d+)\]/g, '.$1').split('.').filter((key) => key !== '');
  let current = object;
  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    current = current[key];
  }
  return current === undefined ? defaultValue : current;
}
