// Share cards (the opengraph-image routes): each draws with the bundled font subset only, so no
// learner's text ever goes to a font service; profiles, certificates and rated contests get their
// own card, hidden or private ones the site card; the certificate page links to LinkedIn and X.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { register } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const og = pathToFileURL(resolve('node_modules/vinext/dist/shims/og.js')).href;
register(
  `data:text/javascript,${encodeURIComponent(
    `export async function resolve(s,c,n){if(s==='next/og')return {url:${JSON.stringify(og)},shortCircuit:true};return n(s,c);}`,
  )}`,
  import.meta.url,
);
const dir = mkdtempSync(resolve(tmpdir(), 'cswork-share-cards-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
delete process.env.CONTENT_DATABASE_PATH;
const { sqlite } = await import('../db/sqlite');
const card = await import('../lib/server/og-card');
const { profileCard } = await import('../lib/server/learner-cloud');
const { contestCard } = await import('../lib/server/contests');
const { certificateById, certificateOwner } = await import('../lib/server/certificates');
const { seoMetadata } = await import('../lib/seo');
const { CertificateView, shareLinks } = await import('../app/certificate/view');
const profileImage = (await import('../app/u/[handle]/opengraph-image')).default;
const contestImage = (await import('../app/contest/[id]/opengraph-image')).default;
const certificateImage = (await import('../app/certificate/[id]/opengraph-image')).default;
const siteImage = (await import('../app/opengraph-image')).default;

// Every network fetch while drawing is a leak (satori asks Google Fonts for glyphs it lacks).
const fetched: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith('data:')) return realFetch(input, init);
  fetched.push(url);
  return Promise.reject(new Error('offline'));
}) as typeof fetch;

const catalogue = new Map([
  ['lc-1', { difficulty: '简单' }],
  ['lc-3', { difficulty: '中等' }],
  ['oa-amazon-1', { difficulty: '困难' }],
]);
const DAY = 86400000;
let n = 0;
function ac(user: string, problem: string, at: number, mode = 'judge') {
  sqlite()
    .prepare(
      `INSERT INTO submissions(id,user_id,problem_id,language,code,status,passed,total,mode,created_at,updated_at)
      VALUES(?,?,?,'python','','accepted',1,1,?,?,?)`,
    )
    .run(`s${++n}`, user, problem, mode, at, at);
}
const at = Date.UTC(2026, 2, 3, 12);

before(() => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  const db = sqlite();
  for (const [id, name] of [
    ['u-ann', '张三'],
    ['u-kana', 'ゆき'],
  ])
    db.prepare('INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,1,1)').run(id, name, `${id}@example.test`);
  db.prepare(
    `INSERT INTO user_profiles(user_id,handle,visible,indexable,show_contest,bio,created_at,updated_at) VALUES
    ('u-ann','ann',1,0,1,'',1,1),('u-kana','kana',1,0,0,'',1,1),('u-hid','hidden-one',0,0,1,'',1,1)`,
  ).run();
  // Three days in a row on shown problems; a course exercise and a drill never count.
  ac('u-ann', 'lc-1', at);
  ac('u-ann', 'lc-3', at + DAY);
  ac('u-ann', 'oa-amazon-1', at + 2 * DAY);
  ac('u-ann', 'course-x', at + 3 * DAY);
  ac('u-ann', 'lc-3', at + 5 * DAY, 'drill');
  ac('u-hid', 'lc-1', at);
  for (const [id, kind, visibility] of [
    ['weekly-42', 'weekly', 'public'],
    ['starter-42', 'starter', 'public'],
    ['secret-room', 'custom', 'private'],
    ['duel-abc', 'duel', 'private'],
  ])
    db.prepare(
      `INSERT INTO contest_rooms(id,owner_id,title,kind,problem_ids_json,starts_at,duration_min,visibility,rated_at,created_at)
      VALUES(?,NULL,?,?,'[]',?,90,?,1,1)`,
    ).run(id, `Top secret ${id}`, kind, at, visibility);
  db.prepare(
    `INSERT INTO contest_ratings(user_id,room_id,before,after,rank,entrants,solved,created_at) VALUES('u-ann','weekly-42',1500,1612,1,9,1,2)`,
  ).run();
  for (const user of ['u-ann', 'u-kana'])
    db.prepare(`INSERT INTO contest_entries(room_id,user_id,display_name,joined_at) VALUES('weekly-42',?,?,1)`).run(user, user);
  db.prepare(
    `INSERT INTO certificates(id,user_id,course_id,issued_at) VALUES('AnnCert000000001','u-ann','sd:system-design',?),
    ('KanaCert00000001','u-kana','sd:system-design',?)`,
  ).run(at, at);
});
after(() => {
  globalThis.fetch = realFetch;
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

const png = async (response: Response) => {
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400');
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  return bytes.length;
};

void test('the subset draws every label and the site card; anything outside it is swapped, never fetched', () => {
  assert.ok(card.drawable('北美程序员求职 · 已解 12 题 — Ünïcode “quotes” ↗'));
  assert.equal(card.drawable('ゆき'), false);
  assert.equal(card.drawable('𠮷'), false);
  assert.equal(card.drawable('🎉'), false);
  assert.equal(card.fit('ゆき', '@kana'), '@kana');
  assert.equal(card.fit('', 'fallback'), 'fallback');
  assert.equal(card.fit('x'.repeat(50), '', 10), `${'x'.repeat(9)}…`);
  assert.equal(card.drawableCard({ kicker: '🎉', title: 'x' }), card.SITE_CARD);
  for (const c of [
    card.SITE_CARD,
    card.profileOg({ handle: 'ann', solved: { total: 1, easy: 1, medium: 0, hard: 0 }, streak: 1, rating: 1500 }),
    card.oaCompanyOg({ slug: 'amazon', name: 'Amazon', count: 3, ready: 2, platform: 'HackerRank' }),
  ])
    assert.equal(card.drawableCard(c), c);
});

void test('a profile card counts shown ACs by difficulty, the streak and the rating only when contests are shown', async () => {
  assert.deepEqual(profileCard('ann', catalogue), {
    handle: 'ann',
    solved: { total: 3, easy: 1, medium: 1, hard: 1 },
    streak: 3,
    rating: 1612,
  });
  assert.equal(profileCard('kana', catalogue)!.rating, null);
  assert.equal(profileCard('hidden-one', catalogue), null);
  assert.equal(profileCard('nobody', catalogue), null);
  const ann = card.profileOg(profileCard('ann', catalogue)!);
  assert.equal(ann.title, '@ann');
  assert.ok(ann.stats!.some(([label, value]) => /Rating/.test(label) && value === 1612));
  assert.ok(!card.profileOg(profileCard('kana', catalogue)!).stats!.some(([label]) => /Rating/.test(label)));
});

void test('only public weeklies and starters get a contest card, with no names or places on it', () => {
  const weekly = contestCard('weekly-42')!;
  assert.deepEqual(weekly, { id: 'weekly-42', zh: 'CSWork 周赛 第 42 期', en: 'CSWork Weekly #42', entrants: 2, startsAt: at });
  assert.equal(contestCard('starter-42')!.en, 'CSWork Starter #42');
  for (const id of ['secret-room', 'duel-abc', 'weekly-99', '../x']) assert.equal(contestCard(id), null, id);
  const text = JSON.stringify(card.contestOg(weekly));
  assert.ok(!/u-ann|Top secret|rank/i.test(text));
});

void test('a certificate card names the holder only in glyphs the subset has, else the handle or no one', () => {
  const ann = card.certificateOg(certificateById('AnnCert000000001', true)!, certificateById('AnnCert000000001', false)!);
  assert.equal(ann.title, '系统设计面试课');
  assert.deepEqual(ann.lines, ['System Design Interview Course', '张三']);
  assert.ok(ann.stats!.some(([, value]) => value === 'AnnCert000000001'));
  const kana = card.certificateOg(certificateById('KanaCert00000001', true)!, certificateById('KanaCert00000001', false)!);
  // Not listed on the profile, so no handle either.
  assert.deepEqual(kana.lines, ['System Design Interview Course', 'A CSWork learner']);
  assert.equal(card.drawableCard(kana), kana);
  // A course table title is both titles: a long one is cut once in the heading, never repeated in full below.
  const long = { ...certificateById('AnnCert000000001', false)!, course: 'Distributed Systems Engineering for Interviews' };
  const one = card.certificateOg(long, long);
  assert.equal(one.title, 'Distributed Systems Engineeri…');
  assert.deepEqual(one.lines, ['张三']);
  assert.equal(certificateOwner('AnnCert000000001'), 'u-ann');
  assert.equal(certificateOwner('nope'), undefined);
});

void test('every route answers a cached PNG without a single network fetch, offline included', async () => {
  const params = <T,>(value: T) => ({ params: Promise.resolve(value) });
  const site = await png(siteImage());
  assert.ok((await png(await profileImage(params({ handle: 'Ann' })))) !== site);
  // Hidden, unknown and private: byte-for-byte the site card.
  assert.equal(await png(await profileImage(params({ handle: 'hidden-one' }))), site);
  assert.equal(await png(await contestImage(params({ id: 'secret-room' }))), site);
  assert.equal(await png(await contestImage(params({ id: 'duel-abc' }))), site);
  assert.equal(await png(await certificateImage(params({ id: 'missing' }))), site);
  assert.ok((await png(await contestImage(params({ id: 'weekly-42' })))) !== site);
  assert.ok((await png(await certificateImage(params({ id: 'KanaCert00000001' })))) !== site);
  assert.deepEqual(fetched, []);
});

void test('seoMetadata writes an explicit large card only when given an image', () => {
  const plain = seoMetadata({ title: 'T', description: 'D', path: '/x' });
  assert.equal((plain.twitter as { card: string }).card, 'summary');
  assert.equal(Object.hasOwn(plain.openGraph!, 'images'), false);
  const shared = seoMetadata({ title: 'T', description: 'D', path: '/u/ann', image: '/u/ann/opengraph-image' });
  const images = [{ url: 'https://cswork.org/u/ann/opengraph-image', width: 1200, height: 630, alt: 'T' }];
  assert.deepEqual((shared.openGraph as { images: unknown }).images, images);
  assert.deepEqual(shared.twitter, { card: 'summary_large_image', title: 'T', description: 'D', images });
});

void test('the certificate page offers LinkedIn and X; only its holder gets the add-to-profile link', () => {
  const cert = { ...certificateById('AnnCert000000001', false)!, name: 'Ada' };
  const links = shareLinks(cert, false);
  const add = new URL(links.addToProfile);
  assert.equal(add.origin + add.pathname, 'https://www.linkedin.com/profile/add');
  assert.deepEqual(Object.fromEntries(add.searchParams), {
    startTask: 'CERTIFICATION_NAME',
    name: 'System Design Interview Course',
    organizationName: 'CSWork',
    issueYear: '2026',
    issueMonth: '3',
    certUrl: 'https://cswork.org/certificate/AnnCert000000001',
    certId: 'AnnCert000000001',
  });
  assert.equal(new URL(links.linkedIn).searchParams.get('url'), 'https://cswork.org/certificate/AnnCert000000001');
  assert.match(new URL(links.x).searchParams.get('text')!, /System Design Interview Course/);
  for (const owner of [false, true]) {
    const doc = new JSDOM(renderToStaticMarkup(createElement(CertificateView, { cert, zh: true, owner }))).window.document;
    const anchors = [...doc.querySelectorAll('.certificate-share a')];
    assert.equal(anchors.length, owner ? 3 : 2);
    for (const a of anchors) assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
    assert.equal(anchors.some((a) => a.getAttribute('href')!.startsWith('https://www.linkedin.com/profile/add?')), owner);
  }
});
