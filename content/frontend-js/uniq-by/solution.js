function uniqBy(array, iteratee) {
  const keyOf = typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];
  const seen = new Set();
  return array.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
