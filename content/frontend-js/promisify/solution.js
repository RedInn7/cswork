function promisify(original) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      original.call(this, ...args, (error, value) => {
        if (error) reject(error);
        else resolve(value);
      });
    });
  };
}
