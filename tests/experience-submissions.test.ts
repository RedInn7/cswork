import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(join(tmpdir(), 'cswork-experience-ugc-'));
process.env.DATABASE_PATH = join(dir, 'app.sqlite');
process.env.HIDDEN_COMPANIES = 'google';
process.env.CONTENT_DATABASE_PATH = join(dir, 'content.sqlite');

// The content library: three Amazon experiences, interviewed in September, July and March.
const content = new Database(process.env.CONTENT_DATABASE_PATH);
content.exec(`CREATE TABLE items(
  id TEXT PRIMARY KEY, type TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, summary TEXT,
  title_zh TEXT, summary_zh TEXT, level TEXT, company_slug TEXT, company_name TEXT, role TEXT, category TEXT,
  difficulty TEXT, round TEXT, seniority TEXT, tags TEXT NOT NULL DEFAULT '[]',
  published_at TEXT, updated_at TEXT, partial INTEGER NOT NULL DEFAULT 0, dup_of TEXT,
  listed INTEGER NOT NULL DEFAULT 1, relations TEXT NOT NULL DEFAULT '[]',
  extra TEXT NOT NULL DEFAULT '{}', body TEXT NOT NULL)`);
for (const [slug, date] of [['lib-sep', '2026-09-20'], ['lib-jul', '2026-07-02'], ['lib-mar', '2026-03-09']])
  content
    .prepare(
      `INSERT INTO items(id,type,slug,title,company_slug,company_name,role,published_at,extra,body)
      VALUES(?,'experience',?,?,'amazon','Amazon','Software Engineer','2026-09-30T00:00:00.000Z',?,'Body')`,
    )
    .run(slug, slug, `Amazon ${slug}`, JSON.stringify({ date, dateBasis: 'interview' }));
content.close();

const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { handleContent } = await import('../lib/server/content-library');
const ugc = await import('../lib/server/experience-submissions');

const me: Person = { id: 'ugc-me', name: 'Me', email: 'me@example.test', role: 'student', verified: true };
const teacher: Person = { ...me, id: 'ugc-teacher', email: 'teacher@example.test', role: 'teacher' };
const readers = [1, 2, 3].map((i): Person => ({ ...me, id: `ugc-reader-${i}`, email: `r${i}@example.test` }));
const fresh: Person = { ...me, id: 'ugc-new', email: 'new@example.test', verified: false };

before(() => migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') }));
after(() => {
  sqlite().close();
  rmSync(dir, { recursive: true, force: true });
});

function request(method: string, path: string, body?: unknown) {
  const url = new URL(`https://cswork.test/api/${path}`);
  return {
    url,
    request: new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    }),
  };
}
async function call(p: Person | null, method: string, path: string, body?: unknown) {
  const { url, request: r } = request(method, path, body);
  const parts = url.pathname.split('/').slice(3);
  try {
    const response = path.startsWith('content/') ? await handleContent(r, p, parts) : await handleOj(r, p, parts);
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: response.status, data: (await response.json()) as any };
  } catch (error) {
    // The API wrapper turns HttpError/ZodError into responses.
    // oxlint-disable-next-line typescript/no-explicit-any -- Loose JSON for terse assertions.
    return { status: (error as { status?: number }).status ?? 400, data: null as any };
  }
}
const month = new Date().toISOString().slice(0, 7);
const post = (o: Record<string, unknown> = {}) => ({
  company: 'amazon',
  title: 'Amazon SDE new grad loop',
  role: 'Software Engineer',
  rounds: ['Online Assessment', 'Onsite', 'Onsite'],
  result: 'Offer',
  month,
  body: 'Two coding rounds and one behavioral. Mail me at someone@example.com.\u0007 '.repeat(3),
  questions: ['LRU cache', 'Merge intervals'],
  agree: true,
  ...o,
});
const list = async (query = '') =>
  (await call(null, 'GET', `content/list?type=experience${query}`)).data as { items: { slug: string }[]; total: number };

void test('mergePage interleaves posts by sort key, posts first on ties and in searches', () => {
  const library = ['L10', 'L8', 'L5'].map((name) => ({ name, key: name.slice(1).padStart(2, '0') }));
  const members = [{ key: '09', item: 'M9' }, { key: '05', item: 'M5' }];
  const read = (limit: number, offset: number) => library.slice(offset, offset + limit).map((l) => l.name);
  const keys = library.map((l) => l.key);
  const all = ugc.mergePage(members, keys, 0, 10, read);
  assert.deepEqual(all, ['L10', 'M9', 'L8', 'M5', 'L5']);
  // Every page agrees with the whole.
  for (const size of [1, 2, 3])
    for (let offset = 0; offset < 5; offset += size)
      assert.deepEqual(ugc.mergePage(members, keys, offset, size, read), all.slice(offset, offset + size), `${offset}/${size}`);
  assert.deepEqual(ugc.mergePage(members, null, 0, 3, read), ['M9', 'M5', 'L10']);
  assert.deepEqual(ugc.mergePage(members, null, 3, 3, read), ['L8', 'L5']);
});

let id = '';
void test('submitting checks the account, the fields and the company; emails and control characters go', async () => {
  assert.equal((await call(null, 'POST', 'oj/experiences', post())).status, 401);
  assert.equal((await call(fresh, 'POST', 'oj/experiences', post())).status, 403);
  for (const bad of [
    { agree: false },
    { company: 'no-such-co' },
    { company: 'google' }, // hidden
    { body: 'too short' },
    { body: 'x'.repeat(ugc.BODY_MAX + 1) },
    { rounds: ['Lunch'] },
    { result: 'Hired' },
    { month: '2019-01' },
    { body: `${'>'.repeat(2000)} nested far past what the renderer's stack holds` }, // ~1700 levels crash react-markdown
    { questions: Array(21).fill('Two sum') },
    { extra: 1 },
  ])
    assert.equal((await call(me, 'POST', 'oj/experiences', post(bad))).status, 400, JSON.stringify(bad).slice(0, 40));
  const created = await call(me, 'POST', 'oj/experiences', post());
  assert.equal(created.status, 201);
  id = created.data.member.id;
  assert.equal(created.data.slug, `member.${id}`);
  assert.equal(created.data.member.status, 'pending');
  assert.ok(!created.data.body.includes('someone@example.com') && created.data.body.includes('[email]'));
  assert.ok(!created.data.body.includes('\u0007'));
  assert.deepEqual(created.data.rounds, ['Online Assessment', 'Onsite']);
  assert.equal(created.data.interviewDate, `${month}-01`);
  assert.ok(!JSON.stringify(created.data).includes('me@example.test'), 'no account email');
});

void test('a pending post is the author’s and teachers’ only', async () => {
  const path = `content/item?type=experience&slug=member.${id}`;
  assert.equal((await call(null, 'GET', path)).status, 404);
  assert.equal((await call(readers[0], 'GET', path)).status, 404);
  assert.equal((await call(me, 'GET', path)).data.member.status, 'pending');
  assert.equal((await call(teacher, 'GET', path)).status, 200);
  assert.equal((await list()).total, 3);
  assert.equal(ugc.companyMemberExperiences('amazon').total, 0);
  // Reports need a public post; reviews need a teacher.
  assert.equal((await call(readers[0], 'POST', `oj/experiences/${id}/flag`, { reason: 'spam' })).status, 404);
  assert.equal((await call(me, 'GET', 'oj/experiences/review')).status, 403);
  assert.equal((await call(me, 'POST', `oj/experiences/${id}/review`, { status: 'approved' })).status, 403);
  const mine = await call(me, 'GET', 'oj/experiences/mine');
  assert.deepEqual(mine.data.items.map((i: { id: string; status: string }) => [i.id, i.status]), [[id, 'pending']]);
  assert.deepEqual((await call(readers[0], 'GET', 'oj/experiences/mine')).data.items, []);
});

void test('approved posts merge into the experiences list and the company page, marked as members’', async () => {
  const queue = await call(teacher, 'GET', 'oj/experiences/review');
  assert.deepEqual(queue.data.pending.map((i: { id: string }) => i.id), [id]);
  assert.equal((await call(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'rejected' })).status, 400, 'a rejection needs a note');
  assert.equal((await call(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'approved', note: 'Thanks' })).status, 200);
  // This month's interview sorts before September's library report.
  const page = await list();
  assert.equal(page.total, 4);
  assert.deepEqual(page.items.map((i) => i.slug), [`member.${id}`, 'lib-sep', 'lib-jul', 'lib-mar']);
  assert.ok((page.items[0] as { member?: unknown }).member);
  assert.deepEqual((await list('&page=2')).items, []);
  assert.equal((await list('&company=amazon&result=Offer')).total, 1);
  assert.equal((await list('&round=Onsite')).total, 1);
  assert.equal((await list('&difficulty=easy')).total, 0);
  assert.equal((await list('&company=uber')).total, 0);
  const item = await call(null, 'GET', `content/item?type=experience&slug=member.${id}`);
  assert.equal(item.status, 200);
  assert.deepEqual(item.data.questions, ['LRU cache', 'Merge intervals']);
  assert.equal(item.data.member.note, '', 'the review note is the author’s');
  assert.equal((await call(me, 'GET', `content/item?type=experience&slug=member.${id}`)).data.member.note, 'Thanks');
  const hub = ugc.companyMemberExperiences('amazon');
  assert.deepEqual([hub.total, hub.items[0].slug], [1, `member.${id}`]);
  // A public handle names the author; nothing else does.
  sqlite()
    .prepare(`INSERT INTO user_profiles(user_id,handle,visible,indexable,bio,created_at,updated_at) VALUES(?,?,1,0,'',1,1)`)
    .run(me.id, 'me-handle');
  assert.equal(ugc.readMember(id, null)?.member.handle, 'me-handle');
});

void test('reports from three readers take a post down until a teacher approves it again', async () => {
  assert.equal((await call(me, 'POST', `oj/experiences/${id}/flag`, { reason: 'spam' })).status, 400);
  assert.equal((await call(fresh, 'POST', `oj/experiences/${id}/flag`, { reason: 'spam' })).status, 403);
  assert.equal((await call(readers[0], 'POST', `oj/experiences/${id}/flag`, { reason: 'boring' })).status, 400);
  for (const reader of readers)
    assert.equal((await call(reader, 'POST', `oj/experiences/${id}/flag`, { reason: 'nda', note: 'Names the question bank' })).status, 200);
  assert.equal(ugc.readMember(id, null), null);
  assert.equal((await list()).total, 3);
  const queue = await call(teacher, 'GET', 'oj/experiences/review');
  assert.deepEqual([queue.data.flagged[0].id, queue.data.flagged[0].flags], [id, 3]);
  assert.equal(queue.data.flagged[0].reasons[0], 'nda: Names the question bank');
  await call(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'approved' });
  assert.ok(ugc.readMember(id, null));
  // Taking it down is a rejection with a note the author reads.
  await call(teacher, 'POST', `oj/experiences/${id}/review`, { status: 'rejected', note: 'Covered by an NDA' });
  assert.equal(ugc.readMember(id, null), null);
  const mine = await call(me, 'GET', 'oj/experiences/mine');
  assert.deepEqual([mine.data.items[0].status, mine.data.items[0].note], ['rejected', 'Covered by an NDA']);
});

void test('only the author withdraws a post; daily and pending caps hold, withdrawn or not', async () => {
  assert.equal((await call(readers[0], 'POST', `oj/experiences/${id}/withdraw`, {})).status, 404);
  assert.equal((await call(me, 'POST', `oj/experiences/${id}/withdraw`, {})).status, 200);
  assert.equal(ugc.readMember(id, me), null);
  const writer = readers[1];
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const created = await call(writer, 'POST', 'oj/experiences', post());
    assert.equal(created.status, 201);
    ids.push(created.data.member.id);
  }
  assert.equal((await call(writer, 'POST', 'oj/experiences', post())).status, 429);
  // Withdrawing deletes the posts but doesn't hand the day's quota back.
  for (const w of ids) assert.equal((await call(writer, 'POST', `oj/experiences/${w}/withdraw`, {})).status, 200);
  assert.equal((await call(writer, 'POST', 'oj/experiences', post())).status, 429);
  // Five posts waiting for review are the most anyone has.
  const author = readers[2];
  for (let i = 0; i < 5; i++)
    sqlite()
      .prepare(
        `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,created_at)
        VALUES(?,?,'amazon','Old post','SWE',?,'Body',?)`,
      )
      .run(`waiting-${i}-xxx`.slice(0, 12), author.id, month, Date.now() - 3 * 86400000);
  await assert.rejects(ugc.submitExperience(author, post()), { status: 409 });
});

void test('the interview month runs from 35 months back to this one, a day either way', async () => {
  const p: Person = { ...me, id: 'ugc-months' };
  const now = Date.UTC(2026, 9, 14, 12);
  await assert.rejects(ugc.submitExperience(p, post({ month: '2023-10' }), now), { status: 400 });
  await assert.rejects(ugc.submitExperience(p, post({ month: '2026-11' }), now), { status: 400 });
  assert.equal((await ugc.submitExperience(p, post({ month: '2023-11' }), now)).interviewDate, '2023-11-01');
  // Late on the 1st (UTC) it's still the last day of the month before somewhere.
  assert.ok(await ugc.submitExperience(p, post({ month: '2023-10' }), Date.UTC(2026, 9, 1, 2)));
});

void test('markdownDepth catches nesting that overflows the renderer and passes ordinary posts', () => {
  const deep = 2000;
  for (const [name, text] of Object.entries({
    quotes: '>'.repeat(deep),
    stars: `${'*'.repeat(9000)}x${'*'.repeat(9000)}`,
    bullets: `${'* '.repeat(deep)}x`,
    dashes: `${'- '.repeat(deep)}x`,
    numbered: `${'1. '.repeat(deep)}x`,
    quotedLists: `${'> - '.repeat(deep)}x`,
    spacedEmphasis: `${'*a '.repeat(deep)}b${' a*'.repeat(deep)}`,
    strong: `${'**a '.repeat(deep)}b${' a**'.repeat(deep)}`,
    strike: `${'~~a '.repeat(deep)}b${' a~~'.repeat(deep)}`,
    overLines: `${'*a\n'.repeat(deep)}b${' a*'.repeat(deep)}`,
    otherCloser: `${'*a b~ '.repeat(deep)}c${' a*'.repeat(deep)}`,
    footnote: `[^1]: ${'> '.repeat(deep)}x`,
    // Not fences, so the quotes after them count: a backtick in the info string, a fence in a list
    // item that the next line closes, a fence inside an HTML block.
    fakeFence: `\`\`\`a\`\n${'> '.repeat(deep)}x\n\`\`\``,
    listFence: `- a\n  \`\`\`\n${'> '.repeat(deep)}x\n\`\`\``,
    htmlFence: `<div>\n\`\`\`\n\n${'> '.repeat(deep)}x\n\`\`\``,
    crlf: `\`\`\`\r\nx\r\n\`\`\`\r\n${'> '.repeat(deep)}x`,
  }))
    assert.ok(ugc.markdownDepth(text) > ugc.DEPTH_MAX, name);
  const ordinary = [
    '## 一面（45 min）',
    '> 面试官先问了 **项目**，然后 *追问* 细节 ~约 10 分钟~。',
    '- 第一题：`LRU cache`，要求 O(1)，用了 `dict` + 双向链表',
    '  - follow up：线程安全？加锁 / `__init__` 里初始化',
    '1. 3~5 轮，每轮 ~45min，snake_case 和 a*b 不算强调',
    '',
    '```cpp',
    ...Array(40).fill('Node *next = *head; int **grid = &p; f(*args, **kwargs);'),
    '```',
    '',
    '***',
    'HR 说 *offer* 一周内发，base ~180k，**总包** 还行。',
  ].join('\n');
  assert.ok(ugc.markdownDepth(ordinary) <= 4, String(ugc.markdownDepth(ordinary)));
  // Linear: the longest post scans in well under a frame.
  const started = performance.now();
  for (const text of ['>'.repeat(20000), '*a '.repeat(6666), ' '.repeat(20000), '[^'.repeat(10000)]) ugc.markdownDepth(text);
  assert.ok(performance.now() - started < 200);
});

void test('emails are masked in linear time', () => {
  assert.equal(ugc.redactEmails('mail a.b+c@mail.example.co.uk or x@y.io.'), 'mail [email] or [email].');
  const started = performance.now();
  for (const text of ['a'.repeat(20000), `a@${'b'.repeat(20000)}`, '@a'.repeat(10000), 'a.'.repeat(10000)]) ugc.redactEmails(text);
  assert.ok(performance.now() - started < 50);
});
