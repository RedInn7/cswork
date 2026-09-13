/** Deliberately bounded for the shared four-core host; invalid overrides fail closed. */
export function workerConcurrency(
  value = process.env.OJ_WORKER_CONCURRENCY,
): number {
  if (value === undefined || value === '2') return 2;
  if (value === '1') return 1;
  throw new Error('OJ_WORKER_CONCURRENCY must be 1 or 2');
}
export const OJ_WORKER_CONCURRENCY = workerConcurrency();

/** Inspect byte counts in SQLite, before materializing potentially large strings. */
export function exclusiveSubmission(
  snapshotBytes: number,
  memoryLimitKb: number,
  outputLimitKb: number,
): boolean {
  return (
    !Number.isFinite(snapshotBytes) ||
    snapshotBytes < 0 ||
    !Number.isFinite(memoryLimitKb) ||
    memoryLimitKb <= 0 ||
    !Number.isFinite(outputLimitKb) ||
    outputLimitKb <= 0 ||
    snapshotBytes > 8 * 1024 * 1024 ||
    memoryLimitKb > 512 * 1024 ||
    outputLimitKb > 8 * 1024
  );
}

/** FIFO admission keeps large snapshots/checker parsing isolated and prevents starvation. */
export class SubmissionAdmission {
  private used = 0;
  private waiting: {
    slots: number;
    signal: AbortSignal;
    grant: (release: () => void) => void;
    reject: (reason: unknown) => void;
    abort: () => void;
  }[] = [];
  constructor(private capacity: number) {
    if (capacity !== 1 && capacity !== 2)
      throw new Error('Invalid judge admission capacity');
  }
  acquire(exclusive: boolean, signal: AbortSignal): Promise<() => void> {
    signal.throwIfAborted();
    return new Promise((grant, reject) => {
      const item = {
        slots: exclusive ? this.capacity : 1,
        signal,
        grant,
        reject,
        abort: () => {
          const index = this.waiting.indexOf(item);
          if (index < 0) return;
          this.waiting.splice(index, 1);
          signal.removeEventListener('abort', item.abort);
          reject(signal.reason);
          this.drain();
        },
      };
      this.waiting.push(item);
      signal.addEventListener('abort', item.abort, { once: true });
      this.drain();
    });
  }
  private drain() {
    while (
      this.waiting.length &&
      this.used + this.waiting[0].slots <= this.capacity
    ) {
      const item = this.waiting.shift()!;
      item.signal.removeEventListener('abort', item.abort);
      this.used += item.slots;
      let released = false;
      item.grant(() => {
        if (released) return;
        released = true;
        this.used -= item.slots;
        this.drain();
      });
    }
  }
}
const SNAPSHOT_BYTES = 128 * 1024 * 1024;
const INPUT_BYTES = 4 * 1024 * 1024;
const OUTPUT_BYTES = 64 * 1024 * 1024;

/** Defense in depth for immutable snapshots; never include private data in errors. */
export function assertSnapshotBudget(
  cases: readonly { input: string; expectedOutput: string }[],
): void {
  let total = 0;
  for (const c of cases) {
    const input = Buffer.byteLength(c.input, 'utf8');
    const output = Buffer.byteLength(c.expectedOutput, 'utf8');
    total += input + output;
    if (input > INPUT_BYTES || output > OUTPUT_BYTES || total > SNAPSHOT_BYTES)
      throw new Error('Judge snapshot exceeds its bounded data budget');
  }
}
