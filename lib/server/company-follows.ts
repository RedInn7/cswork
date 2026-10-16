import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sqlite } from '@/db/sqlite';
import lcMapFile from '@/lib/content/company-lc-map.json';
import { canonicalCompany, companyHubPath, oaCompanyPath, oaProblemPath } from '@/lib/oa-company-brands';
import { hiddenCompanies } from './env';
import { notify } from './notify';
import { oaReadyProblems } from './oa-judge';

/**
 * New OA problems and new-grad or intern openings (lib/server/job-openings.ts) at the companies a
 * learner follows (db/user-follows-schema.ts): one in-app notice a day, from Beijing 09:00, run by
 * the judge worker's reminder tick (lib/server/oj-worker.ts). Each follow covers what appeared
 * since its last digest (or since the follow), so nothing is lost while the worker is down; every
 * due follow then moves on, notice or not.
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
  // The catalog read directly, as oaJudgeRegistry does: oa-library would pull the site's practice
  // code into the worker, and the worker ships as one file, so no lazy import (tests/oj-capacity-release.test.mjs).
  const catalog = JSON.parse(readFileSync(resolve('content/oa-master/catalog.json'), 'utf8')) as {
    companies: { slug: string; name: string }[];
    items: { id: string; companySlug: string }[];
  };
  // Followable companies outside the OA catalog (a board's SpaceX, Lyft) by the library's display name.
  const names = new Map([...Object.entries(lcMapFile.names), ...catalog.companies.map((c) => [c.slug, c.name] as const)]);
  const companyOf = new Map(catalog.items.map((i) => [i.id, i.companySlug]));
  const added = new Map<string, { at: number; path: string; name: string }[]>();
  // oaReadyProblems already leaves hidden companies out.
  for (const [id, { firstAt }] of await oaReadyProblems()) {
    const source = companyOf.get(id);
    if (!source || firstAt < oldest || firstAt >= now) continue;
    const slug = canonicalCompany(source);
    const problem = { at: firstAt, path: oaProblemPath(source, id), name: names.get(slug) ?? slug };
    const list = added.get(slug);
    if (list) list.push(problem);
    else added.set(slug, [problem]);
  }
  // Openings first seen in the window; what a board's first sync found (lib/server/job-openings.ts
  // keeps that time in the board's own row) is no news. MAX: a remapped board's old row lingers.
  const hidden = hiddenCompanies();
  const opened = Map.groupBy(
    (
      db
        .prepare(
          `SELECT company_slug AS slug,first_seen_at AS at FROM job_openings j WHERE first_seen_at>=? AND first_seen_at<? AND kind<>'board'
          AND first_seen_at>(SELECT MAX(first_seen_at) FROM job_openings WHERE company_slug=j.company_slug AND kind='board')`,
        )
        .all(oldest, now) as { slug: string; at: number }[]
    ).filter((j) => !hidden.has(j.slug)),
    (j) => j.slug,
  );
  const byUser = Map.groupBy(due, (f) => f.user_id);
  const date = new Date(now + 8 * HOUR).toISOString().slice(0, 10);
  const moved = db.prepare('UPDATE company_follows SET last_digest_at=? WHERE user_id=? AND company_slug=?');
  let sent = 0;
  for (const [userId, follows] of byUser) {
    const news = follows.flatMap((f) => {
      const fresh = (added.get(f.company_slug) ?? []).filter((p) => p.at >= f.since);
      const openings = (opened.get(f.company_slug) ?? []).filter((j) => j.at >= f.since).length;
      return fresh.length || openings ? [{ slug: f.company_slug, problems: fresh, openings }] : [];
    });
    const total = news.reduce((n, c) => n + c.problems.length, 0);
    const openings = news.reduce((n, c) => n + c.openings, 0);
    db.transaction(() => {
      if (total || openings) {
        notify({
          id: `follow-oa:${date}:${userId}`,
          userId,
          kind: 'company-oa',
          // OA problems alone keep their own title; with openings it is the general one.
          title: openings ? `关注的公司有 ${total + openings} 条新动态` : `关注的公司上线了 ${total} 道新 OA 题`,
          body: news.map((c) => `${names.get(c.slug) ?? c.slug} ${c.problems.length + c.openings}`).join(' · '),
          href: openings
            ? news.length === 1
              ? `${companyHubPath(news[0].slug)}#jobs`
              : '/career/jobs'
            : total === 1
              ? news[0].problems[0].path
              : oaCompanyPath(news[0].slug),
          now,
        });
        sent++;
      }
      for (const f of follows) moved.run(now, userId, f.company_slug);
    })();
  }
  return sent;
}
