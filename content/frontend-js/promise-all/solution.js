function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let left = items.length;
    if (left === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;
        left -= 1;
        if (left === 0) resolve(results);
      }, reject);
    });
  });
}
