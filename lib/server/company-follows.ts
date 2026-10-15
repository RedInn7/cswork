import { sqlite } from '@/db/sqlite';
import { oaCompanyPath, oaProblemPath } from '@/lib/oa-company-brands';
import { notify } from './notify';
import { oaReadyProblems } from './oa-judge';

/**
 * New OA problems at the companies a learner follows (db/user-follows-schema.ts): one in-app notice
 * a day, from Beijing 09:00, run by the judge worker's reminder tick (lib/server/oj-worker.ts). Each
 * follow covers the problems that went online since its last digest (or since the follow), so
 * nothing is lost while the worker is down; every due follow then moves on, notice or not.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;

export async function sendCompanyDigest(now = Date.now()) {
  // Today's Beijing 09:00 (UTC+8, no daylight saving).
  const cutoff = Math.floor((now + 8 * HOUR) / DAY) * DAY + HOUR;
  if (now < cutoff) return 0;
  const db = sqlite();
  const due = db
    .prepare(
      `SELECT user_id,company_slug,COALESCE(last_digest_at,created_at) AS since FROM company_follows
      WHERE COALESCE(last_digest_at,created_at)<?`,
    )
    .all(cutoff) as { user_id: string; company_slug: string; since: number }[];
  if (!due.length) return 0;
  const oldest = due.reduce((min, f) => Math.min(min, f.since), now);
  // Loaded only once a day something is due: the catalog stays out of the worker otherwise.
  const { oaLibrary } = await import('./oa-library');
  const library = oaLibrary();
  const added = new Map<string, { at: number; path: string; name: string }[]>();
  for (const [id, { firstAt }] of await oaReadyProblems()) {
    const found = firstAt >= oldest && firstAt < now ? library.problem(id) : undefined;
    if (!found) continue;
    const problem = { at: firstAt, path: oaProblemPath(found.item.companySlug, id), name: found.company.name };
    const list = added.get(found.company.slug);
    if (list) list.push(problem);
    else added.set(found.company.slug, [problem]);
  }
  const byUser = Map.groupBy(due, (f) => f.user_id);
  const date = new Date(now + 8 * HOUR).toISOString().slice(0, 10);
  const moved = db.prepare('UPDATE company_follows SET last_digest_at=? WHERE user_id=? AND company_slug=?');
  let sent = 0;
  for (const [userId, follows] of byUser) {
    const news = follows.flatMap((f) => {
      const fresh = (added.get(f.company_slug) ?? []).filter((p) => p.at >= f.since);
      return fresh.length ? [{ slug: f.company_slug, problems: fresh }] : [];
    });
    const total = news.reduce((n, c) => n + c.problems.length, 0);
    db.transaction(() => {
      if (total) {
        notify({
          id: `follow-oa:${date}:${userId}`,
          userId,
          kind: 'company-oa',
          title: `关注的公司上线了 ${total} 道新 OA 题`,
          body: news.map((c) => `${c.problems[0].name} ${c.problems.length}`).join(' · '),
          href: total === 1 ? news[0].problems[0].path : oaCompanyPath(news[0].slug),
          now,
        });
        sent++;
      }
      for (const f of follows) moved.run(now, userId, f.company_slug);
    })();
  }
  return sent;
}
