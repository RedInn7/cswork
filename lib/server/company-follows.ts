import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sqlite } from '@/db/sqlite';
import lcMapFile from '@/lib/content/company-lc-map.json';
import { JOB_SEARCH_NOTE, matchesSearch, searchQuery, type JobSearch } from '@/lib/job-tags';
import { canonicalCompany, companyHubPath, oaCompanyPath, oaProblemPath } from '@/lib/oa-company-brands';
import { hiddenCompanies } from './env';
import { parseJobSearch } from './job-openings';
import { notify } from './notify';
import { oaReadyProblems } from './oa-judge';
import { pushTo } from './web-push';

/**
 * New OA problems and new-grad or intern openings (lib/server/job-openings.ts) at the companies a
 * learner follows (db/user-follows-schema.ts): one in-app notice a day, from Beijing 09:00, run by
 * the judge worker's reminder tick (lib/server/oj-worker.ts). Each follow covers what appeared
 * since its last digest (or since the follow), so nothing is lost while the worker is down; every
 * due follow then moves on, notice or not. A learner's saved /career/jobs search (note
 * career:jobs-search) adds the openings first seen in the 24 hours before 09:00 that match it, in
 * the same one notice, pushed when push is on.
 */
const HOUR = 3600000;
const DAY = 24 * HOUR;

// What a board's first sync found (its own row keeps that time) is no news. MAX: a remapped board's old row lingers.
const NOT_FIRST_SYNC = `first_seen_at>(SELECT MAX(first_seen_at) FROM job_openings WHERE company_slug=j.company_slug AND kind='board')`;

/** Each saved search's matches among the openings first seen in [cutoff - 24 h, cutoff): userId → the search and the matches' companies. */
function searchMatches(cutoff: number) {
  const db = sqlite();
  const saved = db.prepare('SELECT user_id AS userId,body FROM user_notes WHERE target=?').all(JOB_SEARCH_NOTE) as { userId: string; body: string }[];
  const matches = new Map<string, { search: JobSearch; slugs: string[] }>();
  if (!saved.length) return matches;
  const hidden = hiddenCompanies();
  const fresh = (
    db
      .prepare(
        `SELECT company_slug AS companySlug,title,location,kind,pay_unit AS unit FROM job_openings j
        WHERE first_seen_at>=? AND first_seen_at<? AND kind<>'board' AND ${NOT_FIRST_SYNC}`,
      )
      .all(cutoff - DAY, cutoff) as { companySlug: string; title: string; location: string; kind: string; unit: string }[]
  ).flatMap((o) => (hidden.has(o.companySlug) ? [] : [{ ...o, pay: o.unit || null }]));
  if (!fresh.length) return matches;
  for (const { userId, body } of saved) {
    const search = parseJobSearch(body);
    const slugs = search ? fresh.filter((o) => matchesSearch(o, search)).map((o) => o.companySlug) : [];
    if (search && slugs.length) matches.set(userId, { search, slugs });
  }
  return matches;
}
// ponytail: an in-process day marker keeps the saved-search scan (user_notes by target, no index) to
// one a day; after a worker restart the day's notice id stops a second notice.
let searchedFor = 0;

export async function sendCompanyDigest(now = Date.now()) {
  // Today's Beijing 09:00 (UTC+8, no daylight saving).
  const cutoff = Math.floor((now + 8 * HOUR) / DAY) * DAY + HOUR;
  if (now < cutoff) return 0;
  const db = sqlite();
  const searched: ReturnType<typeof searchMatches> = searchedFor === cutoff ? new Map() : searchMatches(cutoff);
  searchedFor = cutoff;
  const due = db
    .prepare(
      `SELECT user_id,company_slug,COALESCE(last_digest_at,created_at) AS since FROM company_follows
      WHERE COALESCE(last_digest_at,created_at)<?`,
    )
    .all(cutoff) as { user_id: string; company_slug: string; since: number }[];
  if (!due.length && !searched.size) return 0;
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
  // Openings first seen in the window, not on a board's first sync (lib/server/job-openings.ts).
  const hidden = hiddenCompanies();
  const opened = Map.groupBy(
    (
      db
        .prepare(
          `SELECT company_slug AS slug,first_seen_at AS at FROM job_openings j WHERE first_seen_at>=? AND first_seen_at<? AND kind<>'board'
          AND ${NOT_FIRST_SYNC}`,
        )
        .all(oldest, now) as { slug: string; at: number }[]
    ).filter((j) => !hidden.has(j.slug)),
    (j) => j.slug,
  );
  const byUser = Map.groupBy(due, (f) => f.user_id);
  const date = new Date(now + 8 * HOUR).toISOString().slice(0, 10);
  const moved = db.prepare('UPDATE company_follows SET last_digest_at=? WHERE user_id=? AND company_slug=?');
  let sent = 0;
  for (const userId of new Set([...byUser.keys(), ...searched.keys()])) {
    const follows = byUser.get(userId) ?? [];
    const news = follows.flatMap((f) => {
      const fresh = (added.get(f.company_slug) ?? []).filter((p) => p.at >= f.since);
      const openings = (opened.get(f.company_slug) ?? []).filter((j) => j.at >= f.since).length;
      return fresh.length || openings ? [{ slug: f.company_slug, problems: fresh, openings }] : [];
    });
    const total = news.reduce((n, c) => n + c.problems.length, 0);
    const openings = news.reduce((n, c) => n + c.openings, 0);
    const line = (c: (typeof news)[number]) => `${names.get(c.slug) ?? c.slug} ${c.problems.length + c.openings}`;
    const jobsId = `jobs:${date}:${userId}`;
    const matched = searched.get(userId);
    // After a worker restart the day's search notice is already out.
    const search = matched && !db.prepare('SELECT 1 FROM notifications WHERE id=?').get(jobsId) ? matched : null;
    db.transaction(() => {
      if (search) {
        const n = search.slugs.length;
        const counts = [...Map.groupBy(search.slugs, (slug) => slug)].map(([slug, list]) => `${names.get(slug) ?? slug} ${list.length}`);
        notify({
          id: jobsId,
          userId,
          kind: 'company-jobs',
          title: total || openings ? `保存的筛选有 ${n} 个新岗位，关注的公司有 ${total + openings} 条新动态` : `保存的筛选有 ${n} 个新岗位`,
          // A followed company the search already names is not listed twice; the title has both counts.
          body: [...counts, ...news.filter((c) => !search.slugs.includes(c.slug)).map(line)].join(' · '),
          href: `/career/jobs?${searchQuery(search.search)}`,
          now,
        });
        sent++;
      } else if (total || openings) {
        notify({
          id: `follow-oa:${date}:${userId}`,
          userId,
          kind: 'company-oa',
          // OA problems alone keep their own title; with openings it is the general one.
          title: openings ? `关注的公司有 ${total + openings} 条新动态` : `关注的公司上线了 ${total} 道新 OA 题`,
          body: news.map(line).join(' · '),
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
    if (search) await pushTo(userId, now);
  }
  return sent;
}
