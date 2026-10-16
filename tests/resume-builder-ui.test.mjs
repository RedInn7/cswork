// /career/resume/builder (components/resume-builder.tsx): the sheet is one column under standard
// headings with no tables or images, the resume lives in this browser only, a long one warns about
// the second page, signed-in learners pull in their CSWork record, and the AI review picks it up.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const KEY = 'cswork:resume:v1';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'https://cswork.test/career/resume/builder',
  virtualConsole: new VirtualConsole(), // jsdom cannot navigate or follow a download link; keep that quiet
});
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'localStorage', 'sessionStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ResumeBuilder, REVIEW_KEY } = await import('../components/resume-builder.tsx');
const { ResumeReview } = await import('../components/resume-review.tsx');
const { SITEMAP_STATIC_ENTRIES } = await import('../lib/seo.ts');

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push(`${init.method ?? 'GET'} ${String(url)}`);
  if (String(url) === '/api/oj/profile/resume-facts')
    return Response.json({
      certificates: [{ id: 'MyCert0000000001', course: 'System Design Interview Course', issuedAt: Date.UTC(2026, 2, 3), skill: false }],
      rating: 1588,
      contests: 2,
      solved: { total: 12, easy: 5, medium: 6, hard: 1 },
      handle: 'ada',
    });
  if (String(url) === '/api/oj/ai/usage') return Response.json({ resume: 2, bonus: 0 });
  return Response.json({ error: 'no route' }, { status: 404 });
};
const blobs = [];
URL.createObjectURL = (blob) => (blobs.push(blob), 'blob:test');
URL.revokeObjectURL = () => {};

const setValue = async (field, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
};
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
async function mount(props) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(ResumeBuilder, props)));
  return { host, unmount: () => act(async () => root.unmount()) };
}

test('the server render is a labelled form beside an empty sheet, and the page is in the sitemap', () => {
  const doc = new JSDOM(renderToStaticMarkup(createElement(ResumeBuilder, { zh: true, signedIn: false }))).window.document;
  for (const field of doc.querySelectorAll('input:not([type="file"]), textarea')) assert.ok(field.closest('label'), 'every field has a label');
  assert.deepEqual([...doc.querySelectorAll('legend')].map((l) => l.textContent), ['基本信息', '教育经历', '工作经历', '项目', '技能、奖项与证书']);
  assert.equal(doc.querySelector('.resume-sheet h2').textContent, '你的姓名');
  assert.equal(doc.querySelectorAll('.resume-sheet h3').length, 0);
  assert.equal([...doc.querySelectorAll('button')].some((b) => b.textContent.startsWith('从 CSWork 填入')), false, 'signed out: no fill');
  assert.equal([...doc.querySelectorAll('button')].some((b) => b.textContent.startsWith('送去 AI 点评')), false, 'AI off: no review button');
  assert.ok(SITEMAP_STATIC_ENTRIES.some((e) => e.path === '/career/resume/builder'));
});

test('a saved resume comes back, edits stay in this browser, and the sheet is ATS-plain', async () => {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      education: [{ title: 'MIT', subtitle: 'BS Computer Science', dates: '2023 – 2027', bullets: 'GPA 3.9' }],
      experience: [{ title: 'Acme', subtitle: 'SWE Intern', dates: 'Summer 2026', bullets: '- Cut p99 latency 40%\n- Shipped search' }],
    }),
  );
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  const sheet = host.querySelector('.resume-sheet');
  assert.equal(sheet.querySelector('h2').textContent, 'Ada Lovelace');
  assert.deepEqual([...sheet.querySelectorAll('h3')].map((h) => h.textContent), ['Education', 'Experience']);
  assert.deepEqual([...sheet.querySelectorAll('li')].map((li) => li.textContent), ['GPA 3.9', 'Cut p99 latency 40%', 'Shipped search']);
  assert.equal(sheet.querySelectorAll('table, img, svg, canvas, [style*="column"]').length, 0);
  await setValue(host.querySelector('textarea[maxlength="2000"]'), 'Languages: Python, Go');
  assert.equal(JSON.parse(localStorage.getItem(KEY)).skills, 'Languages: Python, Go');
  assert.equal(sheet.querySelector('section:last-of-type h3').textContent, 'Skills');
  // Remove the education entry; the section heading goes with it.
  await act(async () => button(host, 'Remove education 1').click());
  assert.deepEqual([...sheet.querySelectorAll('h3')].map((h) => h.textContent), ['Experience', 'Skills']);
  // Export is a JSON file of exactly what is stored.
  await act(async () => button(host, 'Export JSON').click());
  assert.deepEqual(JSON.parse(await blobs.at(-1).text()), JSON.parse(localStorage.getItem(KEY)));
  await unmount();
});

test('importing a file replaces the resume; a bad file says so and keeps it', async () => {
  localStorage.clear();
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  const input = host.querySelector('input[type="file"]');
  const pick = async (file) => {
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 0));
    });
  };
  await pick({ text: async () => JSON.stringify({ name: 'Grace Hopper', projects: [{ title: 'COBOL' }] }) });
  assert.equal(host.querySelector('.resume-sheet h2').textContent, 'Grace Hopper');
  assert.equal(host.querySelector('[role="status"]').textContent, 'Resume imported.');
  await pick({ text: async () => 'not json' });
  assert.equal(host.querySelector('[role="status"]').textContent, 'That file is not an exported resume JSON.');
  assert.equal(JSON.parse(localStorage.getItem(KEY)).name, 'Grace Hopper');
  await unmount();
});

test('every field holds exactly what a reload keeps: nothing typed is cut on the next visit', async () => {
  localStorage.clear();
  const fields = (host) => [...host.querySelectorAll('.resume-builder-form :is(input, textarea)')];
  const first = await mount({ zh: false, signedIn: false });
  for (const field of fields(first.host)) await setValue(field, 'x'.repeat(field.maxLength));
  const typed = fields(first.host).map((f) => f.value.length);
  await first.unmount();
  const again = await mount({ zh: false, signedIn: false });
  assert.deepEqual(fields(again.host).map((f) => f.value.length), typed);
  await again.unmount();
  localStorage.clear();
});

test('a sheet taller than one Letter page warns', async () => {
  const sizes = { clientWidth: 720, scrollHeight: 1200 };
  for (const [prop, value] of Object.entries(sizes))
    Object.defineProperty(window.HTMLElement.prototype, prop, { configurable: true, get: () => value });
  const { host, unmount } = await mount({ zh: true, signedIn: false });
  assert.match(host.querySelector('.resume-page-warning').textContent, /超过一页/);
  await unmount();
  sizes.scrollHeight = 900;
  Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => sizes.scrollHeight });
  const short = await mount({ zh: true, signedIn: false });
  assert.equal(short.host.querySelector('.resume-page-warning'), null);
  await short.unmount();
  delete window.HTMLElement.prototype.clientWidth;
  delete window.HTMLElement.prototype.scrollHeight;
});

test('signed in, Fill in from CSWork adds the record once; the AI review picks the text up once', async () => {
  localStorage.setItem(KEY, JSON.stringify({ name: 'Ada Lovelace', awards: 'Dean’s list' }));
  const { host, unmount } = await mount({ zh: false, signedIn: true, ai: true });
  await act(async () => button(host, 'Fill in from CSWork').click());
  assert.ok(calls.includes('GET /api/oj/profile/resume-facts'));
  const items = [...host.querySelectorAll('.resume-sheet li')].map((li) => li.textContent);
  assert.deepEqual(items, [
    'Dean’s list',
    'System Design Interview Course, CSWork certificate, Mar 2026 (cswork.org/certificate/MyCert0000000001)',
    'CSWork contest rating 1588 (2 rated contests)',
  ]);
  assert.match(host.querySelector('.resume-sheet header p').textContent, /cswork\.org\/u\/ada/);
  assert.equal(host.querySelector('[role="status"]').textContent, 'Added 4 lines from CSWork.');
  await act(async () => button(host, 'Fill in from CSWork').click());
  assert.equal(host.querySelector('[role="status"]').textContent, 'Nothing new to add from CSWork.');
  await act(async () => button(host, 'Send to AI review').click());
  const sent = sessionStorage.getItem(REVIEW_KEY);
  assert.match(sent, /^Ada Lovelace\n/);
  assert.match(sent, /AWARDS & CERTIFICATIONS\n- Dean’s list/);
  await unmount();

  const reviewHost = document.createElement('div');
  document.body.append(reviewHost);
  const root = createRoot(reviewHost);
  await act(async () => root.render(createElement(ResumeReview, { zh: false })));
  assert.equal(reviewHost.querySelector('#resume-text').value, sent);
  assert.equal(sessionStorage.getItem(REVIEW_KEY), null, 'read once, then gone');
  await act(async () => root.unmount());
});

const VERSIONS = 'cswork:resume:versions';
const pick = async (select, value) => {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  });
};

test('the rule check: a score, the costliest issues first, and each one opens its field', async () => {
  localStorage.clear();
  localStorage.setItem(
    KEY,
    JSON.stringify({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      links: 'github.com/ada',
      education: [{ title: 'MIT', subtitle: 'BS Computer Science', dates: 'Sep 2023 – May 2027', bullets: 'GPA 3.9' }],
      experience: [{ title: 'Acme', subtitle: 'SWE Intern', dates: 'Jun 2026 – Aug 2026', bullets: 'Worked on various things for the team' }],
      skills: 'Languages: Python, Go',
    }),
  );
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  const check = host.querySelector('#resume-check');
  const score = Number(check.querySelector('h2 span').textContent);
  assert.ok(score > 0 && score < 100, String(score));
  const items = [...check.querySelectorAll('li button')];
  // Three up front, the rest folded away.
  assert.equal(check.querySelectorAll(':scope > ol > li').length, 3);
  assert.match(items[0].textContent, /no number/);
  assert.ok(check.querySelector('details summary').textContent.endsWith('more'));
  await act(async () => items[0].click());
  assert.equal(document.activeElement, host.querySelector('#resume-experience-0-bullets'));
  // Fixing the bullet clears its issues and raises the score.
  await setValue(document.activeElement, 'Cut checkout latency 40% by caching 3 hot queries in Redis for 2M daily users');
  assert.ok(Number(check.querySelector('h2 span').textContent) > score);
  assert.ok(![...check.querySelectorAll('li button')].some((b) => b.textContent.includes('Worked on')));
  await unmount();
});

test('paste to import: a preview first, and only the confirm replaces the resume', async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({ name: 'Old Name' }));
  const { host, unmount } = await mount({ zh: false, signedIn: false });
  await act(async () => button(host, 'Paste text to import').click());
  const area = host.querySelector('.resume-paste textarea');
  assert.ok(area.closest('label'));
  await setValue(area, 'Grace Hopper\ngrace@example.com | github.com/grace\n\nEXPERIENCE\nNavy | Programmer | 1943 – 1966\n• Wrote the first compiler, used by 3 teams\n\nSKILLS\nCOBOL');
  await act(async () => button(host, 'Preview').click());
  const preview = host.querySelector('.resume-paste-preview');
  assert.match(preview.textContent, /Grace Hopper/);
  assert.match(preview.textContent, /Navy · 1943 – 1966 \(1 bullet\)/);
  // Nothing replaced yet.
  assert.equal(host.querySelector('.resume-sheet h2').textContent, 'Old Name');
  assert.equal(JSON.parse(localStorage.getItem(KEY)).name, 'Old Name');
  await act(async () => button(host, 'Replace the base resume with this').click());
  assert.equal(host.querySelector('.resume-sheet h2').textContent, 'Grace Hopper');
  const saved = JSON.parse(localStorage.getItem(KEY));
  assert.deepEqual([saved.email, saved.links, saved.skills, saved.experience[0].title], ['grace@example.com', 'github.com/grace', 'COBOL', 'Navy']);
  assert.equal(host.querySelector('.resume-paste'), null, 'the panel closes');
  await unmount();
});

test('versions: copy the resume under a name, edit it apart from the base, count the differences, delete it', async () => {
  localStorage.clear();
  localStorage.setItem(KEY, JSON.stringify({ name: 'Ada Lovelace', skills: 'Python' }));
  const first = await mount({ zh: false, signedIn: false });
  let host = first.host;
  const name = [...host.querySelectorAll('.resume-versions input')][0];
  assert.equal(name.maxLength, 40);
  await setValue(name, 'Backend');
  await act(async () => button(host, 'Copy as new version').click());
  const select = host.querySelector('.resume-versions select');
  assert.equal(select.value, 'Backend');
  assert.match(host.querySelector('.resume-versions small').textContent, /^0 fields differ/);
  await setValue(host.querySelector('#resume-skills'), 'Go, Kafka');
  assert.match(host.querySelector('.resume-versions small').textContent, /^1 field differs/);
  // The edit went to the version only; the base and its key are untouched.
  assert.deepEqual(JSON.parse(localStorage.getItem(VERSIONS)).Backend.skills, 'Go, Kafka');
  assert.equal(JSON.parse(localStorage.getItem(KEY)).skills, 'Python');
  await pick(select, '');
  assert.equal(host.querySelector('#resume-skills').value, 'Python');
  // A name already taken is refused.
  await setValue(name, 'Backend');
  await act(async () => button(host, 'Copy as new version').click());
  assert.equal(host.querySelector('.resume-builder-status').textContent, 'Pick a version name not used yet.');
  await first.unmount();
  // A reload brings the versions back; deleting asks first.
  const again = await mount({ zh: false, signedIn: false });
  host = again.host;
  await pick(host.querySelector('.resume-versions select'), 'Backend');
  assert.equal(host.querySelector('#resume-skills').value, 'Go, Kafka');
  window.confirm = () => false;
  await act(async () => button(host, 'Delete this version').click());
  assert.ok(JSON.parse(localStorage.getItem(VERSIONS)).Backend);
  window.confirm = () => true;
  await act(async () => button(host, 'Delete this version').click());
  assert.deepEqual(JSON.parse(localStorage.getItem(VERSIONS)), {});
  assert.equal(host.querySelector('.resume-versions select').value, '');
  await again.unmount();
  localStorage.clear();
});
