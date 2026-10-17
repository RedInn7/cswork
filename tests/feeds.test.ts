// Atom feeds (lib/server/feeds.ts, app/feeds/): escaping, hidden and unknown companies, a company
// feed's merge of OA problems, member reports and new roles (newest first, at most 50), the daily
// problems and the newsletter archive.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-feeds-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');
process.env.HIDDEN_COMPANIES = 'airbnb';
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
content.close();

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { saveIssue } = await import('../lib/server/newsletter');
const feeds = await import('../lib/server/feeds');
const companyRoute = await import('../app/feeds/company/[slug]/route');
const dailyRoute = await import('../app/feeds/daily.xml/route');
const newsletterRoute = await import('../app/feeds/newsletter.xml/route');

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const DAY = 86400000;
const now = Date.now();
const entries = (xml: string) =>
  [...xml.matchAll(/<entry><id>([^<]*)<\/id><title>([^<]*)<\/title><link rel="alternate" href="([^"]*)"\/><updated>([^<]*)<\/updated>/g)].map(
    ([, id, title, link, updated]) => ({ id, title, link, updated: Date.parse(updated) }),
  );
const person = (id: string, role: Person['role'] = 'student'): Person => ({ id, name: id, email: `${id}@example.test`, role, verified: true });
async function call(p: Person, path: string, body: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  const response = await handleOj(new Request(url, { method: 'POST', body: JSON.stringify(body) }), p, url.pathname.split('/').slice(3));
  // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
  return { status: response.status, data: (await response.json()) as any };
}
// Real OA problems with their trusted package checksums, published at chosen times.
const registry = JSON.parse(readFileSync('content/oa-judge/registry.json', 'utf8')) as { items: { id: string; packageChecksum: string }[] };
function publish(id: string, at: number) {
  const checksum = registry.items.find((i) => i.id === id)!.packageChecksum;
  const db = sqlite();
  db.prepare("INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,'oa','oa',0,?,?)").run(id, at, at);
  db.prepare("INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) VALUES(?,?,1,?,?,'t',?)").run(
    `${id}-v1`,
    id,
    // Enough of a statement for the public catalogue the daily problem draws from.
    JSON.stringify({ id, title: id, difficulty: 'Medium', description: 'd', input: 'i', output: 'o', explanation: 'e' }),
    checksum,
    at,
  );
  db.prepare('UPDATE oj_problems SET current_version_id=?,published=1 WHERE id=?').run(`${id}-v1`, id);
}
const job = (id: string, slug: string, kind: string, at: number, title = `Software Engineer ${id}`) =>
  sqlite()
    .prepare('INSERT INTO job_openings(id,company_slug,title,location,url,kind,first_seen_at,last_seen_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(id, slug, title, 'Seattle, WA', `https://boards.example.com/${encodeURIComponent(id)}`, kind, at, now);

void test('atomFeed escapes every field, keeps Chinese and drops control characters', () => {
  assert.equal(feeds.escapeXml(`a & b <c> "d" 'e' 中文\u0001\u000b`), 'a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos; 中文');
  const xml = feeds.atomFeed({
    id: '/feeds/x?lang=zh&a=1',
    title: 'R&D <新> 题',
    link: '/company/a&b',
    updated: Date.UTC(2026, 9, 15),
    lang: 'zh',
    entries: [{ id: 'tag:cswork.org,2026:x/1', title: 'Tom & "Jerry" 面经 <1>', link: 'https://example.com/?a=1&b=2', updated: Date.UTC(2026, 9, 14), summary: '<script>&' }],
  });
  assert.match(xml, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom" xml:lang="zh-CN">/);
  assert.match(xml, /<title>R&amp;D &lt;新&gt; 题<\/title>/);
  assert.match(xml, /<id>https:\/\/cswork.org\/feeds\/x\?lang=zh&amp;a=1<\/id>/);
  assert.match(xml, /<link rel="self" href="https:\/\/cswork.org\/feeds\/x\?lang=zh&amp;a=1"\/>/);
  assert.match(xml, /<title>Tom &amp; &quot;Jerry&quot; 面经 &lt;1&gt;<\/title>/);
  assert.match(xml, /href="https:\/\/example.com\/\?a=1&amp;b=2"/);
  assert.match(xml, /<summary>&lt;script&gt;&amp;<\/summary>/);
  assert.match(xml, /<updated>2026-10-15T00:00:00.000Z<\/updated>/);
  // No raw markup or ampersand outside the tags themselves.
  assert.doesNotMatch(xml.replace(/<\/?[a-z?][^<>]*>/g, ''), /[<>]|&(?!(amp|lt|gt|quot|apos);)/);
});

void test('hidden and unknown companies have no feed; aliases neither', async () => {
  const get = (slug: string, query = '') =>
    companyRoute.GET(new Request(`https://cswork.test/feeds/company/${slug}${query}`), { params: Promise.resolve({ slug }) });
  assert.equal(await feeds.companyFeed('airbnb', 'en'), null);
  assert.equal((await get('airbnb')).status, 404);
  assert.equal((await get('no-such-company')).status, 404);
  assert.equal((await get('Amazon')).status, 404);
  const ok = await get('amazon', '?lang=zh');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('content-type'), 'application/atom+xml; charset=utf-8');
  assert.equal(ok.headers.get('cache-control'), 'public, max-age=900');
  const xml = await ok.text();
  assert.match(xml, /xml:lang="zh-CN"/);
  assert.match(xml, /<link rel="alternate" href="https:\/\/cswork.org\/company\/amazon"\/>/);
  assert.match(xml, /<link rel="self" href="https:\/\/cswork.org\/feeds\/company\/amazon\?lang=zh"\/>/);
});

void test('a company feed: OA, reports and new roles, newest first, at most 50', async () => {
  publish('oa-amazon-114', now - 2 * DAY);
  publish('oa-amazon-116', now - 40 * DAY);
  publish('oa-airbnb-6', now - DAY); // Hidden company.
  // The board's first sync 40 days ago, with what was already up then: no news.
  job('greenhouse:amazon:', 'amazon', 'board', now - 40 * DAY, '');
  job('greenhouse:amazon:first', 'amazon', 'intern', now - 40 * DAY);
  job('greenhouse:amazon:old', 'amazon', 'intern', now - 35 * DAY); // Older than 30 days.
  for (let i = 0; i < 60; i++) job(`greenhouse:amazon:${i}`, 'amazon', i % 2 ? 'intern' : 'new-grad', now - 3 * DAY + i * 3600000);
  job('greenhouse:google:1', 'google', 'intern', now - 1000);

  const author = person('feed-author');
  const created = await call(author, 'oj/experiences', {
    company: 'amazon',
    title: 'Amazon SDE & intern loop',
    role: 'Software Engineer',
    rounds: ['Online Assessment', 'Onsite'],
    result: 'Offer',
    month: new Date().toISOString().slice(0, 7),
    body: 'Two coding rounds and one behavioral round, all in one day. '.repeat(3),
    questions: ['LRU cache'],
    agree: true,
  });
  assert.equal(created.status, 201);
  const id = created.data.member.id as string;
  assert.equal((await call(person('feed-teacher', 'teacher'), `oj/experiences/${id}/review`, { status: 'approved', note: '' })).status, 200);

  const xml = (await feeds.companyFeed('amazon', 'en', now))!;
  const list = entries(xml);
  assert.equal(list.length, feeds.COMPANY_FEED_MAX);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].updated >= list[i].updated, `sorted at ${i}`);
  // The newest roles and the report lead; the OA problem two days old is before the 50th entry's cutoff.
  assert.equal(list[0].title, 'Interview report: Amazon SDE &amp; intern loop');
  assert.equal(list[0].link, `https://cswork.org/library/experience-ugc/${id}`);
  assert.equal(list[1].title, 'Intern: Software Engineer greenhouse:amazon:59');
  assert.equal(list[1].link, 'https://boards.example.com/greenhouse%3Aamazon%3A59');
  const ids = list.map((e) => e.id);
  assert.ok(ids.includes('tag:cswork.org,2026:oa/oa-amazon-114'));
  assert.ok(!ids.some((e) => /oa-amazon-116|oa-airbnb|amazon%3A(first|old)|google/.test(e)), 'old, hidden, first-sync and other companies left out');
  assert.equal(new Set(ids).size, ids.length);
  // The feed is as new as its newest entry.
  assert.equal(Date.parse(/<updated>([^<]+)<\/updated>/.exec(xml)![1]), list[0].updated);
  // Fewer roles: older OA problems fill in.
  sqlite().prepare("DELETE FROM job_openings WHERE id LIKE 'greenhouse:amazon:_%'").run();
  const rest = entries((await feeds.companyFeed('amazon', 'zh', now))!);
  assert.deepEqual(
    rest.map((e) => e.id),
    [`tag:cswork.org,2026:experience/${id}`, 'tag:cswork.org,2026:oa/oa-amazon-114', 'tag:cswork.org,2026:oa/oa-amazon-116'],
  );
  assert.match(rest[0].title, /^面经：/);
});

void test('the daily feed: the last 14 Beijing days, today first', async () => {
  const response = await dailyRoute.GET(new Request('https://cswork.test/feeds/daily.xml'));
  assert.equal(response.status, 200);
  const list = entries(await response.text());
  // The published Amazon OAs stand in for the empty Line 500 pool on odd dates: one a day.
  assert.equal(list.length, 14);
  assert.match(list[0].link, /^https:\/\/cswork.org\/oa\/amazon\/oa-amazon-11[46]$/);
  const today = new Date(now + 8 * 3600000).toISOString().slice(0, 10);
  assert.equal(list[0].id, `tag:cswork.org,2026:daily/${today}`);
  for (let i = 1; i < list.length; i++) assert.equal(list[i - 1].updated - list[i].updated, DAY);
});

void test('the newsletter feed: the archived issues, newest first, linking to their pages', async () => {
  const issue = (id: string, startsAt: number, title: string) =>
    saveIssue({
      id,
      startsAt,
      problems: [{ id: 'oa-amazon-114', title, company: 'amazon', companyName: 'Amazon', href: '/oa/amazon/oa-amazon-114' }],
      experiences: [],
      discussions: [],
      daily: [],
    });
  issue('2026-W40', Date.UTC(2026, 8, 28), 'Older & <wiser>');
  issue('2026-W41', Date.UTC(2026, 9, 5), '新题 & more');
  const response = await newsletterRoute.GET(new Request('https://cswork.test/feeds/newsletter.xml?lang=zh'));
  const xml = await response.text();
  const list = entries(xml);
  assert.deepEqual(
    list.map((e) => [e.title, e.link]),
    [
      ['CSWork 周报 2026-W41', 'https://cswork.org/newsletter/2026-W41'],
      ['CSWork 周报 2026-W40', 'https://cswork.org/newsletter/2026-W40'],
    ],
  );
  assert.match(xml, /<summary>1 道新 OA 题、0 篇学员面经、0 个热门讨论和每日一题战报。 新题 &amp; more<\/summary>/);
  assert.match(xml, /Older &amp; &lt;wiser&gt;/);
  assert.equal(list[0].updated, Date.UTC(2026, 9, 12));
});

void test('pages announce their feed in the reader’s language', () => {
  const meta = feeds.withFeed({ alternates: { canonical: 'https://cswork.org/daily' } }, '/feeds/daily.xml', true);
  assert.deepEqual(meta.alternates, { canonical: 'https://cswork.org/daily', types: { 'application/atom+xml': '/feeds/daily.xml?lang=zh' } });
  assert.equal(feeds.feedPath('/feeds/daily.xml', false), '/feeds/daily.xml');
});
