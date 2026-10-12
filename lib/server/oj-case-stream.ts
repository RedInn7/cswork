/** A few independent sandboxes at a time, preserving case order and individual limits. */
export async function* orderedCaseResults<T, R>(
  cases: readonly T[],
  execute: (item: T) => Promise<R>,
  /** Cases in flight; a function is re-read whenever a slot frees. */
  concurrency: number | (() => number),
  cancelPending?: () => void,
): AsyncGenerator<{ item: T; result: R }> {
  const limit =
    typeof concurrency === 'function' ? concurrency : () => concurrency;
  type Outcome = { ok: true; result: R } | { ok: false; error: unknown };
  const pending = new Map<number, Promise<Outcome>>();
  const start = (index: number) => {
    // Attach the rejection handler immediately: a later case may fail before
    // the preceding case finishes. The caller still observes failures in order.
    pending.set(
      index,
      Promise.resolve()
        .then(() => execute(cases[index]))
        .then(
          (result): Outcome => ({ ok: true, result }),
          (error): Outcome => ({ ok: false, error }),
        ),
    );
  };
  let next = 0;
  // Cases start in order, so pending always holds the window [index, next).
  const fill = () => {
    while (next < cases.length && pending.size < Math.max(1, limit()))
      start(next++);
  };
  try {
    fill();
    for (let index = 0; index < cases.length; index++) {
      const outcome = await pending.get(index)!;
      pending.delete(index);
      if (!outcome.ok) throw outcome.error;
      yield { item: cases[index], result: outcome.result };
      fill();
    }
  } finally {
    if (pending.size) cancelPending?.();
    // A TLE/abort/exception must finish its already-started neighbour before
    // compiled files are released or another submission is allowed to start.
    await Promise.all(pending.values());
  }
}

export function caseConcurrency(
  memoryLimitKb: number,
  exclusive = false,
): 1 | 2 | 4 {
  // Larger-memory problems stay serial. Exclusive submissions (large output or
  // snapshot) keep two: each in-flight case can bring back a body up to its
  // output limit, and the worker's memory was sized for two.
  if (memoryLimitKb > 512 * 1024) return 1;
  return exclusive ? 2 : 4;
}

/**
 * FIFO cap on case sandboxes in flight across the whole worker. An idle runner
 * gives one submission up to four slots; once anyone waits, submissions narrow
 * back to two, so failing ones waste no more runner time than before, and
 * compiles never queue behind a backlog of case runs inside the runner.
 */
export function createSlots(size: number) {
  let free = size;
  const waiting: (() => void)[] = [];
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else free++;
  };
  const lease = () => {
    let held = true;
    return () => {
      if (held) (held = false), release();
    };
  };
  return {
    /** Someone is waiting for a slot: submissions should not widen. */
    contended: () => waiting.length > 0,
    async acquire(signal: AbortSignal): Promise<() => void> {
      signal.throwIfAborted();
      if (free > 0) {
        free--;
        return lease();
      }
      await new Promise<void>((resolve, reject) => {
        const grant = () => {
          signal.removeEventListener('abort', abort);
          resolve();
        };
        const abort = () => {
          waiting.splice(waiting.indexOf(grant) >>> 0, 1);
          reject(signal.reason);
        };
        waiting.push(grant);
        signal.addEventListener('abort', abort, { once: true });
      });
      return lease();
    },
  };
}
