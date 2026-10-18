// Under the builder's rule check (components/resume-extend.tsx): the follow-up questions copy for a
// friend without the name or contact lines and send nothing when signed out; signed in, the ticked
// ones become cards (already-added ones marked, a 409 stops with what got in); the LinkedIn check
// keeps its fields in this browser, starts the URL from the resume and focuses the field an issue names.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/career/resume/builder', virtualConsole: new VirtualConsole() });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'localStorage', 'sessionStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ResumeBuilder } = await import('../components/resume-builder.tsx');
const { LINKEDIN_KEY } = await import('../lib/linkedin-check.ts');
const { drillId } = await import('../lib/resume-drill.ts');
const { parseCard } = await import('../lib/recall-cards.ts');

const REDIS = 'Built a Redis cache in front of the search API, cutting p99 latency from 420 ms to 180 ms';
const LED = 'Led a team of 3 to move 14 cron jobs onto Kubernetes';
localStorage.setItem(
  'cswork:resume:v1',
  JSON.stringify({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+1 206 555 0100',
    links: 'github.com/ada, linkedin.com/in/ada-lovelace-4b2a1c39',
    experience: [{ title: 'Acme', subtitle: 'Software Engineer Intern', dates: 'Summer 2025', bullets: `- ${REDIS}\n- ${LED}` }],
    skills: 'Languages: Go, Python',
  }),
);

const calls = [];
const puts = [];
let putLimit = Infinity;
globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET';
  calls.push(`${method} ${String(url)}`);
  if (method === 'GET' && String(url) === '/api/oj/notes?prefix=card%3A') return Response.json({ items: [{ target: `card:${drillId('measure', REDIS)}`, body: '{}' }] });
  if (method === 'PUT' && String(url).startsWith('/api/oj/notes?target=card:')) {
    if (puts.length >= putLimit) return Response.json({ error: 'Card limit reached (200 cards)' }, { status: 409 });
    puts.push({ url: String(url), body: JSON.parse(init.body).body });
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'no route' }, { status: 404 });
};
let copied = '';
Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void (copied = text) } });

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const setValue = async (field, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
async function mount(props) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ResumeBuilder, props)));
  await settle();
  return { host, unmount: () => act(async () => root.unmount()) };
}
const open = (details) =>
  act(async () => {
    details.open = true;
    details.dispatchEvent(new window.Event('toggle'));
  });

test('signed out: the questions copy for a friend without name or contact, and nothing is sent', async () => {
  calls.length = 0;
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  const drill = host.querySelector('details#resume-drill');
  assert.match(drill.querySelector('summary').textContent, /\(4\)$/);
  await open(drill);
  assert.equal(drill.querySelector('legend').textContent, 'Acme');
  const boxes = [...drill.querySelectorAll('input[type="checkbox"]')];
  assert.equal(boxes.length, 4);
  assert.ok(boxes.every((b) => b.checked && b.closest('label')));
  assert.equal(button(drill, 'Add to review'), undefined);
  assert.match(drill.textContent, /Sign in to add the ticked questions/);
  await act(async () => boxes[2].click());
  await act(async () => boxes[3].click());
  await act(async () => button(drill, 'Copy for a friend').click());
  await settle();
  assert.match(copied, /^Resume follow-ups · 2 questions\n/);
  assert.ok(copied.includes(REDIS));
  assert.equal(copied.includes(LED), false, 'unticked questions are left out');
  for (const secret of ['Ada', 'Lovelace', 'ada@example.com', '555', 'linkedin.com']) assert.equal(copied.includes(secret), false, secret);
  assert.equal(drill.querySelector('.resume-extend-status').textContent, 'Copied 2: send them to a friend to ask you.');
  assert.deepEqual(calls.filter((c) => !c.startsWith('GET /api/oj/ai')), [], 'no request at all signed out');
  await unmount();
});

test('signed in: already-added questions are marked, the ticked ones become cards, and a 409 stops the run', async () => {
  calls.length = 0;
  const { host, unmount } = await mount({ zh: true, signedIn: true });
  const drill = host.querySelector('details#resume-drill');
  await open(drill);
  await settle();
  assert.ok(calls.includes('GET /api/oj/notes?prefix=card%3A'));
  const marked = [...drill.querySelectorAll('li')].filter((li) => li.querySelector('.resume-drill-saved'));
  assert.deepEqual(marked.map((li) => li.querySelector('label span').textContent), ['「p99 latency」是怎么测出来的？基线是多少？']);
  assert.equal(drill.querySelector('.resume-actions small').textContent, '账户里已有 1 张卡，还能加 199 张');

  await act(async () => button(drill, '加入复习（4）').click());
  await settle(30);
  assert.equal(puts.length, 4);
  // The card already in the account goes first (an overwrite, free under the cap).
  assert.equal(puts[0].url, `/api/oj/notes?target=card:${drillId('measure', REDIS)}`);
  for (const put of puts) {
    const card = parseCard(put.body);
    assert.ok(card, 'every body passes parseCard');
    assert.equal(card.tags[0], 'resume');
    assert.match(card.front, /^Acme：/);
    assert.equal(card.src.href, '/career/resume/builder#resume-experience-0-bullets');
    assert.equal(put.body.includes('Lovelace'), false);
  }
  const status = drill.querySelector('.resume-extend-status');
  assert.match(status.textContent, /^已加入 4 张，今天就会出现在「今日复习」里。/);
  assert.equal(status.querySelector('a').getAttribute('href'), '/?view=review-session');
  assert.equal(drill.querySelectorAll('.resume-drill-saved').length, 4);

  puts.length = 0;
  putLimit = 1;
  await act(async () => button(drill, '加入复习').click());
  await settle(30);
  assert.equal(puts.length, 1);
  assert.equal(drill.querySelector('[role="alert"]').textContent, '已加入 1 张。 Card limit reached (200 cards)');
  putLimit = Infinity;
  await unmount();
});

test('the LinkedIn check keeps its fields in this browser, starts from the resume URL and opens the field an issue names', async () => {
  localStorage.removeItem(LINKEDIN_KEY);
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  const box = host.querySelector('details#resume-linkedin');
  for (const field of box.querySelectorAll('input, textarea')) assert.ok(field.closest('label'), 'every field has a label');
  assert.equal(box.querySelector('[role="radiogroup"]').getAttribute('aria-labelledby'), box.querySelector('[role="radiogroup"] > span').id);
  assert.equal(box.querySelector('#linkedin-url').value, 'linkedin.com/in/ada-lovelace-4b2a1c39');
  // Everything empty but the URL (its random tail costs 6 of 10): 100 - 20 - 15 - 25 - 20 - 6 - 5.
  assert.equal(box.querySelector('.resume-linkedin-score').textContent, '9');
  await setValue(box.querySelector('#linkedin-headline'), 'Software Engineer Intern · Go · Python');
  await act(async () => box.querySelector('input[value="recruiters"]').click());
  const stored = JSON.parse(localStorage.getItem(LINKEDIN_KEY));
  assert.equal(stored.headline, 'Software Engineer Intern · Go · Python');
  assert.equal(stored.openToWork, 'recruiters');
  assert.equal(stored.url, 'linkedin.com/in/ada-lovelace-4b2a1c39');
  // Go and Python from the resume are in the headline now; Redis and Kubernetes are still missing.
  const issue = [...box.querySelectorAll('.resume-check li button')].find((b) => b.textContent.startsWith('The URL'));
  assert.match(issue.textContent, /ends in a random tail/);
  await act(async () => issue.click());
  assert.ok(document.activeElement === box.querySelector('#linkedin-url'), 'focused');
  await act(async () => [...box.querySelectorAll('.resume-check li button')].find((b) => b.textContent.startsWith('Only 0 skills')).click());
  assert.ok(document.activeElement === box.querySelector('#linkedin-skills'), 'focused');
  assert.match(box.querySelector('.resume-check > small').textContent, /compared against 4 technical terms/);
  await unmount();

  // It comes back on the next visit.
  const again = await mount({ zh: false, signedIn: false });
  assert.equal(again.host.querySelector('#linkedin-headline').value, 'Software Engineer Intern · Go · Python');
  assert.equal(again.host.querySelector('input[value="recruiters"]').checked, true);
  await again.unmount();
});
