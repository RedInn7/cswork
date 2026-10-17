// /career/tracker (components/application-tracker.tsx): the funnel, one column per stage with the
// OA countdown and the company's OA and mock links, adding and moving cards through the API, and
// the CSV and calendar exports built in the browser. Then the wave-8 board: the No response
// column and the stale hint, follow-up nudges and today's list, prep links, and the bookmarklet's
// #jd prefill (kept across sign-in).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';

const HOUR = 3600000,
  DAY = 24 * HOUR;
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'https://cswork.test/career/tracker',
  virtualConsole: new VirtualConsole(), // jsdom cannot follow a download link; keep that quiet
});
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ApplicationTracker, KeepTrackerAdd } = await import('../components/application-tracker.tsx');
const { TrackerBookmarklet } = await import('../components/application-tracker-extras.tsx');
const { tomorrowMorning } = await import('../lib/applications.ts');

const now = Date.now();
const card = (patch) => ({
  id: 'a', companySlug: '', company: 'Acme', role: '', stage: 'applied', appliedAt: null, oaDeadline: null, interviewAt: null,
  referral: '', link: '', notes: '', channel: '', referralStatus: '', nextAction: '', nextAt: null, resumeVersion: '',
  stageLog: [], hasJd: false, createdAt: 1, updatedAt: 1, links: null, closedAt: null, prep: null, ...patch,
});
const items = [
  card({ id: 'amz', companySlug: 'amazon', company: 'Amazon', role: 'SDE Intern', stage: 'oa', oaDeadline: now + 30 * HOUR, links: { oa: '/oa/amazon', mock: '/mock-oa/amazon' } }),
  card({ id: 'evil', company: '=HYPERLINK("http://x")', stage: 'applied' }),
  card({ id: 'off', company: 'Offerco', stage: 'offer', interviewAt: now - 100 * HOUR }),
  card({ id: 'wish', company: 'Someday', stage: 'saved' }),
  card({ id: 'old', company: 'Quietco', stage: 'applied', stageLog: [['applied', now - 30 * DAY]], updatedAt: now - DAY }),
  card({ id: 'nudge', company: 'Nudgeco', stage: 'applied', stageLog: [['applied', now - 8 * DAY]], updatedAt: now - 8 * DAY }),
  card({
    id: 'due', companySlug: 'acme', company: 'Dueco', role: 'SWE Intern', stage: 'phone', stageLog: [['applied', now - 9 * DAY], ['phone', now - 3 * DAY]],
    updatedAt: now, nextAt: now - HOUR, nextAction: 'Send a thank-you note', interviewAt: new Date(2026, 9, 3).getTime(), hasJd: true, channel: 'referral',
    links: { oa: null, mock: null }, prep: { experiences: { href: '/company/acme#experiences', n: 4 }, problems: '/?view=problems&company=acme&sort=frequency', stories: '/?view=stories' },
  }),
];
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push([key, body]);
  if (key === 'GET /api/oj/applications') return Response.json({ items, max: 300 });
  if (key === 'GET /api/oj/reports/companies') return Response.json({ items: [{ slug: 'google', name: 'Google' }] });
  if (key === 'POST /api/oj/applications') return Response.json({ item: card({ id: 'new', ...body }) });
  if (key === 'POST /api/oj/applications/wish/delete') return Response.json({ ok: true });
  if (key === 'GET /api/oj/applications/due/jd') return Response.json({ jd: 'Build things.\nShip them.' });
  if (key.startsWith('GET /api/oj/notes')) return Response.json({ body: JSON.stringify({ weekly: 3 }) });
  const id = /^POST \/api\/oj\/applications\/([\w-]+)$/.exec(key)?.[1];
  if (id) return Response.json({ item: { ...items.find((a) => a.id === id), ...body, updatedAt: Date.now() } });
  return Response.json({ error: 'no route' }, { status: 404 });
};
const blobs = [];
URL.createObjectURL = (blob) => (blobs.push(blob), 'blob:test');
URL.revokeObjectURL = () => {};

const root = createRoot(document.getElementById('root'));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const column = (stage) => document.querySelector(`.tracker-column[data-stage="${stage}"]`);
const setValue = async (field, value, type = 'input') => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event(type, { bubbles: true }));
  });
};

test('the board shows the funnel, a column per stage, the countdown and the company links', async () => {
  await act(async () => root.render(createElement(ApplicationTracker, { zh: true })));
  const summary = [...document.querySelectorAll('.tracker-summary dd')].map((d) => d.textContent);
  // 6 sent (the saved one is not); Amazon, the offer and the phone screen got an OA, two an interview.
  assert.deepEqual(summary, ['6', '50%', '33%', '1']);
  assert.equal(document.querySelectorAll('.tracker-column').length, 9);
  assert.equal(column('ghosted').querySelector('h2').textContent, '无回音 0');
  assert.equal(column('onsite').getAttribute('data-empty'), '');
  const amazon = column('oa').querySelector('.tracker-card');
  assert.equal(amazon.getAttribute('data-due'), 'soon');
  assert.match(amazon.querySelector('.tracker-due').textContent, /^OA 还剩 1 天 [56] 小时$/);
  assert.deepEqual(
    [...amazon.querySelectorAll('.tracker-links a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['这家的 OA 真题', '/oa/amazon'], ['模拟 OA', '/mock-oa/amazon']],
  );
  assert.equal(amazon.querySelector('select').getAttribute('aria-label'), 'Amazon 的阶段');
});

test('adding a card posts the form; moving one posts only its stage', async () => {
  await act(async () => button('添加投递').click());
  const form = document.querySelector('form.resume-form');
  // The form takes the focus (which scrolls it into view); saving hands it back to the opener.
  assert.equal(document.activeElement, form.querySelector('input[list="tracker-companies"]'));
  // Names come from the company pages.
  assert.ok(form.querySelector('#tracker-companies option[value="Google"]'));
  await setValue(form.querySelector('input[list="tracker-companies"]'), 'Google');
  await setValue(form.querySelector('input[type="date"]'), '2099-03-04');
  await act(async () => form.querySelector('button[type="submit"]').click());
  const [, sent] = calls.find(([k]) => k === 'POST /api/oj/applications');
  assert.equal(sent.company, 'Google');
  assert.equal(sent.stage, 'applied');
  assert.equal(sent.appliedAt, new Date(2099, 2, 4).getTime(), 'a date is local midnight');
  assert.equal(sent.oaDeadline, null);
  assert.equal(document.querySelector('form.resume-form'), null);
  assert.equal(document.activeElement, button('添加投递'));
  assert.ok([...column('applied').querySelectorAll('.tracker-company')].some((p) => p.textContent === 'Google'));

  column('oa').querySelector('select').focus();
  await setValue(column('oa').querySelector('select'), 'phone', 'change');
  assert.deepEqual(calls.at(-1), ['POST /api/oj/applications/amz', { stage: 'phone' }]);
  const moved = column('phone').querySelector('[data-id="amz"]');
  assert.match(moved.textContent, /Amazon/);
  // Keyboard focus follows the card into its new column.
  assert.equal(document.activeElement, moved.querySelector('select'));
  // Past the OA stage the deadline has no countdown and nothing to export.
  assert.equal(moved.querySelector('.tracker-due'), null);
  assert.equal(button('导出日历').disabled, true);
});

test('a stage moved while the card is being edited is not saved back by the form', async () => {
  await act(async () => column('phone').querySelector('[data-id="amz"] .tracker-card-actions button').click());
  assert.equal(document.activeElement, document.querySelector('form.resume-form input'));
  await setValue(column('phone').querySelector('[data-id="amz"] select'), 'oa', 'change');
  assert.equal(document.querySelector('form.resume-form select').value, 'oa');
  await act(async () => document.querySelector('form.resume-form button[type="submit"]').click());
  assert.equal(calls.at(-1)[1].stage, 'oa');
  assert.match(column('oa').textContent, /Amazon/);
  // Back on the card's own Edit button, in its new column.
  assert.equal(document.activeElement, column('oa').querySelector('[data-id="amz"] .tracker-card-actions button'));
});

test('deleting from the form leaves the focus on Add application', async () => {
  window.confirm = () => true;
  await act(async () => document.querySelector('[data-id="wish"] .tracker-card-actions button').click());
  await act(async () => button('删除').click());
  assert.equal(document.querySelector('[data-id="wish"]'), null);
  assert.equal(document.activeElement, button('添加投递'));
});

test('a job link must be https before anything is sent', async () => {
  const before = calls.length;
  await act(async () => button('添加投递').click());
  const form = document.querySelector('form.resume-form');
  await setValue(form.querySelector('input[list="tracker-companies"]'), 'Meta');
  await setValue(form.querySelector('input[type="url"]'), 'http://jobs.example.com');
  await act(async () => form.querySelector('button[type="submit"]').click());
  assert.equal(calls.length, before);
  assert.match(document.querySelector('.resume-error').textContent, /https:\/\//);
  await act(async () => button('取消').click());
  assert.equal(document.activeElement, button('添加投递'));
});

test('the exports: CSV with formulas defused, a calendar with the open deadlines', async () => {
  await act(async () => button('导出 CSV').click());
  const csv = await blobs.at(-1).text();
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  await act(async () => button('导出日历').click());
  const ics = await blobs.at(-1).text();
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert.match(ics, /SUMMARY:OA 截止：Amazon · SDE Intern/);
  assert.match(ics, /TRIGGER:-P1D[\s\S]*TRIGGER:-PT2H/);
});

test('a stale card offers No response; a week-old one a follow-up tomorrow', async () => {
  const old = document.querySelector('[data-id="old"]');
  assert.match(old.querySelector('.tracker-hint').textContent, /^可能已被搁置：30 天没有进展/);
  await act(async () => old.querySelector('.tracker-hint button').click());
  assert.deepEqual(calls.at(-1), ['POST /api/oj/applications/old', { stage: 'ghosted' }]);
  assert.ok(column('ghosted').querySelector('[data-id="old"]'));
  assert.equal(document.activeElement, column('ghosted').querySelector('[data-id="old"] select'));

  const nudge = document.querySelector('[data-id="nudge"] .tracker-hint');
  assert.match(nudge.textContent, /建议跟进一次/);
  await act(async () => nudge.querySelector('button').click());
  assert.deepEqual(calls.at(-1), ['POST /api/oj/applications/nudge', { nextAt: tomorrowMorning(Date.now()) }]);
  const card = document.querySelector('[data-id="nudge"]');
  assert.equal(card.querySelector('.tracker-hint'), null);
  assert.match(card.querySelector('.tracker-next').textContent, /^跟进 \d{4}-\d\d-\d\d 09:00$/);
});

test("today's follow-ups sit on top; prep, write-up and details show on the card", async () => {
  const today = document.querySelector('.tracker-today');
  assert.match(today.textContent, /今天要跟进 1/);
  assert.match(today.textContent, /Dueco Send a thank-you note 已过期/);
  const due = document.querySelector('[data-id="due"]');
  assert.deepEqual(
    [...due.querySelectorAll('.tracker-links a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [
      ['面经 4 篇', '/company/acme#experiences'],
      ['这家的高频题', '/?view=problems&company=acme&sort=frequency'],
      ['故事库', '/?view=stories'],
      ['写这场面经', '/?view=progress&tab=share&company=acme&role=SWE+Intern&employment=intern&season=2026-fall'],
    ],
  );
  const more = due.querySelector('details.tracker-more');
  assert.deepEqual([...more.querySelectorAll('.tracker-timeline li')].map((li) => li.textContent.replace(/\d{4}-\d\d-\d\d/, 'D')), ['已投递 D 6 天', '电面 D 3 天']);
  assert.match(more.querySelector('.tracker-facts').textContent, /渠道内推/);
  more.open = true;
  await act(async () => more.dispatchEvent(new window.Event('toggle')));
  assert.equal(more.querySelector('div.tracker-text').textContent, 'Build things.\nShip them.');

  await act(async () => today.querySelector('button').click());
  assert.deepEqual(calls.at(-1), ['POST /api/oj/applications/due', { nextAt: null, nextAction: '' }]);
  assert.equal(document.querySelector('.tracker-today'), null);
});

test('editing a card with a saved job description loads it into the form', async () => {
  await act(async () => document.querySelector('[data-id="due"] .tracker-card-actions button').click());
  const jd = [...document.querySelectorAll('form.resume-form textarea')].at(-1);
  assert.equal(jd.disabled, false);
  assert.equal(jd.value, 'Build things.\nShip them.');
  await act(async () => document.querySelector('form.resume-form button[type="submit"]').click());
  const [, sent] = calls.at(-1);
  assert.equal(sent.jdText, 'Build things.\nShip them.');
  assert.equal(sent.channel, 'referral');
  await act(async () => root.unmount());
});

test("the bookmarklet's #jd fills the job description and leaves the address, also across sign-in", async () => {
  const link = 'https://jobs.example.com/1?utm_source=x';
  history.replaceState(null, '', `/career/tracker?add=1&company=Acme&role=SWE&link=${encodeURIComponent(link)}#jd=${encodeURIComponent('Go, Kubernetes # and more')}`);
  // Signed out: the page keeps query and fragment for after sign-in.
  const kept = createRoot(document.createElement('div'));
  await act(async () => kept.render(createElement(KeepTrackerAdd)));
  assert.match(sessionStorage.getItem('cswork:tracker:add'), /^\?add=1&.*#jd=Go/);
  history.replaceState(null, '', '/career/tracker');
  const again = createRoot(document.getElementById('root'));
  await act(async () => again.render(createElement(ApplicationTracker, { zh: false })));
  const form = document.querySelector('form.resume-form');
  assert.equal(form.querySelector('input[list="tracker-companies"]').value, 'Acme');
  assert.equal(form.querySelector('input[type="url"]').value, link);
  assert.equal([...form.querySelectorAll('textarea')].at(-1).value, 'Go, Kubernetes # and more');
  assert.equal(sessionStorage.getItem('cswork:tracker:add'), null);
  await act(async () => again.unmount());

  // Signed in: read straight from the address, which is then cleared.
  history.replaceState(null, '', `/career/tracker?add=1&company=Beta#jd=${encodeURIComponent('Rust')}`);
  const direct = createRoot(document.getElementById('root'));
  await act(async () => direct.render(createElement(ApplicationTracker, { zh: true })));
  assert.equal([...document.querySelectorAll('form.resume-form textarea')].at(-1).value, 'Rust');
  assert.equal(location.search + location.hash, '');
  await act(async () => direct.unmount());
  await act(async () => kept.unmount());
});

test('the bookmarklet opens the tracker with the page title, site, address and selection', async () => {
  const host = document.createElement('div');
  const r = createRoot(host);
  await act(async () => r.render(createElement(TrackerBookmarklet, { zh: true })));
  const href = host.querySelector('a').getAttribute('href');
  assert.ok(href.startsWith('javascript:'));
  assert.ok(!href.includes('%'), 'a javascript: URL is percent-decoded before it runs');
  // Run it as a job page would: window.open recorded, the selection fixed.
  const run = (selection) => {
    let opened;
    new Function('window', 'getSelection', href.slice('javascript:'.length))({ open: (u) => (opened = u) }, () => selection);
    const url = new URL(opened);
    assert.equal(url.origin + url.pathname, 'https://cswork.test/career/tracker');
    return { ...Object.fromEntries(url.searchParams), jd: url.hash ? decodeURIComponent(url.hash.slice('#jd='.length)) : null };
  };
  history.replaceState(null, '', '/jobs/42?src=feed');
  const meta = document.head.appendChild(Object.assign(document.createElement('meta'), { content: 'Acme Careers' }));
  meta.setAttribute('property', 'og:site_name');
  document.title = 'Backend Engineer – Payments';
  assert.deepEqual(run('  Go, Kubernetes 🚀 \n'), {
    add: '1', company: 'Acme Careers', role: 'Backend Engineer – Payments', link: 'https://cswork.test/jobs/42?src=feed', jd: 'Go, Kubernetes 🚀',
  });
  // No site name: the host. An emoji cut in half at a limit is dropped, not a URIError.
  meta.remove();
  document.title = `${'x'.repeat(119)}🚀`;
  const cut = run(`${'y'.repeat(9999)}😀`);
  assert.deepEqual([cut.company, cut.role, cut.jd], ['cswork.test', 'x'.repeat(119), 'y'.repeat(9999)]);
  assert.equal(run('').jd, null);
  history.replaceState(null, '', '/career/tracker');
  await act(async () => r.unmount());
});
