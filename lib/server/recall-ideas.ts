import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedByNumber, curatedHint } from '@/lib/ling-curated';
import { firstParagraph } from '@/lib/speedrun';
import type { Person } from './auth';
import { runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { lingEditorial, lingFollowUps } from './ling-editorials';
import { getStudySourceStatement } from './study-library';

const IDS_MAX = 100;
const NOTE_CHARS = 4000;
const ids = z.array(z.string().regex(/^[\w.-]{1,120}$/)).max(IDS_MAX);

/**
 * GET /api/oj/recall/ideas?ids=a,b&lang=en: what the idea review (components/review-session.tsx)
 * shows for each problem: a statement excerpt, the curated hint, the best approach's complexity,
 * the Line 500 stop and the learner's own note. The editorial's takeaway only for problems the
 * learner has an accepted judge submission on; the editorial itself never, so it records no aid.
 * Problems of a contest or exam running for the learner are left out.
 */
export async function handleRecallIdeas(request: Request, p: Person) {
  if (request.method !== 'GET') throw new HttpError(404, '接口不存在');
  await limit(p, 'recall-ideas-read', 30);
  const params = new URL(request.url).searchParams;
  const asked = (params.get('ids') ?? '').split(',').filter(Boolean);
  if (asked.length > IDS_MAX) throw new HttpError(400, '一次最多查询 100 道题');
  const live = runningContestProblems(p.id);
  const wanted = [...new Set(ids.parse(asked))].filter((id) => !live.has(id));
  if (!wanted.length) return json({ items: [] });
  const en = params.get('lang') === 'en';
  const marks = wanted.map(() => '?').join(',');
  const db = sqlite();
  const solved = new Set(
    db
      .prepare(
        `SELECT DISTINCT problem_id FROM submissions
        WHERE user_id=? AND mode='judge' AND status='accepted' AND problem_id IN (${marks})`,
      )
      .pluck()
      .all(p.id, ...wanted) as string[],
  );
  const notes = new Map(
    (
      db
        .prepare(`SELECT target,substr(body,1,${NOTE_CHARS}) AS body FROM user_notes WHERE user_id=? AND target IN (${marks})`)
        .all(p.id, ...wanted.map((id) => `problem:${id}`)) as { target: string; body: string }[]
    ).map((row) => [row.target.slice('problem:'.length), row.body]),
  );
  return json({
    items: wanted.map((id) => {
      const source = getStudySourceStatement(id);
      const best = lingEditorial(id)?.approaches.at(-1);
      const follow = solved.has(id) ? lingFollowUps(id) : null;
      return {
        id,
        excerpt: source ? firstParagraph((en ? source.descriptionEn : source.descriptionZh) || source.descriptionEn || source.descriptionZh) : null,
        hint: curatedHint(id)?.[en ? 'en' : 'zh'] ?? null,
        complexity: best ? { time: best.time, space: best.space } : null,
        stop: curatedByNumber.get(Number(/^lc-(\d+)$/.exec(id)?.[1]))?.sectionSlug ?? null,
        takeaway: follow ? (en ? follow.takeawayEn : follow.takeawayZh) || null : null,
        note: notes.get(id) ?? null,
        solved: solved.has(id),
      };
    }),
  });
}
