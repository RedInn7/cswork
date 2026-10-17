// Career outreach pages: /career/contacts (components/contacts.tsx) lists follow-ups due first and
// filters by company; /career/templates (components/outreach-templates.tsx) fills a message from a
// contact and its card, copies it and opens it in a mail app; a guide chapter's checklist
// (components/guide-checklist.tsx) keeps its ticks in the browser signed out and in a note signed in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/career/templates?contact=sam' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { Contacts } = await import('../components/contacts.tsx');
const { OutreachTemplates } = await import('../components/outreach-templates.tsx');
const { GuideChecklist } = await import('../components/guide-checklist.tsx');
const { CAREER_CHECKLISTS } = await import('../lib/content/career-checklists.ts');

const DAY = 86400000;
const now = Date.now();
const contact = (patch) => ({
  id: 'c', name: 'Someone', company: '', role: '', howMet: '', url: '', lastContactAt: null, nextAt: null, notes: '',
  applicationId: null, createdAt: 1, updatedAt: 1, ...patch,
});
const contacts = [
  contact({ id: 'kim', name: 'Kim', company: 'Initech', nextAt: now + 5 * DAY }),
  contact({ id: 'sam', name: 'Sam', company: 'Acme', role: 'Engineer', url: 'https://example.com/sam', nextAt: now - 2 * DAY, applicationId: 'acme' }),
  contact({ id: 'lou', name: 'Lou', company: 'Acme' }),
  contact({ id: 'ida', name: 'Ida', company: 'Initech', nextAt: now - 5 * DAY }),
];
const applications = [
  { id: 'acme', company: 'Acme', role: 'SWE Intern', stage: 'phone', interviewAt: new Date(2099, 2, 4, 15).getTime() },
];
const calls = [];
let note = { body: '' };
let signedIn = true;
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push([key, body]);
  if (key === 'GET /api/oj/contacts') return Response.json({ items: contacts, max: 200 });
  if (key === 'GET /api/oj/applications') return Response.json({ items: applications, max: 300 });
  if (key === 'POST /api/oj/contacts') return Response.json({ item: contact({ id: 'new', ...body }) });
  if (key.endsWith('/api/oj/notes?target=checklist%3Aresume')) {
    if (!signedIn) return Response.json({ error: '请先登录' }, { status: 401 });
    if (init.method === 'PUT') note = body;
    return Response.json(note);
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};
const root = createRoot(document.getElementById('root'));
const settle = () => act(async () => new Promise((done) => setTimeout(done, 0)));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const field = (text) => [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith(text)).querySelector('input, select, textarea');
const setValue = async (element, value, type = 'input') => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set;
  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new window.Event(type, { bubbles: true }));
  });
};
const names = () => [...document.querySelectorAll('.contacts-list .tracker-company')].map((p) => p.textContent);

test('contacts: follow-ups due first, oldest first; a company filter; adding posts the form', async () => {
  await act(async () => root.render(createElement(Contacts, { zh: false })));
  await settle();
  assert.deepEqual(names(), ['Ida', 'Sam', 'Kim', 'Lou']);
  const sam = document.querySelector('[data-id="sam"]');
  assert.equal(sam.getAttribute('data-due'), 'soon');
  assert.match(sam.querySelector('.tracker-due').textContent, /^Follow up now: /);
  assert.deepEqual(
    [...sam.querySelectorAll('.tracker-links a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['Application: Acme', '/career/tracker'], ['Profile', 'https://example.com/sam'], ['Write a message', '/career/templates?contact=sam']],
  );
  assert.equal(sam.querySelector('a[href^="https:"]').rel, 'noopener noreferrer');
  assert.match(document.querySelector('.contacts .resume-actions small').textContent, /^2 to follow up/);

  await setValue(field('Company'), 'Acme', 'change');
  assert.deepEqual(names(), ['Sam', 'Lou']);
  await setValue(field('Company'), '', 'change');

  await act(async () => button('Add contact').click());
  const form = document.querySelector('form.resume-form');
  assert.equal(document.activeElement, form.querySelector('input'));
  assert.deepEqual([...form.querySelectorAll('select option')].map((o) => o.textContent), ['None', 'Acme · SWE Intern']);
  await setValue(field('Name'), 'Pat');
  await setValue(field('Profile link'), 'http://example.com');
  await act(async () => form.querySelector('button[type="submit"]').click());
  assert.match(document.querySelector('.resume-error').textContent, /https/);
  await setValue(field('Profile link'), '');
  await setValue(field('Next follow-up'), '2099-03-04');
  await setValue(field('Linked application'), 'acme', 'change');
  await act(async () => form.querySelector('button[type="submit"]').click());
  const [, sent] = calls.find(([k]) => k === 'POST /api/oj/contacts');
  assert.deepEqual(
    [sent.name, sent.url, sent.nextAt, sent.lastContactAt, sent.applicationId],
    ['Pat', '', new Date(2099, 2, 4).getTime(), null, 'acme'],
  );
  assert.equal(document.querySelector('form.resume-form'), null);
  assert.ok(names().includes('Pat'));
  await act(async () => root.render(createElement('div')));
});

test('templates: filled from the contact in the address and its card, copied and opened as mailto', async () => {
  const copied = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void copied.push(text) } });
  await act(async () => root.render(createElement(OutreachTemplates, { zh: false, signedIn: true })));
  await settle();
  assert.equal(document.querySelectorAll('.outreach-picker input').length, 11);
  assert.equal(field('Fill from a card or contact').value, 'c:sam');
  assert.equal(field('Their name').value, 'Sam');
  // Referral ask: the role comes from Sam's linked card.
  assert.match(document.querySelector('.outreach-subject').textContent, /^Subject: Referral request: SWE Intern at Acme$/);
  // Still to write: the learner's name and the bracketed hints.
  assert.deepEqual(
    [...document.querySelectorAll('.outreach-body mark')].map((m) => m.textContent).slice(-1),
    ['{myName}'],
  );
  await setValue(field('Your name'), 'Ada');
  assert.equal(localStorage.getItem('cswork:outreach:my-name'), 'Ada');

  // The thank-you note takes the interview date; the language can differ from the site's.
  await act(async () => document.querySelector('.outreach-picker input[value="thank-you"]').click());
  assert.equal(field('Interview date').value, '2099-03-04');
  await setValue(field('Message language'), 'zh', 'change');
  const body = document.querySelector('.outreach-body').textContent;
  // Only the message takes its language; the preview's own labels keep the site's.
  assert.equal(document.querySelector('.outreach-body').lang, 'zh-CN');
  assert.equal(document.querySelector('.outreach-preview').getAttribute('lang'), null);
  assert.ok(body.startsWith('Sam，您好：') && body.includes('感谢您 2099-03-04 抽时间') && body.trimEnd().endsWith('Ada'), body);
  await act(async () => button('Copy body').click());
  await settle();
  assert.deepEqual(copied, [body]);
  assert.equal(document.querySelector('.resume-actions output').textContent, 'Body copied.');
  const mailto = new URL(document.querySelector('.outreach-mailto').href);
  assert.equal(mailto.protocol, 'mailto:');
  assert.equal(mailto.pathname, '', 'the learner picks the recipient');
  assert.equal(new URLSearchParams(mailto.search).get('body'), body);
  assert.equal(new URLSearchParams(mailto.search).get('subject'), '感谢面试：SWE Intern');

  // Negotiation points to the offer comparison.
  assert.equal(document.querySelector('.outreach-tip a'), null);
  await act(async () => document.querySelector('.outreach-picker input[value="counter-competing"]').click());
  assert.equal(document.querySelector('.outreach-tip a').getAttribute('href'), '/career/offers');
  assert.ok(field('Other company'));
  await act(async () => root.render(createElement('div')));
});

test('templates signed out: typed by hand, nothing fetched', async () => {
  calls.length = 0;
  await act(async () => root.render(createElement(OutreachTemplates, { zh: true, signedIn: false })));
  await settle();
  assert.deepEqual(calls, []);
  assert.match(document.querySelector('.outreach-signin').textContent, /登录后/);
  assert.equal(field('你的名字').value, 'Ada', 'remembered in this browser');
  await setValue(field('公司'), 'Globex');
  assert.equal(document.querySelector('.outreach-subject').textContent, '主题：内推请求：Globex {role}');
  await act(async () => root.render(createElement('div')));
});

test("templates from the tracker's offer links: the expedite request and the extension take the offer's deadline", async () => {
  applications.push({ id: 'off', company: 'Globex', role: 'SWE', stage: 'offer', offerDeadline: new Date(2099, 3, 1, 17).getTime() });
  const open = async (query) => {
    dom.reconfigure({ url: `https://cswork.test/career/templates?${query}` });
    await act(async () => root.render(createElement(OutreachTemplates, { zh: false, signedIn: true })));
    await settle();
  };
  await open('template=expedite&application=acme&offer=off');
  assert.equal(document.querySelector('.outreach-picker input:checked').value, 'expedite');
  assert.deepEqual([field('Other company').value, field('Current deadline').value], ['Globex', '2099-04-01']);
  assert.equal(document.querySelector('.outreach-subject').textContent, 'Subject: Interview timeline: SWE Intern at Acme');
  await act(async () => root.render(createElement('div')));
  await open('template=extension&application=off');
  assert.deepEqual([field('Company').value, field('Current deadline').value], ['Globex', '2099-04-01']);
  await act(async () => root.render(createElement('div')));
  applications.pop();
  dom.reconfigure({ url: 'https://cswork.test/career/templates?contact=sam' });
});

test('checklist: ticks stay in the browser signed out and move to the note on the next signed-in visit', async () => {
  const items = CAREER_CHECKLISTS.resume;
  const render = () => act(async () => root.render(createElement(GuideChecklist, { slug: 'resume', items, zh: false })));
  const box = (i) => document.querySelectorAll('.guide-checklist input[type="checkbox"]')[i];
  signedIn = false;
  // Held until we know where ticks go, so the load can't overwrite one made meanwhile.
  const realFetch = globalThis.fetch;
  let release;
  globalThis.fetch = (...args) => new Promise((done) => (release = () => done(realFetch(...args))));
  await render();
  assert.equal(box(0).disabled, true, 'no ticks while the account is loading');
  globalThis.fetch = realFetch;
  release();
  await settle();
  assert.equal(box(0).disabled, false);
  assert.equal(document.querySelector('.guide-checklist output').textContent, `0% done (0/${items.length})`);
  await act(async () => box(1).click());
  await act(async () => box(0).click());
  assert.equal(localStorage.getItem('cswork:checklist:resume'), JSON.stringify([items[0].id, items[1].id]));
  assert.equal(document.querySelector('.guide-checklist output').textContent, `20% done (2/${items.length})`);
  assert.match(document.querySelector('.guide-checklist small').textContent, /Signed out/);
  // Every item explains itself.
  assert.equal(document.querySelectorAll('.guide-checklist details').length, items.length);
  await act(async () => root.render(createElement('div')));

  signedIn = true;
  await render();
  await settle();
  await settle();
  assert.deepEqual(JSON.parse(note.body), [items[0].id, items[1].id]);
  assert.equal(localStorage.getItem('cswork:checklist:resume'), null);
  assert.equal(box(1).checked, true);
  await act(async () => box(0).click());
  await settle();
  assert.deepEqual(JSON.parse(note.body), [items[1].id]);
  await act(async () => box(1).click());
  await settle();
  assert.equal(note.body, '', 'none ticked removes the note');
  await act(async () => root.render(createElement('div')));

  // Signed into an account that already has ticks: this browser's merge in and leave the browser,
  // so unticking everything later can't bring them back.
  note = { body: JSON.stringify([items[0].id]) };
  localStorage.setItem('cswork:checklist:resume', JSON.stringify([items[2].id]));
  await render();
  await settle();
  await settle();
  assert.deepEqual(JSON.parse(note.body), [items[0].id, items[2].id]);
  assert.equal(localStorage.getItem('cswork:checklist:resume'), null);
  await act(async () => box(0).click());
  await act(async () => box(2).click());
  await settle();
  assert.equal(note.body, '');
  await act(async () => root.render(createElement('div')));
  await render();
  await settle();
  await settle();
  assert.equal(box(2).checked, false, 'stays unticked');
  await act(async () => root.render(createElement('div')));
});
