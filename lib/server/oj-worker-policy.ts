/** One worker slot bounds simultaneous large-answer parsing, regardless of env. */
export const OJ_WORKER_CONCURRENCY = 1;
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
