import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { employerSlug } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { shownOaSql } from './env';
import { HttpError, json, limit, limitReader, requirePerson } from './http';
import { HANDLE, reportCompanies } from './learner-cloud';
import { readJson } from './my-practice';

/**
 * Following learners (db/user-follows-schema.ts). Only a visible profile can be followed, and
 * follower and following lists name only learners whose own profile is visible: nobody shows
 * up anywhere without having opted in. The weekly board shares what profiles already show
 * (accepted problem counts), for the people the reader follows.
 */
const DAY = 86400000;
// ponytail: a flat cap keeps a scripted client from following every profile.
export const FOLLOW_MAX = 1000;
const LIST_MAX = 200;

/** A visible profile's account id, or null (hidden and missing look the same). */
function visibleUser(h: string) {
  // HANDLE only inside functions: learner-cloud imports this module back (mutualFollow).
  return HANDLE.test(h.toLowerCase())
    ? ((
        sqlite().prepare('SELECT user_id FROM user_profiles WHERE handle=? AND visible=1').get(h.toLowerCase()) as
          | { user_id: string }
          | undefined
      )?.user_id ?? null)
    : null;
}
const counts = (userId: string) =>
  sqlite()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM user_follows f JOIN user_profiles p ON p.user_id=f.follower_id AND p.visible=1
        WHERE f.followee_id=@u) AS followers,
      (SELECT COUNT(*) FROM user_follows f JOIN user_profiles p ON p.user_id=f.followee_id AND p.visible=1
        WHERE f.follower_id=@u) AS followees`,
    )
    .get({ u: userId }) as { followers: number; followees: number };

/** /u/<handle>/followers and /following: visible profiles only, newest first; null when the page is off. */
export function followPeople(h: string, which: 'followers' | 'following') {
  const userId = visibleUser(h);
  if (!userId) return null;
  const [mine, theirs] = which === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id'];
  const items = sqlite()
    .prepare(
      `SELECT p.handle,p.bio FROM user_follows f JOIN user_profiles p ON p.user_id=f.${theirs} AND p.visible=1
      WHERE f.${mine}=? ORDER BY f.created_at DESC,p.handle LIMIT ${LIST_MAX}`,
    )
    .all(userId) as { handle: string; bio: string }[];
  return { handle: h.toLowerCase(), items, ...counts(userId) };
}

/**
 * Distinct LeetCode and OA problems accepted since this local Monday by the reader and the
 * visible profiles they follow. `tz` is Date#getTimezoneOffset minutes, rounded to whole hours.
 */
export function followBoard(p: Person, tz = 0, now = Date.now()) {
  const db = sqlite();
  const shift = Math.round(Math.max(-900, Math.min(900, tz)) / 60) * 3600000;
  const today = Math.floor((now - shift) / DAY);
  const monday = today - ((today + 3) % 7); // 1970-01-01 was a Thursday.
  const people = new Map<string, string | null>(
    (
      db
        .prepare(
          `SELECT f.followee_id AS u,p.handle FROM user_follows f
          JOIN user_profiles p ON p.user_id=f.followee_id AND p.visible=1 WHERE f.follower_id=? LIMIT ${FOLLOW_MAX}`,
        )
        .all(p.id) as { u: string; handle: string }[]
    ).map((r) => [r.u, r.handle]),
  );
  const self =
    (db.prepare('SELECT handle FROM user_profiles WHERE user_id=? AND visible=1').get(p.id) as
      | { handle: string }
      | undefined)?.handle ?? null;
  const ids = [p.id, ...people.keys()];
  const week = new Map(
    (
      db
        .prepare(
          `SELECT user_id AS u,COUNT(DISTINCT problem_id) AS n FROM submissions
          WHERE user_id IN (SELECT value FROM json_each(?)) AND mode='judge' AND status='accepted' AND created_at>=?
            AND (problem_id LIKE 'lc-%' OR problem_id LIKE 'oa-%')${shownOaSql('problem_id')}
          GROUP BY user_id`,
        )
        .all(JSON.stringify(ids), monday * DAY + shift) as { u: string; n: number }[]
    ).map((r) => [r.u, r.n]),
  );
  const items = [
    { handle: self, n: week.get(p.id) ?? 0, me: true },
    ...[...people].map(([u, h]) => ({ handle: h, n: week.get(u) ?? 0, me: false })),
  ].sort((a, b) => b.n - a.n || Number(b.me) - Number(a.me) || (a.handle ?? '').localeCompare(b.handle ?? ''));
  return { following: people.size, since: monday * DAY + shift, items: items.slice(0, 50) };
}

const edge = (from: string, to: string) =>
  !!sqlite().prepare('SELECT 1 FROM user_follows WHERE follower_id=? AND followee_id=?').get(from, to);
/** Two accounts that follow each other (the compare page's shared count). */
export const mutualFollow = (a: string, b: string) => edge(a, b) && edge(b, a);

/** Companies a learner may follow (lib/server/company-follows.ts tells them what's new). */
const COMPANY_FOLLOW_MAX = 20;
/** The reader's followed companies that still have a page, oldest follow first; [] signed out. */
function followedCompanies(p: Person | null) {
  if (!p) return [];
  const names = new Map(reportCompanies().map((c) => [c.slug, c.name]));
  return (
    sqlite().prepare('SELECT company_slug FROM company_follows WHERE user_id=? ORDER BY created_at').pluck().all(p.id) as string[]
  ).flatMap((slug) => (names.has(slug) ? [{ slug, name: names.get(slug)! }] : []));
}
/** follows/companies: GET the list (signed out too, for the button), POST {slug,on}. */
async function handleCompanyFollows(request: Request, p: Person | null) {
  if (request.method === 'GET') {
    await limitReader(request, p, 'follows-read', 120);
    return json({ signedIn: !!p, items: followedCompanies(p) });
  }
  requirePerson(p);
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'company-follow-write', 30);
  const d = z
    .object({ slug: z.string().max(80), on: z.boolean() })
    .strict()
    .parse(await readJson(request, 300));
  const slug = employerSlug(d.slug);
  if (!reportCompanies().some((c) => c.slug === slug)) throw new HttpError(404, '公司不存在');
  const db = sqlite();
  if (!d.on) db.prepare('DELETE FROM company_follows WHERE user_id=? AND company_slug=?').run(p.id, slug);
  else {
    const followed = db.prepare('SELECT company_slug FROM company_follows WHERE user_id=?').pluck().all(p.id) as string[];
    if (followed.length >= COMPANY_FOLLOW_MAX && !followed.includes(slug))
      throw new HttpError(409, '最多关注 20 家公司');
    db.prepare('INSERT INTO company_follows(user_id,company_slug,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(
      p.id,
      slug,
      Date.now(),
    );
  }
  return json({ signedIn: true, items: followedCompanies(p) });
}

/**
 * /api/oj/follows/…: GET ?handle= (the button's state, signed out too), GET board, POST {handle,on};
 * follows/companies for companies.
 */
export async function handleFollows(request: Request, p: Person | null, path: string[]) {
  const [action, extra] = path;
  if (action === 'companies' && extra === undefined) return handleCompanyFollows(request, p);
  if (extra !== undefined) throw new HttpError(404, '接口不存在');
  const params = new URL(request.url).searchParams;
  if (request.method === 'GET') {
    await limitReader(request, p, 'follows-read', 120);
    if (action === 'board') {
      requirePerson(p);
      return json(followBoard(p, Number(params.get('tz')) || 0));
    }
    if (action) throw new HttpError(404, '接口不存在');
    const userId = visibleUser(params.get('handle') ?? '');
    if (!userId) throw new HttpError(404, '主页不存在');
    return json({ following: !!p && edge(p.id, userId), self: p?.id === userId, signedIn: !!p, ...counts(userId) });
  }
  requirePerson(p);
  if (request.method !== 'POST' || action) throw new HttpError(404, '接口不存在');
  await limit(p, 'follow-write', 30);
  const d = z
    .object({ handle: z.string().max(40), on: z.boolean() })
    .strict()
    .parse(await readJson(request, 500));
  const userId = visibleUser(d.handle);
  if (!userId) throw new HttpError(404, '主页不存在');
  if (userId === p.id) throw new HttpError(400, '不能关注自己');
  const db = sqlite();
  if (d.on) {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM user_follows WHERE follower_id=?').get(p.id) as { n: number };
    if (n >= FOLLOW_MAX) throw new HttpError(409, '关注人数已达上限');
    db.prepare(
      'INSERT INTO user_follows(follower_id,followee_id,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING',
    ).run(p.id, userId, Date.now());
  } else db.prepare('DELETE FROM user_follows WHERE follower_id=? AND followee_id=?').run(p.id, userId);
  // The button swaps in this answer.
  return json({ following: d.on, self: false, signedIn: true, ...counts(userId) });
}
