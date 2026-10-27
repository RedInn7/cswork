import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const writtenEditorial = z
  .object({
    id: z.string(),
    explanation: z.string().min(1),
    explanationEn: z.string().min(1).optional(),
    solutions: z.array(z.object({ language: z.string(), code: z.string().min(1) })),
  })
  .strict();
const written = new Map<string, z.infer<typeof writtenEditorial> | null>();
/**
 * The editorial of an OA problem not judged here (content/oa-master/editorials/<id>.json), so
 * every problem in the library has one; judged problems keep the registry's verified editorial.
 */
export function oaWrittenEditorial(id: string) {
  if (!written.has(id) && /^oa-[a-z0-9-]+$/.test(id)) {
    const file = resolve(`content/oa-master/editorials/${id}.json`);
    let value = null;
    try {
      if (existsSync(file) && statSync(file).size < 1024 * 1024) {
        const parsed = writtenEditorial.parse(JSON.parse(readFileSync(file, 'utf8')));
        if (parsed.id === id) value = parsed;
      }
    } catch {
      // Unreadable: not shown; tests/oa-written-editorials.test.ts fails on it.
    }
    written.set(id, value);
  }
  return written.get(id) ?? null;
}
