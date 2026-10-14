import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { problemAppHref } from '@/lib/classic-lists';
import { threadPath } from '@/lib/community';
import { oaProblemPath } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { dailyProblem } from './daily-problem';
import { hiddenCompanies, origin } from './env';
import { memberExperiencePath, memberIdOf, readMember, recentMemberExperiences } from './experience-submissions';
import { boundedText, HttpError, json, limit, limitReader, requirePerson } from './http';
import { mailReady, newsletterConfirmation, sendMail } from './mail';
import { readJson } from './my-practice';
import { oaLibrary } from './oa-library';
import { oaReadyProblems } from './oa-judge';
import { publicPost, publicPosts } from './solution-posts';

/**
 * The weekly newsletter (db/newsletter-schema.ts). Signed-in learners with a verified email
 * subscribe; the double opt-in mail goes out once mail is configured, and only confirmed
 * subscribers get issues. scripts/newsletter.ts composes an issue from the site's own data and
 * sends it; the issues are public at /newsletter.
 */
const DAY = 86400000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** The ISO week holding `ms` (UTC): its id (2026-W42) and Monday 00:00 UTC. */
export function isoWeek(ms: number) {
  const day = Math.floor(ms / DAY);
  const monday = day - ((day + 3) % 7); // 1970-01-01 was a Thursday.
  const year = new Date((monday + 3) * DAY).getUTCFullYear(); // The week's Thursday names its year.
  const week = Math.floor((monday + 3 - Date.UTC(year, 0, 1) / DAY) / 7) + 1;
  return { id: `${year}-W${pad(week)}`, start: monday * DAY };
}
/** Monday 00:00 UTC of an ISO week id, or null when it is not one. */
export function weekStart(id: string) {
  const m = /^(\d{4})-W(\d{2})$/.exec(id);
  if (!m) return null;
  const jan4 = Date.UTC(Number(m[1]), 0, 4) / DAY; // Always in week 1.
  const start = (jan4 - ((jan4 + 3) % 7) + (Number(m[2]) - 1) * 7) * DAY;
  return Number(m[2]) >= 1 && isoWeek(start).id === id ? start : null;
}

export type Issue = {
  id: string;
  startsAt: number;
  /** OA problems that went online this week (judgeable here). */
  problems: { id: string; title: string; company: string; companyName: string; href: string }[];
  /** Member interview experiences approved this week. */
  experiences: { id: string; title: string; company: string; companyName: string; href: string }[];
  /** This week's discussion threads, most upvoted first. */
  discussions: { id: string; title: string; href: string; votes: number; comments: number }[];
  /** The week's daily problems and how many learners solved each on its day. */
  daily: { date: string; title: string; titleEn: string | null; company: string | null; href: string; solvers: number }[];
};
const TOP = 8;

async function newProblems(start: number, end: number) {
  const ready = await oaReadyProblems();
  const addedAt = new Map([...ready].map(([id, meta]) => [id, meta.firstAt]));
  const found: Issue['problems'] = [];
  // Newest first, a page at a time, until the pages reach problems older than the week.
  for (let page = 1; page <= 20 && found.length < TOP; page++) {
    const { items } = oaLibrary().list(new URLSearchParams({ sort: 'new', page: String(page) }), new Set(ready.keys()), {
      addedAt,
    });
    for (const item of items) {
      const at = addedAt.get(item.id) ?? 0;
      if (at >= start && at < end && found.length < TOP)
        found.push({
          id: item.id,
          title: item.title,
          company: item.companySlug,
          companyName: item.companyName,
          href: oaProblemPath(item.companySlug, item.id),
        });
    }
    if (!items.length || (addedAt.get(items.at(-1)!.id) ?? 0) < start) break;
  }
  return found;
}

async function topDiscussions(start: number, end: number) {
  const found: Issue['discussions'] = [];
  // Newest first through the public board (its visibility rules), then by votes. As far back as
  // listPosts pages (offset 5000), so recomposing an older week still reaches it.
  for (let offset = 0; offset <= 5000; offset += 30) {
    const page = await publicPosts('discuss:all', { sort: 'new', offset: String(offset) });
    for (const post of page?.items ?? [])
      if (post.createdAt >= start && post.createdAt < end)
        found.push({ id: post.id, title: post.title, href: threadPath(post.id), votes: post.votes, comments: post.comments });
    if (!page?.more || (page.items.at(-1)?.createdAt ?? 0) < start) break;
  }
  return found.sort((a, b) => b.votes - a.votes || b.comments - a.comments).slice(0, 5);
}

async function dailies(start: number) {
  const db = sqlite();
  const out: Issue['daily'] = [];
  for (let i = 0; i < 7; i++) {
    // Daily problems change on the Beijing date.
    const date = new Date(start + i * DAY).toISOString().slice(0, 10);
    const from = Date.parse(`${date}T00:00:00+08:00`);
    const daily = await dailyProblem([], from + DAY / 2);
    if (!daily) continue;
    const { n } = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) AS n FROM submissions WHERE problem_id=? AND mode='judge' AND status='accepted'
        AND created_at>=? AND created_at<?`,
      )
      .get(daily.id, from, from + DAY) as { n: number };
    out.push({
      date,
      title: daily.title,
      titleEn: daily.titleEn ?? null,
      company: daily.company?.slug ?? null,
      href: daily.company ? oaProblemPath(daily.company.slug, daily.id) : problemAppHref(daily.id),
      solvers: n,
    });
  }
  return out;
}

/** The issue for the ISO week starting `start`, from what the site published that week. */
export async function composeIssue(start: number): Promise<Issue> {
  const end = start + 7 * DAY;
  const experiences = recentMemberExperiences(start, TOP, end).items.map((e) => ({
    id: memberIdOf(e.slug)!,
    title: e.title,
    company: e.company.slug,
    companyName: e.company.name,
    href: memberExperiencePath(memberIdOf(e.slug)!),
  }));
  return {
    id: isoWeek(start).id,
    startsAt: start,
    problems: await newProblems(start, end),
    experiences,
    discussions: await topDiscussions(start, end),
    daily: await dailies(start),
  };
}
/** Stores (or recomposes, until it is sent) the issue. */
export function saveIssue(issue: Issue, now = Date.now()) {
  sqlite()
    .prepare(
      `INSERT INTO newsletter_issues(id,starts_at,data_json,composed_at) VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,composed_at=excluded.composed_at WHERE sent_at IS NULL`,
    )
    .run(issue.id, issue.startsAt, JSON.stringify(issue), now);
}

/** Archived issues, newest first. */
export function issueList() {
  return sqlite()
    .prepare('SELECT id,starts_at AS startsAt FROM newsletter_issues ORDER BY starts_at DESC LIMIT 300')
    .all() as { id: string; startsAt: number }[];
}
/**
 * An archived issue, less anything no longer public since it was composed: companies hidden
 * since, and posts or reports taken down by their author or a moderator.
 */
export async function readIssue(id: string): Promise<Issue | null> {
  const row = sqlite().prepare('SELECT data_json FROM newsletter_issues WHERE id=?').get(id) as
    | { data_json: string }
    | undefined;
  if (!row) return null;
  const issue = JSON.parse(row.data_json) as Issue;
  const hidden = hiddenCompanies();
  const shown = <T extends { company: string | null }>(items: T[]) => items.filter((i) => !i.company || !hidden.has(i.company));
  const live = await Promise.all(issue.discussions.map((d) => publicPost(d.id)));
  return {
    ...issue,
    problems: shown(issue.problems),
    experiences: shown(issue.experiences).filter((e) => readMember(e.id, null)),
    discussions: issue.discussions.filter((_, i) => live[i]),
    daily: shown(issue.daily),
  };
}

type Sub = {
  user_id: string;
  email: string;
  locale: string;
  token: string;
  confirmed_at: number | null;
  confirm_sent_at: number | null;
  unsubscribed_at: number | null;
};
const subOf = (user: string) =>
  sqlite().prepare('SELECT * FROM newsletter_subs WHERE user_id=?').get(user) as Sub | undefined;
const linkFor = (path: string, token: string) => `${origin()}${path}?token=${token}`;
/** How long before a lost confirmation mail may be sent again. */
const RESEND_AFTER = DAY;
export const unsubscribeUrl = (token: string) => linkFor('/api/newsletter/unsubscribe', token);
export const confirmUrl = (token: string) => linkFor('/api/newsletter/confirm', token);

/**
 * The double opt-in mail; never throws. Not confirmed a day later (spam folder, deleted)? The
 * learner subscribes again and it goes out again; the script only sends the ones deferred
 * while mail was off, so nobody gets weekly reminders they never asked for.
 */
export async function sendConfirmation(sub: Pick<Sub, 'user_id' | 'email' | 'locale' | 'token'>, now = Date.now()) {
  if (!mailReady()) return false;
  try {
    await sendMail({
      to: sub.email,
      ...newsletterConfirmation(sub.locale === 'zh', confirmUrl(sub.token)),
      // Per day: a resend a day later is a new mail, not a deduplicated retry.
      key: `cswork-newsletter-confirm-${sub.token}-${Math.floor(now / RESEND_AFTER)}`,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl(sub.token)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
  } catch (error) {
    console.error('newsletter confirm', error instanceof Error ? error.message : 'unknown');
    return false;
  }
  sqlite().prepare('UPDATE newsletter_subs SET confirm_sent_at=? WHERE user_id=?').run(now, sub.user_id);
  return true;
}

const resendable = (sub: Sub, now: number) =>
  sub.confirmed_at === null && (sub.confirm_sent_at === null || now - sub.confirm_sent_at >= RESEND_AFTER);
const status = (user: string, now = Date.now()) => {
  const sub = subOf(user);
  const on = !!sub && sub.unsubscribed_at === null;
  const mail = mailReady();
  return {
    subscribed: on,
    confirmed: on && sub.confirmed_at !== null,
    mail,
    // The confirmation went out over a day ago and was never clicked: offer to send it again.
    resend: on && mail && sub.confirm_sent_at !== null && resendable(sub, now),
  };
};

/** /api/oj/newsletter: the reader's subscription. */
export async function handleNewsletter(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  if (path.length) throw new HttpError(404, '接口不存在');
  if (request.method === 'GET') {
    await limit(p, 'newsletter-read', 60);
    return json(status(p.id));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'newsletter-write', 10);
  const d = z
    .object({ subscribe: z.boolean(), locale: z.enum(['zh', 'en']).optional() })
    .strict()
    .parse(await readJson(request, 500));
  const db = sqlite();
  const now = Date.now();
  if (!d.subscribe) {
    db.prepare('UPDATE newsletter_subs SET unsubscribed_at=? WHERE user_id=? AND unsubscribed_at IS NULL').run(now, p.id);
    return json(status(p.id));
  }
  if (!p.verified) throw new HttpError(403, '请先验证邮箱');
  const locale = d.locale ?? (request.headers.get('x-locale') === 'zh' ? 'zh' : 'en');
  // A changed address has to confirm again.
  db.prepare(
    `INSERT INTO newsletter_subs(user_id,email,locale,token,subscribed_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET locale=excluded.locale,subscribed_at=excluded.subscribed_at,unsubscribed_at=NULL,
      confirmed_at=CASE WHEN email=excluded.email THEN confirmed_at END,
      confirm_sent_at=CASE WHEN email=excluded.email THEN confirm_sent_at END,email=excluded.email`,
  ).run(p.id, p.email, locale, randomBytes(32).toString('base64url'), now);
  const sub = subOf(p.id)!;
  if (resendable(sub, now)) await sendConfirmation(sub, now);
  return json(status(p.id));
}

/**
 * /api/newsletter/confirm and /unsubscribe?token=: the links in the mails, answered before the
 * same-origin check (mail clients post List-Unsubscribe=One-Click from nowhere). Confirming
 * is a GET from the mail; unsubscribing is a POST, from the /newsletter/unsubscribe page or
 * the one-click header, so link scanners cannot unsubscribe anyone. A GET of the unsubscribe
 * URL lands on that page.
 */
export async function handleNewsletterLink(request: Request, action: string | undefined) {
  // Generous: mail providers send one-click unsubscribes from a few shared addresses in bursts,
  // and a 256-bit token is not guessable anyway; the limit only bounds the writes.
  await limitReader(request, null, 'newsletter-link', 600);
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const db = sqlite();
  const now = Date.now();
  if (action === 'confirm' && request.method === 'GET') {
    const done = TOKEN.test(token)
      ? db
          .prepare('UPDATE newsletter_subs SET confirmed_at=COALESCE(confirmed_at,?) WHERE token=? AND unsubscribed_at IS NULL')
          .run(now, token).changes
      : 0;
    return Response.redirect(`${origin()}/newsletter?${done ? 'confirmed' : 'invalid'}=1`, 303);
  }
  // Mail clients without RFC 8058 open the header's URL: they get the page with the button.
  if (action === 'unsubscribe' && request.method === 'GET')
    return Response.redirect(`${origin()}/newsletter/unsubscribe${TOKEN.test(token) ? `?token=${token}` : ''}`, 303);
  if (action === 'unsubscribe' && request.method === 'POST') {
    if (TOKEN.test(token))
      db.prepare('UPDATE newsletter_subs SET unsubscribed_at=COALESCE(unsubscribed_at,?) WHERE token=?').run(now, token);
    // RFC 8058 one-click posts this body; the page's form gets a page back.
    const oneClick = (await boundedText(request, 1000).catch(() => '')).includes('List-Unsubscribe=One-Click');
    return oneClick ? json({ unsubscribed: true }) : Response.redirect(`${origin()}/newsletter?unsubscribed=1`, 303);
  }
  throw new HttpError(404, '接口不存在');
}
