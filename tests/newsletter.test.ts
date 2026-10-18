import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Person } from '../lib/server/auth';

const dir = mkdtempSync(resolve(tmpdir(), 'cswork-newsletter-'));
process.env.DATABASE_PATH = resolve(dir, 'test.sqlite');
process.env.APP_URL = 'https://cswork.test';
process.env.HIDDEN_COMPANIES = 'hiddenco';
const { sqlite } = await import('../db/sqlite');
const { handleOj } = await import('../lib/server/oj-api');
const { composeIssue, handleNewsletterLink, isoWeek, readIssue, saveIssue, weekStart, issueList } = await import(
  '../lib/server/newsletter'
);
const { issueText } = await import('../scripts/newsletter');

const DAY = 86400000;
const mail: { to: string[]; subject: string; text: string; headers?: Record<string, string> }[] = [];
const server = createServer(async (req, res) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  mail.push(JSON.parse(raw));
  res.setHeader('Content-Type', 'application/json');
  res.end('{"id":"fixture"}');
});
const person = (id: string, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  email: `${id}@example.test`,
  role: 'student',
  verified: true,
  ...extra,
});
function call(p: Person | null, method: string, body?: unknown, zh = false) {
  const url = new URL('https://cswork.test/api/oj/newsletter');
  return handleOj(
    new Request(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: zh ? { 'x-locale': 'zh' } : {},
    }),
    p,
    ['newsletter'],
  );
}
async function status(p: Person | null, method: string, body?: unknown) {
  try {
    return (await call(p, method, body)).status;
  } catch (error) {
    return (error as { status?: number }).status ?? 400;
  }
}
const state = async (p: Person, method = 'GET', body?: unknown, zh = false) =>
  (await (await call(p, method, body, zh)).json()) as { subscribed: boolean; confirmed: boolean; mail: boolean; resend: boolean };
const sub = (user: string) =>
  sqlite().prepare('SELECT * FROM newsletter_subs WHERE user_id=?').get(user) as {
    token: string;
    locale: string;
    confirmed_at: number | null;
    confirm_sent_at: number | null;
    unsubscribed_at: number | null;
  };
/** A mail link, as the browser or the mail provider sends it (no Origin header; api.ts routes it here first). */
async function link(path: string, method = 'GET', body?: string) {
  const request = new Request(`https://cswork.test${path}`, { method, body });
  try {
    return await handleNewsletterLink(request, new URL(request.url).pathname.split('/')[3]);
  } catch (error) {
    return new Response(null, { status: (error as { status?: number }).status ?? 500 });
  }
}

before(async () => {
  migrate(drizzle(sqlite()), { migrationsFolder: resolve('drizzle') });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
});
after(async () => {
  sqlite().close();
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
});

void test('ISO weeks: ids, Mondays and the 53-week years', () => {
  assert.deepEqual(isoWeek(Date.UTC(2026, 9, 14, 13)), { id: '2026-W42', start: Date.UTC(2026, 9, 12) });
  assert.equal(isoWeek(Date.UTC(2021, 0, 3)).id, '2020-W53');
  assert.equal(isoWeek(Date.UTC(2024, 11, 30)).id, '2025-W01');
  assert.equal(weekStart('2026-W42'), Date.UTC(2026, 9, 12));
  assert.equal(weekStart('2020-W53'), Date.UTC(2020, 11, 28));
  assert.equal(weekStart('2025-W01'), Date.UTC(2024, 11, 30));
  assert.equal(weekStart('2025-W53'), null);
  assert.equal(weekStart('2026-W00'), null);
  assert.equal(weekStart('../etc'), null);
});

void test('signed-in, verified learners subscribe; confirming waits until mail is configured', async () => {
  assert.equal(await status(null, 'GET'), 401);
  assert.equal(await status(person('n-unverified', { verified: false }), 'POST', { subscribe: true }), 403);
  assert.equal(await status(person('n-x'), 'POST', { subscribe: 'yes' }), 400);
  const amy = person('n-amy');
  assert.deepEqual(await state(amy), { subscribed: false, confirmed: false, mail: false, resend: false });
  assert.deepEqual(await state(amy, 'POST', { subscribe: true }, true), { subscribed: true, confirmed: false, mail: false, resend: false });
  assert.equal(sub(amy.id).locale, 'zh');
  assert.match(sub(amy.id).token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sub(amy.id).confirm_sent_at, null);
  assert.equal(mail.length, 0);
  // Unsubscribing in the app keeps the row (and its token) but stops everything.
  assert.deepEqual(await state(amy, 'POST', { subscribe: false }), { subscribed: false, confirmed: false, mail: false, resend: false });
  assert.ok(sub(amy.id).unsubscribed_at);
});

void test('with mail configured: one confirmation mail, a confirm link, one-click unsubscribe', async () => {
  const address = server.address() as { port: number };
  process.env.MAIL_API_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.RESEND_API_KEY = 're_test';
  process.env.MAIL_FROM = 'CSWork <news@cswork.test>';
  try {
    const bob = person('n-bob');
    assert.deepEqual(await state(bob, 'POST', { subscribe: true, locale: 'en' }), { subscribed: true, confirmed: false, mail: true, resend: false });
    const { token } = sub(bob.id);
    assert.equal(mail.length, 1);
    assert.deepEqual(mail[0].to, ['n-bob@example.test']);
    assert.equal(mail[0].subject, 'Confirm your CSWork weekly subscription');
    assert.ok(mail[0].text.includes(`https://cswork.test/api/newsletter/confirm?token=${token}`));
    assert.equal(mail[0].headers?.['List-Unsubscribe'], `<https://cswork.test/api/newsletter/unsubscribe?token=${token}>`);
    assert.equal(mail[0].headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    // Subscribing again does not mail again, until a day has passed without a click: then it
    // offers to and does (spam folder, deleted mail).
    await state(bob, 'POST', { subscribe: true });
    assert.equal(mail.length, 1);
    sqlite().prepare('UPDATE newsletter_subs SET confirm_sent_at=? WHERE user_id=?').run(Date.now() - DAY - 1000, bob.id);
    assert.equal((await state(bob)).resend, true);
    assert.equal((await state(bob, 'POST', { subscribe: true })).resend, false);
    assert.equal(mail.length, 2);
    assert.ok(mail[1].text.includes(`confirm?token=${token}`));
    const bad = await link('/api/newsletter/confirm?token=nope');
    assert.equal(bad.headers.get('location'), 'https://cswork.test/newsletter?invalid=1');
    const confirmed = await link(`/api/newsletter/confirm?token=${token}`);
    assert.equal(confirmed.status, 303);
    assert.equal(confirmed.headers.get('location'), 'https://cswork.test/newsletter?confirmed=1');
    assert.deepEqual(await state(bob), { subscribed: true, confirmed: true, mail: true, resend: false });
    // A link scanner's GET never unsubscribes: it lands on the page with the button. The
    // provider's one-click POST does.
    const get = await link(`/api/newsletter/unsubscribe?token=${token}`);
    assert.equal(get.status, 303);
    assert.equal(get.headers.get('location'), `https://cswork.test/newsletter/unsubscribe?token=${token}`);
    assert.equal((await link('/api/newsletter/unsubscribe?token=nope')).headers.get('location'), 'https://cswork.test/newsletter/unsubscribe');
    assert.equal((await state(bob)).subscribed, true);
    const once = await link(`/api/newsletter/unsubscribe?token=${token}`, 'POST', 'List-Unsubscribe=One-Click');
    assert.equal(once.status, 200);
    assert.equal((await state(bob)).subscribed, false);
    // The page's form gets a page back. Resubscribing to the same address stays confirmed.
    await state(bob, 'POST', { subscribe: true });
    const form = await link(`/api/newsletter/unsubscribe?token=${token}`, 'POST', '');
    assert.equal(form.headers.get('location'), 'https://cswork.test/newsletter?unsubscribed=1');
    await state(bob, 'POST', { subscribe: true });
    assert.equal((await state(bob)).confirmed, true);
    // A new address has to confirm again.
    assert.equal((await state({ ...bob, email: 'bob@new.test' }, 'POST', { subscribe: true })).confirmed, false);
    assert.equal(mail.at(-1)?.to[0], 'bob@new.test');
  } finally {
    delete process.env.MAIL_API_BASE_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
  }
});

void test('an issue has no board threads; archives drop companies hidden since and old threads', async () => {
  const start = isoWeek(Date.now()).start;
  sqlite()
    .prepare(`INSERT INTO solution_posts(id,problem_id,user_id,title,body,created_at,updated_at) VALUES(?,?,?,?,'Body text here',?,?)`)
    .run('00000000-0000-4000-8000-000000000001', 'discuss:interview', 'n-amy', 'Hot thread', start + 1000, start + 1000);
  const issue = await composeIssue(start);
  assert.equal(issue.id, isoWeek(start).id);
  assert.equal('discussions' in issue, false);
  // An issue composed while the discussion board existed still holds its threads.
  const archived = { ...issue, discussions: [{ id: 'old', title: 'Hot thread', href: '/discuss/old', votes: 2, comments: 0 }] };
  saveIssue({
    ...archived,
    experiences: [
      { id: 'exp-shown', title: 'Shown', company: 'stripe', companyName: 'Stripe', href: '/library/experience-ugc/a' },
      { id: 'exp-hidden', title: 'Hidden', company: 'hiddenco', companyName: 'Hidden Co', href: '/library/experience-ugc/b' },
    ],
  });
  assert.deepEqual(issueList().map((i) => i.id), [issue.id]);
  const read = (await readIssue(issue.id))!;
  assert.deepEqual(read.experiences.map((e) => e.title), [], 'neither report is public: one company hidden, one not approved');
  assert.equal('discussions' in read, false, 'the board is gone, so are its threads');
  assert.equal(await readIssue('2000-W01'), null);
  const text = issueText(read, false, 'tok');
  assert.ok(text.startsWith(`CSWork weekly · ${issue.id}`));
  assert.ok(text.includes(`Read it online: https://cswork.test/newsletter/${issue.id}`));
  assert.ok(text.includes('Unsubscribe: https://cswork.test/newsletter/unsubscribe?token=tok'));
  assert.ok(!text.includes('Hidden') && !text.includes('Hot thread'));
});

void test('recomposing an older week finds its reports however many were approved since', async () => {
  const start = isoWeek(Date.now()).start - 21 * DAY;
  const add = sqlite().prepare(
    `INSERT INTO experience_submissions(id,user_id,company_slug,title,role,interview_month,body,status,reviewed_at,created_at)
    VALUES(?,'n-amy','stripe',?,'SWE','2026-01','Body','approved',?,?)`,
  );
  add.run('weekreport01', 'That week', start + DAY, start + DAY);
  // 120 approved after it: more than the old newest-50 window held.
  for (let i = 0; i < 120; i++) add.run(`laterrep${String(i).padStart(4, '0')}`, `Later ${i}`, start + 8 * DAY + i, start + 8 * DAY + i);
  const issue = await composeIssue(start);
  assert.deepEqual(issue.experiences.map((e) => e.title), ['That week']);
});
