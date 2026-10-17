async function retry(task, { retries = 3, delay = 100, factor = 2 } = {}) {
  let wait = delay;
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, wait));
      wait *= factor;
    }
  }
}
