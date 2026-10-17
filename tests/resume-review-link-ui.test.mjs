// Resume review links in the browser (components/resume-review-link.tsx): the builder's box sends a
// snapshot without name or contact lines and shows the link once; the review page lists the lines
// under their sections with comments as plain text and rewrites as struck-out/new; the owner's
// accept marks the comment on the server first and only then rewrites this browser's copy (the
// base or a named version), and an edited line offers the rewrite to copy instead. Never indexed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => (globalThis.__locale ? { value: globalThis.__locale } : undefined) }); export const headers = async () => new Headers();`,
  'next/link': `export default function Link() { return null; }`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ResumeReviewLink, ResumeReviewPage, RESUME_KEY, RESUME_VERSIONS_KEY } = await import('../components/resume-review-link.tsx');
const builder = await import('../components/resume-builder.tsx');

const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const button = (label, host = document) => [...host.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}
const resume = (bullets, skills = 'Languages: Python, Go') => ({
  ...builder.blankResume(),
  experience: [{ title: 'Engines Ltd', subtitle: 'SWE Intern', dates: '2026', bullets }],
  skills,
});
const comment = (id, path, original, suggestion, extra = {}) => ({
  id, path, original, body: '<b>why?</b>', suggestion, acceptedAt: null, createdAt: 1, reviewer: 1, handle: null, mine: false, ...extra,
});
const review = (extra = {}) => ({
  id: null,
  mine: false,
  version: null,
  snapshot: resume('- Built a parser\n• Cut build time by 40%'),
  note: 'Backend roles',
  author: 'ada',
  createdAt: 0,
  comments: [comment('c1', 'experience.0.bullets.1', 'Cut build time by 40%', 'Cut CI build time 40%')],
  ...extra,
});
async function render(element) {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(element));
  await settle();
  return () => act(async () => root.unmount());
}

test('the storage keys are the builder’s', () => {
  assert.equal(RESUME_KEY, builder.RESUME_KEY);
  assert.equal(RESUME_VERSIONS_KEY, builder.RESUME_VERSIONS_KEY);
});

test('a reader sees the lines by section, comments as text, rewrites struck out, and comments with a rewrite', async () => {
  const posted = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/resume-reviews/tok/comments')) return (posted.push(JSON.parse(init.body)), Response.json({ id: 'c2' }));
    if (u.endsWith('/api/oj/resume-reviews/tok')) return Response.json(review());
    throw new Error(`unexpected ${u}`);
  };
  const unmount = await render(createElement(ResumeReviewPage, { token: 'tok' }));
  assert.equal(document.querySelector('h1').textContent, '@ada’s resume');
  assert.deepEqual([...document.querySelectorAll('.rr-section h2')].map((h) => h.textContent), ['Experience', 'Skills']);
  assert.deepEqual([...document.querySelectorAll('.rr-line p')].map((p) => p.textContent), ['Built a parser', 'Cut build time by 40%', 'Languages: Python, Go']);
  const c = document.querySelector('.cr-comment');
  assert.equal(c.querySelector('p').textContent, '<b>why?</b>', 'plain text, never HTML');
  assert.equal(c.querySelector('b'), null);
  assert.deepEqual([c.querySelector('del').textContent, c.querySelector('ins').textContent], ['Cut build time by 40%', 'Cut CI build time 40%']);
  assert.equal(button('Accept and write back'), undefined, 'only the owner accepts');
  assert.equal(button('Close this link'), undefined);
  assert.match(document.querySelector('header').textContent, /verified email/);

  const open = document.querySelectorAll('.rr-line button')[0];
  assert.equal(open.getAttribute('aria-label'), 'Comment on Engines Ltd bullet 1');
  await act(async () => open.click());
  assert.equal(open.getAttribute('aria-expanded'), 'true');
  await type(document.querySelector('.rr-form textarea'), 'Which parser?');
  await type(document.querySelector('.rr-form input'), 'Built a JSON parser in Go');
  await act(async () => button('Comment', document.querySelector('.rr-form')).click());
  await settle();
  assert.deepEqual(posted, [{ path: 'experience.0.bullets.0', body: 'Which parser?', suggestion: 'Built a JSON parser in Go' }]);
  await unmount();
});

test('the owner accepts: the server first, then this browser’s copy; an edited line offers the rewrite to copy', async () => {
  const asked = [];
  let acceptStatus = 200;
  let current = review({ id: 'r1', mine: true, version: '' });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url).replace(/^.*\/api\/oj\//, '');
    asked.push(`${init.method ?? 'GET'} ${u}`);
    if (u === 'resume-reviews/r1/accept') {
      if (acceptStatus !== 200) return Response.json({ error: 'Too many requests' }, { status: acceptStatus });
      current = { ...current, comments: current.comments.map((c) => ({ ...c, acceptedAt: 5 })) };
      return Response.json({ ok: true, acceptedAt: 5 });
    }
    if (u === 'resume-reviews/r1') return Response.json(current);
    throw new Error(`unexpected ${u}`);
  };
  let copied = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void (copied = text) } });

  // Not in this browser: nothing is sent, the rewrite can be copied.
  localStorage.clear();
  const unmount = await render(createElement(ResumeReviewPage, { token: 'r1' }));
  assert.match(document.querySelector('header').textContent, /Only you can open this address/);
  await act(async () => button('Accept and write back').click());
  assert.match(document.querySelector('.rr-stale').textContent, /edited since, or this browser does not have this resume/);
  await act(async () => button('Copy the rewrite').click());
  assert.equal(copied, 'Cut CI build time 40%');
  assert.ok(!asked.some((a) => a.startsWith('POST')));

  // The line was edited since: same.
  localStorage.setItem(RESUME_KEY, JSON.stringify(resume('- Built a parser\n• Cut build time in half')));
  await act(async () => button('Accept and write back').click());
  assert.ok(document.querySelector('.rr-stale'));
  assert.ok(!asked.some((a) => a.startsWith('POST')));

  // The server refuses: this browser's copy stays as it was.
  const before = JSON.stringify(resume('- Led a team\n- Built a parser\n• Cut build time by 40%'));
  localStorage.setItem(RESUME_KEY, before);
  acceptStatus = 429;
  await act(async () => button('Accept and write back').click());
  await settle();
  assert.equal(document.querySelector('header [role="alert"]').textContent, 'Too many requests');
  assert.equal(localStorage.getItem(RESUME_KEY), before);

  // Accepted: the moved line is rewritten with its bullet mark, and the comment reads accepted.
  acceptStatus = 200;
  await act(async () => button('Accept and write back').click());
  await settle();
  assert.equal(JSON.parse(localStorage.getItem(RESUME_KEY)).experience[0].bullets, '- Led a team\n- Built a parser\n• Cut CI build time 40%');
  assert.equal(document.querySelector('.rr-done').textContent, 'Accepted');
  assert.match(document.querySelector('header [role="status"]').textContent, /Written back to the resume builder/);
  assert.deepEqual(asked.filter((a) => a.startsWith('POST')), ['POST resume-reviews/r1/accept', 'POST resume-reviews/r1/accept']);
  await unmount();
});

test('a link made from a named version writes back into that version only', async () => {
  let current = review({ id: 'r2', mine: true, version: 'Backend' });
  globalThis.fetch = async (url) => {
    const u = String(url).replace(/^.*\/api\/oj\//, '');
    if (u === 'resume-reviews/r2/accept') {
      current = { ...current, comments: current.comments.map((c) => ({ ...c, acceptedAt: 5 })) };
      return Response.json({ ok: true, acceptedAt: 5 });
    }
    if (u === 'resume-reviews/r2') return Response.json(current);
    throw new Error(`unexpected ${u}`);
  };
  const base = JSON.stringify(resume('- Built a parser\n• Cut build time by 40%'));
  localStorage.setItem(RESUME_KEY, base);
  localStorage.setItem(RESUME_VERSIONS_KEY, JSON.stringify({ Backend: resume('- Built a parser\n• Cut build time by 40%'), Data: resume('- SQL') }));
  const unmount = await render(createElement(ResumeReviewPage, { token: 'r2' }));
  assert.match(document.querySelector('.cr-meta').textContent, /^Backend · /);
  await act(async () => button('Accept and write back').click());
  await settle();
  const versions = JSON.parse(localStorage.getItem(RESUME_VERSIONS_KEY));
  assert.equal(versions.Backend.experience[0].bullets, '- Built a parser\n• Cut CI build time 40%');
  assert.equal(versions.Data.experience[0].bullets, '- SQL');
  assert.equal(localStorage.getItem(RESUME_KEY), base, 'the base resume is untouched');
  await unmount();
});

test('the builder box sends a snapshot without contact lines, shows the link once and lists open links', async () => {
  const made = [];
  let copied = '';
  Object.defineProperty(dom.window.navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => void (copied = text) } });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith('/api/oj/resume-reviews') && init.method === 'POST') return (made.push(JSON.parse(init.body)), Response.json({ id: 'r1', token: 'T'.repeat(32) }));
    if (u.endsWith('/api/oj/resume-reviews'))
      return Response.json({ items: made.length ? [{ id: 'r1', note: 'Backend roles', version: 'Backend', createdAt: Date.UTC(2026, 9, 15, 12), comments: 3, pending: 1 }] : [] });
    throw new Error(`unexpected ${u}`);
  };
  const mine = { ...resume('- Built a parser'), name: 'Ada Lovelace', email: 'ada@example.test', phone: '555', location: 'London', links: 'github.com/ada' };
  const unmount = await render(createElement(ResumeReviewLink, { resume: mine, version: 'Backend' }));
  const details = document.querySelector('details');
  assert.equal(details.querySelector('summary').textContent, 'Ask someone to review it');
  await act(async () => {
    details.open = true;
    details.dispatchEvent(new dom.window.Event('toggle'));
  });
  await settle();
  await type(details.querySelector('textarea'), 'Backend roles');
  await act(async () => button('Make a link to “Backend”').click());
  await settle();
  assert.equal(made.length, 1);
  assert.deepEqual([made[0].version, made[0].note, made[0].resume.experience[0].bullets], ['Backend', 'Backend roles', '- Built a parser']);
  for (const key of ['name', 'email', 'phone', 'location', 'links']) assert.equal(made[0].resume[key], '', key);
  const link = `https://cswork.test/career/resume/review/${'T'.repeat(32)}`;
  assert.equal(details.querySelector('.cr-made input').value, link);
  assert.equal(copied, link);
  assert.equal(details.querySelector('.cr-links a').getAttribute('href'), '/career/resume/review/r1');
  assert.equal(details.querySelector('.cr-links li span').textContent, '10/15/2026 · Backend · 3 comments · 1 rewrite to review · Backend roles');
  await unmount();
});

test('the review page is never indexed', async () => {
  const { generateMetadata } = await import('../app/career/resume/review/[token]/page.tsx');
  for (const [locale, title] of [['zh', '简历评审 · CSWork'], [undefined, 'Resume review · CSWork']]) {
    globalThis.__locale = locale;
    const meta = await generateMetadata();
    assert.equal(meta.title, title);
    assert.deepEqual(meta.robots, { index: false, follow: false });
    assert.equal(meta.referrer, 'no-referrer');
    assert.equal(meta.alternates, undefined, 'no canonical URL carrying the token');
  }
});
