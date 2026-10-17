function promisePool(tasks, limit) {
  return new Promise((resolve, reject) => {
    const results = new Array(tasks.length);
    let next = 0;
    let finished = 0;
    let failed = false;
    if (tasks.length === 0) return resolve(results);

    function launch() {
      if (failed || next >= tasks.length) return;
      const i = next++;
      // new Promise turns a synchronous throw into a rejection.
      new Promise((done) => done(tasks[i]())).then(
        (value) => {
          results[i] = value;
          finished += 1;
          if (finished === tasks.length) resolve(results);
          else launch();
        },
        (error) => {
          failed = true;
          reject(error);
        },
      );
    }
    for (let k = 0; k < Math.min(limit, tasks.length); k++) launch();
  });
}
