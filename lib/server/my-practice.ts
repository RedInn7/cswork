import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedByNumber } from '@/lib/ling-curated';
import { NOTE_MAX_BYTES, type PracticeHistoryItem } from '@/lib/practice-review';
import type { Person } from './auth';
import { boundedText, HttpError, json, limit } from './http';

// ponytail: flat per-learner caps keep a scripted client from growing the tables forever.
const MAX_ROWS = 5000;
const target = z.string().regex(/^(?:problem|content):[\w./-]{1,200}$/);
const mark = z.enum(['star', 'redo']);
// The verdicts that count against the learner's code; judge faults and cancels do not.
const FAILED = `'wrong_answer','compile_error','time_limit','memory_limit','output_limit','runtime_error'`;

type HistoryRow = Omit<PracticeHistoryItem, 'languages' | 'acAt' | 'stop'> & {
  languages: string;
  acAt: string | null;
};

/** Formal submissions grouped per problem, newest activity first; runs never count. */
export function practiceHistory(userId: string): PracticeHistoryItem[] {
  const rows = sqlite()
    .prepare(
      `WITH s AS (
        SELECT problem_id,status,language,created_at,
          ROW_NUMBER() OVER (PARTITION BY problem_id ORDER BY created_at DESC,id DESC) AS recent,
          MIN(CASE WHEN status='accepted' THEN created_at END) OVER (PARTITION BY problem_id) AS first_ac
        FROM submissions WHERE user_id=? AND mode='judge'
      )
      SELECT problem_id AS problemId,COUNT(*) AS attempts,
        MIN(created_at) AS firstAt,MAX(created_at) AS lastAt,MAX(first_ac) AS firstAcAt,
        SUM(status IN (${FAILED}) AND (first_ac IS NULL OR created_at<first_ac)) AS failuresBeforeAc,
        MAX(CASE WHEN recent=1 THEN status END) AS lastStatus,
        group_concat(DISTINCT language) AS languages,
        group_concat(CASE WHEN status='accepted' THEN created_at END) AS acAt
      FROM s GROUP BY problem_id ORDER BY lastAt DESC,problem_id`,
    )
    .all(userId) as HistoryRow[];
  return rows.map((row) => ({
    ...row,
    languages: row.languages.split(','),
    acAt: row.acAt ? row.acAt.split(',').map(Number) : [],
    stop:
      curatedByNumber.get(Number(/^lc-(\d+)$/.exec(row.problemId)?.[1]))
        ?.sectionSlug ?? null,
  }));
}

/** problem id -> its marks, for list rows and the status filters. */
export function problemMarks(userId: string) {
  const marks = new Map<string, Set<string>>();
  const rows = sqlite()
    .prepare(
      "SELECT target,mark FROM user_marks WHERE user_id=? AND target LIKE 'problem:%'",
    )
    .all(userId) as { target: string; mark: string }[];
  for (const row of rows) {
    const id = row.target.slice('problem:'.length);
    marks.set(id, (marks.get(id) ?? new Set()).add(row.mark));
  }
  return marks;
}

async function readJson(request: Request, max: number) {
  try {
    return JSON.parse(await boundedText(request, max)) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, '无效的 JSON');
  }
}
function full(table: 'user_notes' | 'user_marks', userId: string) {
  const { n } = sqlite()
    .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id=?`)
    .get(userId) as { n: number };
  if (n >= MAX_ROWS) throw new HttpError(409, '笔记或标记已达上限');
}

/** GET history; GET/PUT notes; GET/POST marks. Private to the signed-in learner. */
export async function handleMyPractice(
  request: Request,
  p: Person,
  resource: 'history' | 'notes' | 'marks',
) {
  const db = sqlite();
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    await limit(p, 'my-practice-read', 120);
    if (resource === 'history') return json({ items: practiceHistory(p.id) });
    if (resource === 'notes') {
      if (!params.has('target'))
        return json({
          items: db
            .prepare(
              'SELECT target,updated_at AS updatedAt FROM user_notes WHERE user_id=? ORDER BY updated_at DESC',
            )
            .all(p.id),
        });
      const key = target.parse(params.get('target'));
      const note = db
        .prepare(
          'SELECT body,updated_at AS updatedAt FROM user_notes WHERE user_id=? AND target=?',
        )
        .get(p.id, key) as { body: string; updatedAt: number } | undefined;
      return json({ target: key, body: note?.body ?? '', updatedAt: note?.updatedAt ?? null });
    }
    const only = params.has('mark') ? mark.parse(params.get('mark')) : null;
    const of = params.has('target') ? target.parse(params.get('target')) : null;
    return json({
      items: db
        .prepare(
          `SELECT target,mark,created_at AS createdAt FROM user_marks
          WHERE user_id=? AND (? IS NULL OR mark=?) AND (? IS NULL OR target=?)
          ORDER BY created_at DESC`,
        )
        .all(p.id, only, only, of, of),
    });
  }
  if (resource === 'notes' && request.method === 'PUT') {
    await limit(p, 'note-write', 120);
    const key = target.parse(params.get('target'));
    // JSON escapes can double the body; the byte cap below is the real limit.
    const { body } = z
      .object({ body: z.string() })
      .strict()
      .parse(await readJson(request, NOTE_MAX_BYTES * 2 + 200));
    if (new TextEncoder().encode(body).length > NOTE_MAX_BYTES)
      throw new HttpError(413, '内容过长');
    // An emptied note is removed, so "has a note" always means some text.
    if (!body.trim()) {
      db.prepare('DELETE FROM user_notes WHERE user_id=? AND target=?').run(p.id, key);
      return json({ target: key, body: '', updatedAt: null });
    }
    if (!db.prepare('SELECT 1 FROM user_notes WHERE user_id=? AND target=?').get(p.id, key))
      full('user_notes', p.id);
    const now = Date.now();
    db.prepare(
      `INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id,target) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`,
    ).run(p.id, key, body, now);
    return json({ target: key, body, updatedAt: now });
  }
  if (resource === 'marks' && request.method === 'POST') {
    await limit(p, 'mark-write', 60);
    const d = z
      .object({ target, mark, on: z.boolean() })
      .strict()
      .parse(await readJson(request, 1000));
    if (!d.on)
      db.prepare('DELETE FROM user_marks WHERE user_id=? AND target=? AND mark=?').run(
        p.id,
        d.target,
        d.mark,
      );
    else {
      full('user_marks', p.id);
      db.prepare(
        'INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',
      ).run(p.id, d.target, d.mark, Date.now());
    }
    return json(d);
  }
  throw new HttpError(404, '判题接口不存在');
}
