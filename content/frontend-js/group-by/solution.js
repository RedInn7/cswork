function groupBy(array, iteratee) {
  const keyOf = typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];
  const groups = {};
  array.forEach((item, index) => {
    const key = String(keyOf(item, index));
    if (!Object.prototype.hasOwnProperty.call(groups, key)) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}
