/** Offline, idempotent import. Candidate tests never enable judging. */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { z } from 'zod';

const sourceUrl = z
  .string()
  .url()
  .refine((s) => {
    const u = new URL(s);
    return (
      u.protocol === 'https:' &&
      ['leetcode.com', 'leetcode.cn'].includes(u.hostname)
    );
  });
const source = z
  .object({
    id: z.string().regex(/^lc-\d{1,6}$/),
    number: z.number().int().positive(),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    titleZh: z.string().min(1).max(300),
    titleEn: z.string().min(1).max(300),
    difficulty: z.enum(['简单', '中等', '困难']),
    topics: z.array(z.string().min(1).max(100)).min(1).max(12),
    descriptionZh: z.string().min(1).max(300000),
    descriptionEn: z.string().min(1).max(300000),
    sourceUrl,
    sourceEnUrl: sourceUrl,
    attribution: z.string().min(1).max(4000),
    signature: z.unknown(),
    codeSnippets: z.array(z.unknown()),
    reference: z.unknown(),
    cases: z.array(z.record(z.string(), z.unknown())).max(1000),
    caseStatus: z.enum(['unverified', 'missing']),
  })
  .strict();

export function loadStudyLibrary(db, file) {
  if (statSync(file).size > 512 * 1024 * 1024)
    throw new Error('Library import exceeds 512 MiB');
  const contents = readFileSync(file, 'utf8');
  if (Buffer.byteLength(contents) > 512 * 1024 * 1024)
    throw new Error('Library import exceeds 512 MiB');
  const seen = new Set();
  const insert = db.prepare(`INSERT INTO study_library
    (id,number,slug,title_zh,title_en,difficulty,topics_json,payload_json,content_hash,case_count,expected_count,imported_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    number=excluded.number,slug=excluded.slug,title_zh=excluded.title_zh,title_en=excluded.title_en,
    difficulty=excluded.difficulty,topics_json=excluded.topics_json,payload_json=excluded.payload_json,
    content_hash=excluded.content_hash,case_count=excluded.case_count,expected_count=excluded.expected_count,
    imported_at=excluded.imported_at`);
  let cases = 0;
  db.transaction(() => {
    for (const line of contents.split('\n')) {
      if (!line.trim()) continue;
      if (Buffer.byteLength(line) > 8 * 1024 * 1024)
        throw new Error('A problem exceeds 8 MiB');
      const p = source.parse(JSON.parse(line));
      if (p.id !== `lc-${p.number}` || seen.has(p.id))
        throw new Error(`Duplicate or mismatched ID ${p.id}`);
      seen.add(p.id);
      // Keep source order and values: the hash ties verification to this exact imported snapshot.
      const payload = JSON.stringify(p);
      const hash = createHash('sha256').update(payload).digest('hex');
      const expected = p.cases.filter((c) =>
        ['output', 'expected', 'expectedOutput'].some(
          (k) => c[k] !== undefined && c[k] !== null,
        ),
      ).length;
      insert.run(
        p.id,
        p.number,
        p.slug,
        p.titleZh,
        p.titleEn,
        p.difficulty,
        JSON.stringify(p.topics),
        payload,
        hash,
        p.cases.length,
        expected,
        Date.now(),
      );
      cases += p.cases.length;
    }
  })();
  return { problems: seen.size, candidateCases: cases };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.env.DATABASE_PATH || !process.argv[2])
    throw new Error('Set DATABASE_PATH and pass the generated JSONL file');
  const db = new Database(process.env.DATABASE_PATH, { fileMustExist: true });
  db.pragma('busy_timeout = 10000');
  try {
    console.log(JSON.stringify(loadStudyLibrary(db, process.argv[2])));
    if (process.argv[3])
      writeFileSync(
        process.argv[3],
        JSON.stringify(
          Object.fromEntries(
            db
              .prepare('SELECT id,content_hash FROM study_library')
              .all()
              .map((row) => [row.id, row.content_hash]),
          ),
        ),
        { mode: 0o600 },
      );
  } finally {
    db.close();
  }
}
