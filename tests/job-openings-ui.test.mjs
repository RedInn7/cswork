// Openings on the page (components/job-list.tsx) and "Add to tracker": the posting links out with
// rel noopener noreferrer nofollow, the add link carries company, role and link, and the tracker
// (components/application-tracker.tsx) opens a filled-in Saved card from them, saved only on
// confirm, with the address cleaned and a non-https link dropped. Role, term and pay tags; hiding
// an opening in this browser; the mark on openings already on the tracker; saving the search;
// sponsorship badges and blocking a company (components/job-blocked.tsx).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/', virtualConsole: new VirtualConsole() });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, get: () => dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { JobList, payLabel, trackerAddPath } = await import('../components/job-list.tsx');
const { JobSearchSave } = await import('../components/job-search-save.tsx');
const { BlockToggle, BlockedList } = await import('../components/job-blocked.tsx');
const { DEFAULT_SEARCH } = await import('../lib/job-tags.ts');
const { ApplicationTracker, KeepTrackerAdd } = await import('../components/application-tracker.tsx');

const opening = {
  id: 'greenhouse:stripe:1',
  companySlug: 'stripe',
  title: 'Software Engineer, New Grad',
  location: 'Seattle, WA',
  url: 'https://stripe.com/jobs/search?gh_jid=1',
  kind: 'new-grad',
  postedAt: Date.UTC(2026, 9, 1, 12),
  pay: null,
  authFlags: -1,
};

test('an opening links out to the posting and to a filled-in tracker card', () => {
  const doc = new JSDOM(
    renderToStaticMarkup(
      createElement(JobList, {
        items: [opening, { ...opening, id: 'x', title: 'Data Science Intern, Summer 2027 Co-op', kind: 'intern', postedAt: null, location: '', pay: { min: 45, max: 55, currency: 'USD', unit: 'hour' } }],
        names: { stripe: 'Stripe' },
        zh: false,
        withCompany: true,
        h1b: { stripe: [2025, 1200] },
      }),
    ),
  ).window.document;
  const [first, second] = doc.querySelectorAll('li');
  const out = first.querySelector('.job-openings-title');
  assert.equal(out.getAttribute('href'), opening.url);
  assert.equal(out.getAttribute('rel'), 'noopener noreferrer nofollow');
  assert.equal(first.querySelector('.job-openings-facts a').getAttribute('href'), '/company/stripe#jobs');
  assert.equal(first.querySelector('[data-kind]').textContent, 'New grad');
  assert.equal(first.querySelector('time').getAttribute('datetime'), '2026-10-01');
  const add = first.querySelector('.job-openings-add');
  // The visible label starts its accessible name; the role tells the rows' buttons apart.
  assert.equal(add.textContent, 'Add to tracker: Software Engineer, New Grad');
  const target = new URL(add.getAttribute('href'), 'https://cswork.test');
  assert.equal(target.pathname, '/career/tracker');
  assert.deepEqual(Object.fromEntries(target.searchParams), { add: '1', company: 'Stripe', role: opening.title, link: opening.url });
  assert.equal(add.getAttribute('href'), trackerAddPath('Stripe', opening));
  assert.equal(second.querySelector('[data-kind]').textContent, 'Intern');
  assert.equal(second.querySelector('time'), null);
  // Tags read from the title, posted pay and H-1B.
  assert.deepEqual([...first.querySelectorAll('.job-openings-tag')].map((t) => t.textContent), ['Software']);
  assert.deepEqual([...second.querySelectorAll('.job-openings-tag')].map((t) => t.textContent), ['Data', 'Summer 2027 · Co-op']);
  assert.equal(second.querySelector('.job-openings-pay').textContent, '$45–55 / hour');
  assert.equal(first.querySelector('.job-openings-pay'), null);
  assert.match(first.querySelector('.job-openings-facts').textContent, /H-1B: 1,200 new approvals in FY2025/);
  // Nothing is hidden on the server: every row and its hide button render.
  assert.equal(doc.querySelector('.job-hidden-bar'), null);
  assert.equal(first.querySelector('.job-openings-hide').textContent, 'Hide: Software Engineer, New Grad');
});

test('pay labels', () => {
  assert.equal(payLabel({ min: 120000, max: 150000, currency: 'USD', unit: 'year' }, false), '$120k–150k / year');
  assert.equal(payLabel({ min: 210800, max: 248000, currency: 'USD', unit: 'year' }, true), '$210.8k–248k / 年');
  assert.equal(payLabel({ min: 40, max: 40, currency: 'CAD', unit: 'hour' }, true), 'CA$40 / 小时');
  assert.equal(payLabel({ min: 8000, max: 9500, currency: 'USD', unit: 'month' }, false), '$8,000–9,500 / month');
});

test('sponsorship badges: what the description says, none when unknown or clear', () => {
  const render = (zh, flags) =>
    [...new JSDOM(renderToStaticMarkup(createElement(JobList, { items: [{ ...opening, authFlags: flags }], names: { stripe: 'Stripe' }, zh }))).window.document.querySelectorAll('.job-openings-auth')].map(
      (b) => b.textContent,
    );
  assert.deepEqual(render(false, 7), ['No visa sponsorship', 'US citizen / green card', 'Security clearance']);
  assert.deepEqual(render(true, 5), ['写明不担保', '需安全许可']);
  assert.deepEqual(render(false, 2), ['US citizen / green card']);
  assert.deepEqual(render(false, 0), []);
  assert.deepEqual(render(false, -1), []);
});

const posted = [];
const notes = [];
// The server's career:jobs-blocked note, and each body saved to it.
let blockedNote = '';
const blocks = [];
let blockFails = false;
let tracked = [];
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  if (key === 'GET /api/oj/applications') return Response.json({ items: tracked, max: 300 });
  if (key === 'GET /api/oj/notes?target=career%3Ajobs-blocked') return Response.json({ target: 'career:jobs-blocked', body: blockedNote, updatedAt: null });
  if (key === 'PUT /api/oj/notes?target=career%3Ajobs-blocked') {
    if (blockFails) return Response.json({ error: 'busy' }, { status: 429 });
    blockedNote = JSON.parse(init.body).body;
    blocks.push(blockedNote);
    return Response.json({ ok: true });
  }
  if (key === 'PUT /api/oj/notes?target=career%3Ajobs-search') {
    notes.push(JSON.parse(init.body).body);
    return Response.json({ ok: true });
  }
  if (key === 'GET /api/oj/reports/companies') return Response.json({ items: [] });
  if (key === 'POST /api/oj/applications') {
    const body = JSON.parse(init.body);
    posted.push(body);
    // The server's card: wave 8 fields included (lib/server/applications.ts).
    return Response.json({
      item: { id: 'n', companySlug: '', stageLog: [[body.stage, Date.now()]], hasJd: false, createdAt: Date.now(), updatedAt: Date.now(), links: null, closedAt: null, prep: null, ...body },
    });
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};

async function open(query) {
  dom.reconfigure({ url: `https://cswork.test/career/tracker?${query}` });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ApplicationTracker, { zh: false })));
  await act(async () => {});
  return { host, root };
}

test('the tracker opens the add form filled in, at Saved, and saves only on confirm', async () => {
  const { host, root } = await open(new URLSearchParams({ add: '1', company: 'Stripe', role: opening.title, link: opening.url }));
  assert.equal(location.search, '', 'the address is cleaned');
  assert.equal(location.pathname, '/career/tracker');
  const form = host.querySelector('form.resume-form');
  assert.ok(form, 'the add form is open');
  const [company, role] = form.querySelectorAll('input');
  assert.equal(company.value, 'Stripe');
  assert.equal(role.value, opening.title);
  assert.equal(form.querySelector('input[type="url"]').value, opening.url);
  assert.equal(form.querySelector('select').value, 'saved');
  assert.equal(document.activeElement, company);
  assert.equal(posted.length, 0, 'nothing is saved before the learner confirms');
  await act(async () => form.requestSubmit());
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], {
    company: 'Stripe', role: opening.title, stage: 'saved', appliedAt: null, oaDeadline: null, interviewAt: null, offerDeadline: null, referral: '', link: opening.url, notes: '',
    // The wave 8 card fields, left at their defaults.
    channel: '', referralStatus: '', nextAction: '', nextAt: null, resumeVersion: '', jdText: '',
  });
  assert.equal(host.querySelector('form.resume-form'), null);
  await act(async () => root.unmount());
});

test('a non-https link is dropped, and without add=1 nothing opens', async () => {
  let view = await open(new URLSearchParams({ add: '1', company: 'Acme', role: 'Intern', link: 'javascript:alert(1)' }));
  assert.equal(view.host.querySelector('input[type="url"]').value, '');
  await act(async () => view.root.unmount());
  view = await open(new URLSearchParams({ add: '1', company: 'Acme', link: 'http://example.com/j' }));
  assert.equal(view.host.querySelector('input[type="url"]').value, '');
  await act(async () => view.root.unmount());
  view = await open(new URLSearchParams({ company: 'Acme' }));
  assert.equal(view.host.querySelector('form.resume-form'), null);
  assert.equal(location.search, '?company=Acme', 'an address without add=1 is left alone');
  await act(async () => view.root.unmount());
});

test('signed out, the opening waits in this tab and fills in the form once the board opens', async () => {
  const query = new URLSearchParams({ add: '1', company: 'Acme', role: 'SWE Intern', link: 'https://example.com/j' });
  dom.reconfigure({ url: `https://cswork.test/career/tracker?${query}` });
  const host = document.createElement('div');
  document.body.append(host);
  const signedOut = createRoot(host);
  await act(async () => signedOut.render(createElement(KeepTrackerAdd)));
  await act(async () => signedOut.unmount());
  // Signed in, back at the tracker from the nav: no query in the address.
  const view = await open('');
  const form = view.host.querySelector('form.resume-form');
  assert.ok(form, 'the add form is open');
  assert.equal(form.querySelector('input').value, 'Acme');
  assert.equal(form.querySelector('input[type="url"]').value, 'https://example.com/j');
  assert.equal(sessionStorage.getItem('cswork:tracker:add'), null, 'read once');
  await act(async () => view.root.unmount());
  const again = await open('');
  assert.equal(again.host.querySelector('form.resume-form'), null);
  await act(async () => again.root.unmount());
});

const rows = [
  opening,
  { ...opening, id: 'greenhouse:stripe:2', title: 'Software Engineer Intern', url: 'https://stripe.com/jobs/search?gh_jid=2', kind: 'intern' },
  { ...opening, id: 'greenhouse:stripe:3', title: 'Data Engineer, New Grad', url: 'https://stripe.com/jobs/search?gh_jid=3' },
];
async function list(props = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(JobList, { items: rows, names: { stripe: 'Stripe' }, zh: false, ...props })));
  await act(async () => {});
  return { host, root, titles: () => [...host.querySelectorAll('.job-openings-title')].map((a) => a.textContent) };
}

test('hiding: kept in this browser, out of the list until shown again, focus moves on', async () => {
  localStorage.clear();
  const view = await list();
  assert.equal(view.titles().length, 3);
  const [, second] = view.host.querySelectorAll('.job-openings-hide');
  second.focus();
  await act(async () => second.click());
  assert.deepEqual(view.titles(), ['Software Engineer, New Grad', 'Data Engineer, New Grad']);
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:jobs:hidden')), ['greenhouse:stripe:2']);
  assert.equal(document.activeElement.textContent, 'Hide: Data Engineer, New Grad', 'focus moves to the next row');
  const bar = view.host.querySelector('.job-hidden-bar');
  assert.equal(bar.querySelector('output').textContent, '1 hidden opening');
  const toggle = bar.querySelector('button');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  await act(async () => toggle.click());
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(view.titles().length, 3);
  const unhide = [...view.host.querySelectorAll('.job-openings-hide')].find((b) => b.textContent.startsWith('Unhide'));
  assert.equal(unhide.textContent, 'Unhide: Software Engineer Intern');
  await act(async () => unhide.click());
  assert.deepEqual(JSON.parse(localStorage.getItem('cswork:jobs:hidden')), []);
  assert.equal(view.host.querySelector('.job-hidden-bar'), null);
  await act(async () => view.root.unmount());
  // Hiding the last row left sends focus to the toggle.
  localStorage.setItem('cswork:jobs:hidden', JSON.stringify(['greenhouse:stripe:1', 'greenhouse:stripe:2']));
  const last = await list();
  assert.deepEqual(last.titles(), ['Data Engineer, New Grad']);
  await act(async () => last.host.querySelector('.job-openings-hide').click());
  assert.deepEqual(last.titles(), []);
  assert.equal(document.activeElement.textContent, 'Show hidden');
  assert.equal(last.host.querySelector('output').textContent, '3 hidden openings');
  await act(async () => last.root.unmount());
});

test('hidden ids: at most 500, and storage that is broken or off is no error', async () => {
  localStorage.setItem('cswork:jobs:hidden', JSON.stringify(Array.from({ length: 500 }, (_, i) => `old:${i}`)));
  const view = await list();
  await act(async () => view.host.querySelector('.job-openings-hide').click());
  const ids = JSON.parse(localStorage.getItem('cswork:jobs:hidden'));
  assert.equal(ids.length, 500);
  assert.equal(ids[0], 'old:1');
  assert.equal(ids.at(-1), 'greenhouse:stripe:1');
  await act(async () => view.root.unmount());
  localStorage.setItem('cswork:jobs:hidden', '{oops');
  const broken = await list();
  assert.equal(broken.titles().length, 3);
  await act(async () => broken.root.unmount());
  const storage = dom.window.Storage.prototype;
  const { getItem, setItem } = storage;
  storage.getItem = storage.setItem = () => {
    throw new Error('blocked');
  };
  try {
    const off = await list();
    await act(async () => off.host.querySelector('.job-openings-hide').click());
    assert.equal(off.titles().length, 2, 'hidden for this visit');
    await act(async () => off.root.unmount());
  } finally {
    Object.assign(storage, { getItem, setItem });
  }
});

test('signed in, openings already on the tracker say so instead of offering to add', async () => {
  localStorage.clear();
  // A card saved from a bookmark with tracking parameters still matches.
  tracked = [{ link: 'https://stripe.com/jobs/search?gh_jid=3&utm_source=newsletter#apply' }, { link: '' }];
  const signedOut = await list();
  assert.equal(signedOut.host.querySelectorAll('.job-openings-tracked').length, 0, 'signed out: not asked');
  await act(async () => signedOut.root.unmount());
  const view = await list({ signedIn: true });
  const marks = [...view.host.querySelectorAll('.job-openings-tracked')];
  assert.equal(marks.length, 1);
  assert.equal(marks[0].textContent, 'On your tracker: Data Engineer, New Grad');
  assert.equal(marks[0].getAttribute('href'), '/career/tracker');
  assert.equal(view.host.querySelectorAll('.job-openings-add').length, 2);
  await act(async () => view.root.unmount());
  tracked = [];
});

test('saving the search: one note, replaced or deleted, focus kept', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const search = { ...DEFAULT_SEARCH, kind: 'intern', role: 'ml' };
  await act(async () => root.render(createElement(JobSearchSave, { zh: false, search, saved: 'other' })));
  const replace = host.querySelector('button');
  assert.equal(replace.textContent, 'Replace my saved search with this one');
  await act(async () => replace.click());
  assert.deepEqual(JSON.parse(notes.at(-1)), search);
  assert.match(host.querySelector('[role="status"]').textContent, /^Saved/);
  assert.equal(document.activeElement.textContent, 'Delete my saved search');
  await act(async () => document.activeElement.click());
  assert.equal(notes.at(-1), '', 'an empty note removes it');
  assert.equal(document.activeElement.textContent, 'Save this search and tell me about new matches');
  assert.equal(host.querySelector('.job-search-forget'), null);
  await act(async () => root.unmount());
});

const two = [
  ...rows,
  { ...opening, id: 'lever:ramp:1', companySlug: 'ramp', title: 'Backend Engineer Intern', url: 'https://jobs.lever.co/ramp/1', kind: 'intern' },
];
test('blocking from the list: every row of the company goes, with an undo; focus kept; failures said', async () => {
  localStorage.clear();
  blocks.length = 0;
  blockedNote = '["figma"]';
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (props) => act(async () => root.render(createElement(JobList, { items: two, names: { stripe: 'Stripe', ramp: 'Ramp' }, zh: false, withCompany: true, signedIn: true, ...props })));
  const titles = () => [...host.querySelectorAll('.job-openings-title')].map((a) => a.textContent);
  // Without the blocked list (signed out, or one company's page): no block buttons.
  await render({ signedIn: false });
  assert.equal(host.querySelector('.job-openings-block'), null);
  await act(async () => root.unmount());
  const view = createRoot(host);
  await act(async () => view.render(createElement(JobList, { items: two, names: { stripe: 'Stripe', ramp: 'Ramp' }, zh: false, withCompany: true, signedIn: true, blocked: ['figma'] })));
  await act(async () => {});
  const buttons = [...host.querySelectorAll('.job-openings-block')];
  assert.equal(buttons.length, 4);
  assert.equal(buttons[0].textContent, 'Block company: Stripe');
  await act(async () => buttons[0].click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['figma', 'stripe']);
  assert.deepEqual(titles(), ['Backend Engineer Intern']);
  assert.equal(host.querySelector('.job-hidden-bar output').textContent, 'Blocked Stripe: its roles are no longer shown.');
  assert.equal(document.activeElement.textContent, 'Undo: block Stripe');
  await act(async () => document.activeElement.click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['figma']);
  assert.equal(titles().length, 4);
  assert.equal(host.querySelector('.job-hidden-bar'), null);
  assert.equal(document.activeElement.textContent, 'Block company: Stripe', 'focus goes back to the company’s first row');
  // Not saved: nothing goes, and it says so.
  blockFails = true;
  await act(async () => host.querySelector('.job-openings-block').click());
  blockFails = false;
  assert.equal(titles().length, 4);
  assert.equal(host.querySelector('[role="alert"]').textContent, 'Not saved. Please try again.');
  await act(async () => view.unmount());
  // Undoing the only block removes the note.
  blockedNote = '';
  const last = createRoot(host);
  await act(async () => last.render(createElement(JobList, { items: two, names: { ramp: 'Ramp' }, zh: true, withCompany: true, signedIn: true, blocked: [] })));
  await act(async () => [...host.querySelectorAll('.job-openings-block')].at(-1).click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['ramp']);
  await act(async () => document.activeElement.click());
  assert.equal(blocks.at(-1), '', 'an empty list removes the note');
  await act(async () => last.unmount());
  host.remove();
});

test('blocking: at most 100 companies, nothing sent past that', async () => {
  blocks.length = 0;
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const full = Array.from({ length: 100 }, (_, i) => `co-${i}`);
  blockedNote = JSON.stringify(full);
  await act(async () => root.render(createElement(JobList, { items: two, names: {}, zh: true, withCompany: true, signedIn: true, blocked: full })));
  await act(async () => host.querySelector('.job-openings-block').click());
  assert.equal(blocks.length, 0);
  assert.equal(host.querySelector('[role="alert"]').textContent, '最多屏蔽 100 家公司，请先取消几家。');
  await act(async () => root.unmount());
  host.remove();
});

test('the company page toggle and the blocked list', async () => {
  blocks.length = 0;
  const signedOut = new JSDOM(renderToStaticMarkup(createElement(BlockToggle, { zh: true, slug: 'stripe', name: 'Stripe', blocked: null }))).window.document;
  const link = signedOut.querySelector('a');
  assert.equal(link.textContent, '登录后可屏蔽公司');
  assert.equal(link.getAttribute('href'), '/?view=account');
  assert.equal(signedOut.querySelector('button'), null);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  blockedNote = '["ramp"]';
  await act(async () => root.render(createElement(BlockToggle, { zh: false, slug: 'stripe', name: 'Stripe', blocked: ['ramp'] })));
  const button = host.querySelector('button');
  assert.equal(button.textContent, 'Block this company: Stripe');
  assert.equal(host.querySelector('.job-block output').textContent, '');
  button.focus();
  await act(async () => button.click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['ramp', 'stripe']);
  assert.equal(button.textContent, 'Unblock: Stripe');
  assert.equal(document.activeElement, button, 'the same button keeps focus');
  assert.match(host.querySelector('.job-block output').textContent, /news from companies you follow still arrives/);
  await act(async () => button.click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['ramp']);
  assert.equal(button.textContent, 'Block this company: Stripe');
  await act(async () => root.render(createElement(BlockedList, { zh: false, blocked: ['ramp', 'stripe'], names: { ramp: 'Ramp', stripe: 'Stripe' } })));
  assert.equal(host.querySelector('summary').textContent, '2 blocked companies · Manage');
  const unblock = [...host.querySelectorAll('.job-blocked button')];
  assert.deepEqual(unblock.map((b) => b.textContent), ['Unblock: Ramp', 'Unblock: Stripe']);
  // Saved, then the page reloads (jsdom does not navigate). The list is read fresh: one blocked
  // since the page loaded (another tab, a row's button) stays blocked.
  blockedNote = '["ramp","stripe","figma"]';
  await act(async () => unblock[0].click());
  assert.deepEqual(JSON.parse(blocks.at(-1)), ['stripe', 'figma']);
  await act(async () => root.render(createElement(BlockedList, { zh: true, blocked: [], names: {} })));
  assert.equal(host.querySelector('.job-blocked'), null, 'nothing blocked: no list');
  await act(async () => root.unmount());
  host.remove();
});
