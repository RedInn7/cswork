/** At most two independent sandboxes, preserving case order and individual limits. */
export async function* orderedCaseResults<T, R>(
  cases: readonly T[],
  execute: (item: T) => Promise<R>,
  concurrency: 1 | 2,
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
    // A TLE/abort/exception must finish its already-started neighbour before
    // compiled files are released or another submission is allowed to start.
    await Promise.all(pending.values());
  }
}

export function caseConcurrency(memoryLimitKb: number): 1 | 2 {
  // The runner already has two slots and a 4 GiB cap. Keep larger-memory
  // problems serial and leave room for interpreter/bridge startup and the host.
  return memoryLimitKb <= 512 * 1024 ? 2 : 1;
}
