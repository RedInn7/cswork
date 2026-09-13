import assert from 'node:assert/strict';
import { openSync, fstatSync, readSync, closeSync } from 'node:fs';

/** Inspect the opened file before allocating; never read an unbounded growing file. */
export function readBoundedFileSync(path, maximumBytes) {
  assert(Number.isSafeInteger(maximumBytes) && maximumBytes >= 0);
  const descriptor = openSync(path, 'r');
  try {
    const stat = fstatSync(descriptor);
    assert(stat.isFile(), 'OA input must be a regular file');
    assert(stat.size <= maximumBytes, 'OA file exceeds its byte budget');
    const bytes = Buffer.allocUnsafe(stat.size);
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      assert(count > 0, 'OA file changed while reading');
      offset += count;
    }
    const extra = Buffer.allocUnsafe(1);
    assert(
      readSync(descriptor, extra, 0, 1, null) === 0,
      'OA file changed while reading',
    );
    return bytes;
  } finally {
    closeSync(descriptor);
  }
}
