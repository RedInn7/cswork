import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedByNumber, curatedEntries, curatedSections } from '@/lib/ling-curated';
import { parseNoteMeta } from '@/lib/note-meta';
import type { Person } from './auth';
import { refuseInContest, runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { NOTE_KINDS, noteSnippet } from './my-practice';

// Written notes only (the notes hub's kinds); quiz answers, stories, cards and prefs stay out.
const KINDS = `(${NOTE_KINDS.map((k) => `target LIKE '${k}:%'`).join(' OR ')})`;
// ponytail: tags reads bodies cut to 8000 characters, at most 5000 rows (the per-learner
// cap, MAX_ROWS): 5000 full 20 KB bodies would be 100 MB in one request. A tag past that is missed.
const SCAN = 5000;
const HEAD = 8000;
// ponytail: per-process cache, emptied past 500 learners; another process just counts again.
const tagCache = new Map<string, { key: string; value: unknown }>();
const problemId = z.string().regex(/^(lc|oa)-[a-z0-9-]+$/);
const stops = new Set(curatedSections.map((s) => s.slug));
const curated = (problem: string) => curatedByNumber.get(Number(/^lc-(\d+)$/.exec(problem)?.[1]));

function tags(userId: string) {
  const { at, n } = sqlite()
    .prepare(`SELECT MAX(updated_at) AS at,COUNT(*) AS n FROM user_notes WHERE user_id=? AND ${KINDS}`)
    .get(userId) as { at: number | null; n: number };
  const key = `${at}:${n}`;
  const cached = tagCache.get(userId);
  if (cached?.key === key) return cached.value;
  const counts = new Map<string, number>();
  const confidence: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const bodies = sqlite()
    .prepare(`SELECT substr(body,1,${HEAD}) FROM user_notes WHERE user_id=? AND ${KINDS} LIMIT ${SCAN}`)
    .pluck()
    .iterate(userId) as Iterable<string>;
  for (const body of bodies) {
    const meta = parseNoteMeta(body);
    for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    if (meta.confidence) confidence[meta.confidence]++;
  }
  const value = {
    tags: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 60)
      .map(([tag, count]) => ({ tag, count })),
    confidence,
  };
  if (tagCache.size >= 500) tagCache.clear();
  tagCache.set(userId, { key, value });
  return value;
}

/** The learner's other notes that link [[problem]] outside code, newest first, 50 at most. */
function backlinks(userId: string, problem: string) {
  const running = runningContestProblems(userId);
  // ponytail: only the newest 200 notes holding the text are parsed, so links written in code cannot
  // make one request read all 5000 bodies; an older real link past those is missed.
  const rows = sqlite()
    .prepare(
      `SELECT target,body,updated_at AS updatedAt FROM user_notes
      WHERE user_id=? AND ${KINDS} AND target<>? AND body LIKE ? ORDER BY updated_at DESC,target LIMIT 200`,
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
    await limit(p, 'note-backlinks', 60);
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
