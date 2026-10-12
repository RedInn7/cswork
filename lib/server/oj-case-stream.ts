/** A few independent sandboxes at a time, preserving case order and individual limits. */
export async function* orderedCaseResults<T, R>(
  cases: readonly T[],
  execute: (item: T) => Promise<R>,
  concurrency: number,
  cancelPending?: () => void,
): AsyncGenerator<{ item: T; result: R }> {
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
  try {
    for (; next < Math.min(concurrency, cases.length); next++) start(next);
    for (let index = 0; index < cases.length; index++) {
      const outcome = await pending.get(index)!;
      pending.delete(index);
      if (!outcome.ok) throw outcome.error;
      yield { item: cases[index], result: outcome.result };
      if (next < cases.length) start(next++);
    }
  } finally {
    if (pending.size) cancelPending?.();
    // A TLE/abort/exception must finish its already-started neighbour before
    // compiled files are released or another submission is allowed to start.
    await Promise.all(pending.values());
  }
}

export function caseConcurrency(memoryLimitKb: number): 1 | 4 {
  // Four 512 MiB cases fit the runner's four slots and 6 GiB cap; the
  // worker-wide caseSlots below keep busy periods at four sandboxes in total.
  // Larger-memory problems stay serial.
  return memoryLimitKb <= 512 * 1024 ? 4 : 1;
}

/**
 * FIFO cap on case sandboxes in flight across the whole worker. An idle runner
 * gives one submission every slot; under load submissions share them, and
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
  return async function acquire(signal: AbortSignal): Promise<() => void> {
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
  };
}
