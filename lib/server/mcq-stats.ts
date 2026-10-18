import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import bankFile from '@/lib/content/oa-mcq.json';
import { aptitudeById } from '@/lib/aptitude';
import { mcqRight, type McqQuestion } from '@/lib/mock-oa';
import type { Person } from './auth';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { requireVerified } from './learner-cloud';
import { readJson } from './my-practice';

/**
 * Site-wide answers to the OA multiple-choice bank (db/mcq-answers-schema.ts): each learner's
 * first answer per question, graded here. Reads are public counts only, and nothing for a
 * question fewer than MCQ_STATS_MIN people answered. The bank and its answers already ship to
 * the browser, so the counts give nothing away; the write needs a verified email so throwaway
 * accounts cannot skew a choice's share.
 */
export const MCQ_STATS_MIN = 20;
const TTL = 10 * 60_000;
const IDS_MAX = 50;
const bank = new Map((bankFile.questions as McqQuestion[]).map((q) => [q.id, q]));

/** n answered, `right` of them right, picks[j] = how many picked choice j. */
export type McqStat = { n: number; right: number; picks: number[] };
// ponytail: per-question entries, bounded by the bank (~550 ids); no eviction needed.
const cache = new Map<string, { at: number; stat: McqStat | null }>();

const answerSchema = z.object({ id: z.string().max(80), picks: z.array(z.number().int()).min(1).max(6) });

/** Records the learner's first answer to a question; later ones change nothing. */
export function recordMcqAnswer(userId: string, input: unknown, now = Date.now()) {
  const { id, picks } = answerSchema.parse(input);
  const q = bank.get(id);
  if (!q) throw new HttpError(404, '选择题不存在');
  const sorted = [...new Set(picks)].sort((a, b) => a - b);
  if (
    sorted.length !== picks.length ||
    sorted.some((j) => j < 0 || j >= q.en.choices.length) ||
    (q.answer.length === 1 && sorted.length !== 1)
  )
    throw new HttpError(400, '选项不合法');
  const correct = mcqRight(q.answer, sorted);
  const { changes } = sqlite()
    .prepare('INSERT OR IGNORE INTO mcq_answers(question_id,user_id,picks,correct,created_at) VALUES(?,?,?,?,?)')
    .run(id, userId, JSON.stringify(sorted), +correct, now);
  return { correct, first: changes > 0 };
}

/** Counts for the given bank ids, cached for 10 minutes; ids under the floor are left out. */
export function mcqStats(ids: readonly string[], now = Date.now()) {
  const known = [...new Set(ids)].filter((id) => bank.has(id));
  const stale = known.filter((id) => !(now - (cache.get(id)?.at ?? -Infinity) < TTL));
  if (stale.length) {
    const marks = stale.map(() => '?').join(',');
    const db = sqlite();
    const totals = new Map(
      (
        db
          .prepare(`SELECT question_id id, COUNT(*) n, SUM(correct) r FROM mcq_answers WHERE question_id IN (${marks}) GROUP BY question_id`)
          .all(...stale) as { id: string; n: number; r: number }[]
      ).map((row) => [row.id, row]),
    );
    const picks = db
      .prepare(
        `SELECT a.question_id id, j.value pick, COUNT(*) n FROM mcq_answers a, json_each(a.picks) j
          WHERE a.question_id IN (${marks}) GROUP BY a.question_id, j.value`,
      )
      .all(...stale) as { id: string; pick: number; n: number }[];
    for (const id of stale) {
      const total = totals.get(id);
      let stat: McqStat | null = null;
      if (total && total.n >= MCQ_STATS_MIN) {
        stat = { n: total.n, right: total.r, picks: bank.get(id)!.en.choices.map(() => 0) };
        for (const row of picks) if (row.id === id && row.pick < stat.picks.length) stat.picks[row.pick] = row.n;
      }
      cache.set(id, { at: now, stat });
    }
  }
  const out: Record<string, McqStat> = {};
  for (const id of known) {
    const stat = cache.get(id)?.stat;
    if (stat) out[id] = stat;
  }
  return out;
}

/**
 * /api/oj/mcq/answers (POST, signed in), /api/oj/mcq/stats?ids=a,b (GET, anyone) and
 * /api/oj/mcq/questions?ids=a,b&lang=zh (GET, anyone): bank questions in one language with their
 * answers, for a review that should not load the whole bank (components/review-session.tsx).
 * Aptitude ids (`apt-<kind>-<seed>`, lib/aptitude.ts) are generated here with their figure.
 */
export async function handleMcqStats(request: Request, p: Person | null, [what]: string[]) {
  if (request.method === 'GET' && what === 'questions') {
    await limitReader(request, p, 'mcq-questions-read', 60);
    const params = new URL(request.url).searchParams;
    const ids = (params.get('ids') || '').split(',').filter(Boolean);
    if (ids.length > IDS_MAX) throw new HttpError(400, '一次最多查询 50 道题');
    const lang = params.get('lang') === 'zh' ? 'zh' : 'en';
    return json({
      items: [...new Set(ids)].flatMap((id) => {
        const q = bank.get(id) ?? aptitudeById(id);
        return q ? [{ id, section: q.section, topic: q.topic, code: q.code, answer: q.answer, text: q[lang], fig: 'fig' in q ? q.fig : undefined }] : [];
      }),
    });
  }
  if (request.method === 'GET' && what === 'stats') {
    await limitReader(request, p, 'mcq-stats-read', 120);
    const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean);
    if (ids.length > IDS_MAX) throw new HttpError(400, '一次最多查询 50 道题');
    return json({ items: mcqStats(ids) });
  }
  if (request.method === 'POST' && what === 'answers') {
    requirePerson(p);
    requireVerified(p);
    await limit(p, 'mcq-write', 120, 3600);
    return json(recordMcqAnswer(p.id, await readJson(request, 1000)));
  }
  throw new HttpError(404, '接口不存在');
}
