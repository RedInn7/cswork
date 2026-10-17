import type { Metadata } from 'next';
import { sqlite } from '@/db/sqlite';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { companyHubPath, oaProblemPath } from '@/lib/oa-company-brands';
import { SITE_URL } from '@/lib/seo';
import { NOT_FIRST_SYNC } from './company-follows';
import { dailyProblem } from './daily-problem';
import { companyMemberExperiences, memberExperiencePath, memberIdOf } from './experience-submissions';
import { reportCompanies } from './learner-cloud';
import { issueList, readIssue } from './newsletter';
import { oaLibrary } from './oa-library';
import { oaReadyProblems } from './oa-judge';

/**
 * Atom feeds (/feeds/newsletter.xml, /feeds/company/<slug>, /feeds/daily.xml): the subscription
 * channel that needs no account and no mail. English by default like the site; `?lang=zh` is the
 * Chinese one. Links and ids are on the public origin, never the request host.
 */
const DAY = 86400000;
export type FeedEntry = { id: string; title: string; link: string; updated: number; summary?: string };
export type Feed = { id: string; title: string; link: string; updated: number; lang: 'zh' | 'en'; entries: FeedEntry[] };

const ENTITIES: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
/** Text or attribute content; control characters XML 1.0 forbids are dropped (member-written titles). */
export const escapeXml = (value: string) =>
  // oxlint-disable-next-line no-control-regex -- Matching control characters is the point.
  value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/[<>&"']/g, (c) => ENTITIES[c]);
const absolute = (link: string) => new URL(link, SITE_URL).href;
const time = (ms: number) => new Date(ms).toISOString();
/** A permanent entry id that is not a page URL (RFC 4151). */
const tag = (key: string) => `tag:cswork.org,2026:${key}`;

export function atomFeed(feed: Feed) {
  const text = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;
  const link = (href: string, rel = 'alternate') => `<link rel="${rel}" href="${escapeXml(absolute(href))}"/>`;
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${feed.lang === 'zh' ? 'zh-CN' : 'en'}">`,
    text('id', absolute(feed.id)),
    text('title', feed.title),
    link(feed.id, 'self'),
    link(feed.link),
    text('updated', time(feed.updated)),
    '<author><name>CSWork</name></author>',
    ...feed.entries.map((e) =>
      [
        '<entry>',
        text('id', e.id),
        text('title', e.title),
        link(e.link),
        text('updated', time(e.updated)),
        e.summary ? text('summary', e.summary) : '',
        '</entry>',
      ].join(''),
    ),
    '</feed>',
  ].join('\n');
}

export const feedResponse = (xml: string) =>
  new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
  });
/** The reader's language from `?lang=zh`; anything else is English. */
export const feedLocale = (request: Request) => (new URL(request.url).searchParams.get('lang') === 'zh' ? 'zh' : 'en');
/** A feed in the page's language. */
export const feedPath = (path: string, zh: boolean) => (zh ? `${path}?lang=zh` : path);
/** A page's metadata plus its feed: <link rel="alternate" type="application/atom+xml">. */
export const withFeed = (metadata: Metadata, path: string, zh: boolean): Metadata => ({
  ...metadata,
  alternates: { ...metadata.alternates, types: { 'application/atom+xml': feedPath(path, zh) } },
});
/** Newest first (ties by id, so the order is stable), at most `max`; the feed is as new as its newest entry. */
const newest = (entries: FeedEntry[], max: number, now: number) => {
  const sorted = entries.sort((a, b) => b.updated - a.updated || a.id.localeCompare(b.id)).slice(0, max);
  return { entries: sorted, updated: sorted[0]?.updated ?? now };
};

/** The latest 20 newsletter issues. */
export async function newsletterFeed(lang: 'zh' | 'en', now = Date.now()) {
  const zh = lang === 'zh';
  const issues = await Promise.all(issueList().slice(0, 20).map((i) => readIssue(i.id)));
  const entries = issues.flatMap((issue): FeedEntry[] => {
    if (!issue) return [];
    const titles = [...issue.problems, ...issue.experiences].map((i) => i.title).join(zh ? '；' : '; ');
    return [
      {
        id: tag(`newsletter/${issue.id}`),
        title: zh ? `CSWork 周报 ${issue.id}` : `The CSWork weekly ${issue.id}`,
        link: `/newsletter/${issue.id}`,
        // Composed once the week is over; a week still running is as new as now.
        updated: Math.min(issue.startsAt + 7 * DAY, now),
        summary:
          (zh
            ? `${issue.problems.length} 道新 OA 题、${issue.experiences.length} 篇学员面经、${issue.discussions.length} 个热门讨论和每日一题战报。`
            : `${issue.problems.length} new OA problems, ${issue.experiences.length} member interview reports, ${issue.discussions.length} top discussions and the daily problem results.`) +
          (titles ? ` ${titles}` : ''),
      },
    ];
  });
  return atomFeed({
    id: feedPath('/feeds/newsletter.xml', zh),
    title: zh ? 'CSWork 周报' : 'The CSWork weekly',
    link: '/newsletter',
    lang,
    ...newest(entries, 20, now),
  });
}

export const COMPANY_FEED_MAX = 50;
const JOBS_FOR = 30 * DAY;
const KIND: Record<string, [string, string]> = { intern: ['实习', 'Intern'], 'new-grad': ['新毕业生', 'New grad'] };

/** One company's newest 50: OA problems by when they went online, approved member reports, roles first seen in 30 days. Null when it has no page (hidden or unknown). */
export async function companyFeed(slug: string, lang: 'zh' | 'en', now = Date.now()) {
  const zh = lang === 'zh';
  const company = reportCompanies().find((c) => c.slug === slug);
  if (!company) return null;
  const ready = await oaReadyProblems();
  const oa = (oaLibrary().company(slug, new Set(ready.keys()))?.items ?? []).flatMap((item): FeedEntry[] => {
    const meta = ready.get(item.id);
    return meta
      ? [{ id: tag(`oa/${item.id}`), title: `${company.name} OA: ${item.title}`, link: oaProblemPath(item.companySlug, item.id), updated: meta.firstAt }]
      : [];
  });
  const reports = companyMemberExperiences(slug, COMPANY_FEED_MAX).items.map((e): FeedEntry => {
    const id = memberIdOf(e.slug)!;
    return {
      id: tag(`experience/${id}`),
      title: zh ? `面经：${e.title}` : `Interview report: ${e.title}`,
      link: memberExperiencePath(id),
      updated: Date.parse(e.publishedAt ?? '') || now,
      summary: e.summary ?? undefined,
    };
  });
  // Not the board's first sync: what was already up then is no news (lib/server/company-follows.ts).
  const jobs = (
    sqlite()
      .prepare(
        `SELECT id,title,location,url,kind,first_seen_at AS at FROM job_openings j
        WHERE company_slug=? AND kind<>'board' AND first_seen_at>=? AND ${NOT_FIRST_SYNC} ORDER BY first_seen_at DESC LIMIT ?`,
      )
      .all(slug, now - JOBS_FOR, COMPANY_FEED_MAX) as { id: string; title: string; location: string; url: string; kind: string; at: number }[]
  ).map(
    (j): FeedEntry => ({
      id: tag(`job/${encodeURIComponent(j.id)}`),
      title: `${KIND[j.kind]?.[zh ? 0 : 1] ?? j.kind}${zh ? '：' : ': '}${j.title}`,
      link: j.url,
      updated: j.at,
      summary: j.location || undefined,
    }),
  );
  return atomFeed({
    id: feedPath(`/feeds/company/${slug}`, zh),
    title: zh ? `${company.name} 新动态 · CSWork` : `${company.name} updates · CSWork`,
    link: companyHubPath(slug),
    lang,
    ...newest([...oa, ...reports, ...jobs], COMPANY_FEED_MAX, now),
  });
}

/** The daily problems of the last 14 Beijing days, today's first. */
export async function dailyFeed(lang: 'zh' | 'en', now = Date.now()) {
  const zh = lang === 'zh';
  const entries: FeedEntry[] = [];
  // Each day at or before now: a future `now` would park the daily source's cache ahead of the clock.
  for (let i = 0; i < 14; i++) {
    const daily = await dailyProblem([], now - i * DAY);
    if (!daily) continue;
    const level = levelOf(daily.difficulty);
    const source = daily.company ? `${daily.company.name} OA` : zh ? '500 路' : 'Line 500';
    entries.push({
      id: tag(`daily/${daily.date}`),
      title: zh ? `${daily.date} 每日一题：${daily.title}` : `Daily problem ${daily.date}: ${daily.titleEn || daily.title}`,
      link: daily.company ? oaProblemPath(daily.company.slug, daily.id) : problemAppHref(daily.id),
      updated: Date.parse(`${daily.date}T00:00:00+08:00`),
      summary: level ? `${source} · ${level[zh ? 1 : 2]}` : source,
    });
  }
  return atomFeed({
    id: feedPath('/feeds/daily.xml', zh),
    title: zh ? 'CSWork 每日一题' : 'CSWork daily problem',
    link: '/daily',
    lang,
    ...newest(entries, 14, now),
  });
}
