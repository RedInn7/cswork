function latest(request) {
  let current = null; // the unsettled call: { reject }

  function cancel() {
    if (!current) return;
    current.reject(new Error('cancelled'));
    current = null;
  }
  function run(...args) {
    cancel();
    return new Promise((resolve, reject) => {
      const call = { reject };
      current = call;
      new Promise((done) => done(request.apply(this, args))).then(
        (value) => {
          if (current !== call) return;
          current = null;
          resolve(value);
        },
        (error) => {
          if (current !== call) return;
          current = null;
          reject(error);
        },
      );
    });
  }
  run.cancel = cancel;
  return run;
}
