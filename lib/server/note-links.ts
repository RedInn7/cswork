import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedByNumber, curatedEntries, curatedSections } from '@/lib/ling-curated';
import { parseNoteMeta } from '@/lib/note-meta';
import type { Person } from './auth';
import { refuseInContest, runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { NOTE_KINDS, noteSnippet } from './my-practice';

// Written notes only (the notes hub's kinds); quiz answers, cards and prefs stay out.
const KINDS = `(${NOTE_KINDS.map((k) => `target LIKE '${k}:%'`).join(' OR ')})`;
// ponytail: tags reads bodies cut to 8000 characters, at most 5000 rows (the per-learner
// cap, MAX_ROWS): 5000 full 20 KB bodies would be 100 MB in one request. A tag past that is missed.
const SCAN = 5000;
const HEAD = 8000;
// Each note's tags and confidence, kept with the updated_at they were read at, so a write costs one
// parse rather than re-reading all 5000 notes (up to 2 s of regex on the one Node thread).
// ponytail: per process, started over past 100k notes (about 20 MB); learners who keep it full
// make one another read every note again, a stored meta column if that happens.
const MEMO = 100_000;
const noteMeta = new Map<string, { at: number; tags: string[]; confidence: number | null }>();
const problemId = z.string().regex(/^(lc|oa)-[a-z0-9-]+$/);
const stops = new Set(curatedSections.map((s) => s.slug));
const curated = (problem: string) => curatedByNumber.get(Number(/^lc-(\d+)$/.exec(problem)?.[1]));

function tags(userId: string) {
  const db = sqlite();
  const rows = db
    .prepare(`SELECT target,updated_at AS at FROM user_notes WHERE user_id=? AND ${KINDS} LIMIT ${SCAN}`)
    .all(userId) as { target: string; at: number }[];
  const head = db.prepare(`SELECT substr(body,1,${HEAD}) FROM user_notes WHERE user_id=? AND target=?`).pluck();
  if (noteMeta.size + rows.length > MEMO) noteMeta.clear();
  const counts = new Map<string, number>();
  const confidence: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const { target, at } of rows) {
    const key = `${userId}\n${target}`;
    let meta = noteMeta.get(key);
    if (!meta || meta.at !== at) {
      const parsed = parseNoteMeta((head.get(userId, target) as string | undefined) ?? '');
      noteMeta.set(key, (meta = { at, tags: parsed.tags, confidence: parsed.confidence }));
    }
    for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    if (meta.confidence) confidence[meta.confidence]++;
  }
  return {
    tags: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 60)
      .map(([tag, count]) => ({ tag, count })),
    confidence,
  };
}

/** The learner's other notes that link [[problem]] outside code, newest first, 50 at most. */
function backlinks(userId: string, problem: string) {
  const running = runningContestProblems(userId);
  // ponytail: only the newest 100 notes holding the text are parsed (at most 0.1 s of regex on hostile
  // 20 KB bodies, 20 requests a minute), so links written in code cannot make one request read all
  // 5000 bodies; an older real link past those is missed.
  const rows = sqlite()
    .prepare(
      `SELECT target,body,updated_at AS updatedAt FROM user_notes
      WHERE user_id=? AND ${KINDS} AND target<>? AND body LIKE ? ORDER BY updated_at DESC,target LIMIT 100`,
    )
    .iterate(userId, `problem:${problem}`, `%[[${problem}]]%`) as Iterable<{
    target: string;
    body: string;
    updatedAt: number;
  }>;
  const items: { target: string; snippet: string; updatedAt: number }[] = [];
  for (const row of rows) {
    // A note on a problem of a running contest stays out, as that problem's own note does in the room.
    if (row.target.startsWith('problem:') && running.has(row.target.slice(8))) continue;
    if (!parseNoteMeta(row.body).links.includes(problem)) continue;
    items.push({ target: row.target, snippet: noteSnippet(row.body, [`[[${problem}]]`]), updatedAt: row.updatedAt });
    if (items.length === 50) break;
  }
  return items;
}

/** The learner's notes on a Line 500 stop's problems (38 at most), in route order. */
function stopNotes(userId: string, slug: string) {
  const running = runningContestProblems(userId);
  const targets = curatedEntries.filter((e) => e.sectionSlug === slug).map((e) => `problem:lc-${e.number}`);
  const rows = sqlite()
    .prepare(
      `SELECT substr(target,9) AS problemId,body FROM user_notes
      WHERE user_id=? AND target IN (${targets.map(() => '?').join(',')})`,
    )
    .all(userId, ...targets) as { problemId: string; body: string }[];
  return rows
    .filter((row) => !running.has(row.problemId))
    .sort((a, b) => curated(a.problemId)!.order - curated(b.problemId)!.order)
    .map(({ problemId, body }) => {
      const { tags, confidence } = parseNoteMeta(body);
      return { problemId, snippet: noteSnippet(body), confidence, tags };
    });
}

/**
 * GET oj/notes/<sub>, private to the signed-in learner (oj-api routes every method here; anything
 * but these GETs stays 404):
 * - tags: their #tags (top 60) with note counts, and how many notes carry each confidence 1–5.
 * - backlinks?problem=: their other notes linking [[problem]]; closed while it is in a running
 *   contest or skill test (refuseInContest).
 * - stop?slug=: { me, items } for a Line 500 stop's topic page; running contest problems stay out.
 */
export async function handleNoteSub(request: Request, p: Person, sub: string): Promise<Response> {
  if (request.method !== 'GET') throw new HttpError(404, '判题接口不存在');
  const params = new URL(request.url).searchParams;
  if (sub === 'tags') {
    await limit(p, 'note-tags', 30);
    return json(tags(p.id));
  }
  if (sub === 'backlinks') {
    await limit(p, 'note-backlinks', 20);
    const problem = problemId.parse(params.get('problem'));
    refuseInContest(p, problem);
    return json({ items: backlinks(p.id, problem) });
  }
  if (sub === 'stop') {
    await limit(p, 'my-practice-read', 120);
    const slug = z.string().refine((s) => stops.has(s)).parse(params.get('slug'));
    return json({ me: p.id, items: stopNotes(p.id, slug) });
  }
  throw new HttpError(404, '判题接口不存在');
}
