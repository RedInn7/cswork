function promiseAllSettled(iterable) {
  return new Promise((resolve) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let left = items.length;
    if (left === 0) return resolve(results);
    const settle = (i, result) => {
      results[i] = result;
      left -= 1;
      if (left === 0) resolve(results);
    };
    items.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => settle(i, { status: 'fulfilled', value }),
        (reason) => settle(i, { status: 'rejected', reason }),
      );
    });
  });
}
