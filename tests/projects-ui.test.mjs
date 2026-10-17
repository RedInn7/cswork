// /projects and /roadmap?role=: the project pages render the brief, the acceptance script and the
// resume material; the progress buttons write marks and a checked repo link; the role path shows
// its stations and fills in progress from marks, history and the MCQ note once signed in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
// English pages: the locale cookie is absent.
const mocks = {
  'next/headers': 'export const cookies = async () => ({ get: () => undefined }); export const headers = async () => new Headers();',
  'next/link': `import React from ${JSON.stringify(react)};export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
  'next/navigation': 'export const usePathname = () => "/projects"; export const useSearchParams = () => new URLSearchParams(); export const notFound = () => { throw new Error("NEXT_NOT_FOUND"); };',
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks = ${JSON.stringify(mocks)};
export async function resolve(s, c, n) { return mocks[s] ? { url: 'mock:' + s, shortCircuit: true } : n(s, c); }
export async function load(url, context, next) { if (url.startsWith('mock:')) return { format: 'module', source: mocks[url.slice(5)], shortCircuit: true }; if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }`)}`,
  import.meta.url,
);

const page = (html) => new JSDOM(`<main>${html}</main>`).window.document;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));

function mount(url) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url });
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'SubmitEvent', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

test('the index groups projects by level and filters by role', async () => {
  const { default: ProjectsPage } = await import('../app/projects/page.tsx');
  const all = page(renderToStaticMarkup(await ProjectsPage({ searchParams: Promise.resolve({}) })));
  assert.deepEqual([...all.querySelectorAll('.projects-level h2')].map((h) => h.textContent), ['Beginner', 'Intermediate', 'Advanced']);
  assert.equal(all.querySelectorAll('.projects-card').length, 10);
  assert.equal(all.querySelector('.public-library-filters [aria-current]').textContent, 'All');
  const data = page(renderToStaticMarkup(await ProjectsPage({ searchParams: Promise.resolve({ role: 'data' }) })));
  const slugs = [...data.querySelectorAll('.projects-card h3 a')].map((a) => a.getAttribute('href'));
  assert.deepEqual(slugs.sort(), ['/projects/idempotent-etl', '/projects/log-search', '/projects/polite-crawler']);
  assert.equal(data.querySelector('.public-library-filters [aria-current]').getAttribute('href'), '/projects?role=data');
  const bogus = page(renderToStaticMarkup(await ProjectsPage({ searchParams: Promise.resolve({ role: 'astronaut' }) })));
  assert.equal(bogus.querySelectorAll('.projects-card').length, 10, 'an unknown role shows everything');
});

test('a project page shows the brief, the script and how to run it, the bullet and the follow-ups', async () => {
  const { default: ProjectPage } = await import('../app/projects/[slug]/page.tsx');
  const doc = page(renderToStaticMarkup(await ProjectPage({ params: Promise.resolve({ slug: 'idempotent-etl' }) })));
  assert.equal(doc.querySelector('h1').textContent, 'Idempotent ETL Pipeline (CLI)');
  assert.ok([...doc.querySelectorAll('.public-library-prose h2')].some((h) => h.textContent === 'Constraints'), 'the brief renders');
  assert.equal(doc.querySelector('a.project-download').getAttribute('href'), '/projects/idempotent-etl/accept');
  assert.match(doc.querySelector('pre[aria-label="Command"] code').textContent, /^CMD="python3 your_program\.py" python3 accept_test\.py$/);
  assert.equal(doc.querySelectorAll('#milestones + ol li').length, 4);
  assert.equal(doc.querySelectorAll('#follow-ups + ol li').length, 6);
  assert.equal(doc.querySelectorAll('blockquote').length, 2, 'both bullet templates');
  assert.ok(![...doc.querySelectorAll('a')].some((a) => a.getAttribute('href')?.includes('template=project')), 'no AI round without AI');
  const redis = page(renderToStaticMarkup(await ProjectPage({ params: Promise.resolve({ slug: 'mini-redis' }) })));
  assert.match(redis.querySelector('pre[aria-label="Command"] code').textContent, /^BASE_URL=tcp:/);
  await assert.rejects(ProjectPage({ params: Promise.resolve({ slug: 'url-shortener' }) }), /NEXT_NOT_FOUND/);
});

test('progress buttons: guests sign in; members start, finish and keep a checked repo link', async () => {
  const dom = mount('https://cswork.test/projects/kv-wal');
  const { createRoot } = await import('react-dom/client');
  const { ProjectProgress } = await import('../components/project-progress.tsx');
  const calls = [];
  let signedIn = false;
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, method: init.method ?? 'GET', body: init.body });
    if (!signedIn) return Response.json({ error: '请先登录' }, { status: 401 });
    if (url.includes('/marks?target=')) return Response.json({ items: [] });
    if (url.includes('/notes?target=')) return init.method === 'PUT' ? Response.json({ ok: true }) : Response.json({ body: '' });
    return Response.json(JSON.parse(init.body));
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(ProjectProgress, { slug: 'kv-wal', zh: false, key: 'guest' })));
    await settle();
    assert.equal(document.querySelector('.project-progress a').getAttribute('href'), '/?view=account');

    signedIn = true;
    await act(async () => root.render(createElement(ProjectProgress, { slug: 'kv-wal', zh: false, key: 'member' })));
    await settle();
    assert.equal(document.querySelector('.project-progress-label').textContent, 'Not started');
    const button = (text) => [...document.querySelectorAll('.project-progress button')].find((b) => b.textContent === text);
    calls.length = 0;
    await act(async () => button('Start').click());
    await settle();
    assert.deepEqual(JSON.parse(calls.at(-1).body), { target: 'content:project/kv-wal', mark: 'doing', on: true });
    assert.equal(document.querySelector('.project-progress-label').textContent, 'In progress');
    calls.length = 0;
    await act(async () => button('Mark done').click());
    await settle();
    assert.deepEqual(calls.map((c) => JSON.parse(c.body)), [
      { target: 'content:project/kv-wal', mark: 'done', on: true },
      { target: 'content:project/kv-wal', mark: 'doing', on: false },
    ]);
    assert.equal(document.querySelector('.project-progress[data-state="done"] .project-progress-label').textContent, 'Done');

    const input = document.querySelector('#project-repo-kv-wal');
    const type = (value) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    const submit = () => act(async () => input.form.requestSubmit());
    calls.length = 0;
    await type('https://evil.test/me/kv');
    await submit();
    assert.equal(calls.length, 0, 'a bad link never reaches the server');
    assert.match(document.querySelector('.project-progress-error').textContent, /GitHub, GitLab or Codeberg/);
    await type('https://github.com/me/kv');
    await submit();
    await settle();
    assert.equal(calls.at(-1).method, 'PUT');
    assert.equal(calls.at(-1).url, '/api/oj/notes?target=project%3Akv-wal');
    assert.deepEqual(JSON.parse(JSON.parse(calls.at(-1).body).body), { repo: 'https://github.com/me/kv' });
    assert.equal(document.querySelector('.project-progress-repo a').getAttribute('href'), 'https://github.com/me/kv');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the roadmap role picker renders a path; members see each step filled in', async () => {
  const { default: RoadmapPage } = await import('../app/roadmap/page.tsx');
  const { RolePath } = await import('../components/role-path.tsx');
  const find = (node) =>
    node && typeof node === 'object'
      ? node.type === RolePath
        ? node
        : [node.props?.children].flat(Infinity).map(find).find(Boolean)
      : undefined;
  const none = find(await RoadmapPage({ searchParams: Promise.resolve({}) }));
  assert.equal(none.props.role, null);
  assert.deepEqual(none.props.steps, []);
  const picked = find(await RoadmapPage({ searchParams: Promise.resolve({ role: 'frontend' }) }));
  const doc = page(renderToStaticMarkup(picked));
  assert.equal(doc.querySelectorAll('.role-path-roles a').length, 6);
  assert.equal(doc.querySelector('.role-path-roles [aria-current]').getAttribute('href'), '/roadmap?role=frontend#role-path');
  assert.match(doc.querySelector('.role-path-progress').textContent, /Sign in/);
  const off = doc.querySelector('.role-path-steps li[data-off]');
  assert.match(off.textContent, /Mock interview: Frontend interview.*Unavailable/, 'the AI-only round while AI is off');
  assert.ok([...doc.querySelectorAll('.role-path-head a')].some((a) => a.textContent === 'Multiple choice: JavaScript'));
  assert.ok(doc.querySelector('a.role-path-plan').getAttribute('href').includes('planTopics=array-foundations'));

  // Signed in: progress from read marks, done marks, the practice history and the MCQ note.
  const dom = mount('https://cswork.test/roadmap?role=backend');
  const { createRoot } = await import('react-dom/client');
  const backend = find(await RoadmapPage({ searchParams: Promise.resolve({ role: 'backend' }) }));
  const sql = backend.props.steps.find((s) => s.kind === 'sql-track' && s.ref === 'joins');
  const framework = backend.props.steps.find((s) => s.kind === 'sd-part');
  const dbms = backend.props.steps.find((s) => s.ref === 'dbms');
  let signedIn = true;
  const original = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (!signedIn) return Response.json({ error: '请先登录' }, { status: 401 });
    if (url.endsWith('/api/oj/marks'))
      return Response.json({
        items: [
          ...framework.keys.map((target) => ({ target, mark: 'read' })),
          { target: 'content:project/rate-limiter', mark: 'done' },
          { target: 'content:project/task-queue', mark: 'doing' },
        ],
      });
    if (url.endsWith('/api/oj/history'))
      return Response.json({ items: sql.keys.slice(0, 2).map((k) => ({ problemId: k.slice(8), firstAcAt: 1 })).concat([{ problemId: 'lc-1', firstAcAt: null }]) });
    if (url.includes('/api/oj/notes'))
      return Response.json({ body: JSON.stringify(Object.fromEntries(dbms.keys.map((k) => [k.slice(4), [1, 1, 1]]))) });
    throw new Error(url);
  };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(createElement(RolePath, { ...backend.props, key: 'in' })));
    await settle();
    const state = (title) =>
      [...document.querySelectorAll('.role-path-steps > li')].find((li) => li.querySelector('.role-path-head a').textContent === title);
    assert.equal(state(framework.title).getAttribute('data-state'), 'done');
    assert.equal(state('Resume project: Token-Bucket Rate Limiter Service').getAttribute('data-state'), 'done');
    assert.equal(state('Resume project: Task Queue with Retries and Visibility Timeouts').getAttribute('data-state'), 'todo', 'doing is not done');
    assert.equal(state(sql.title).getAttribute('data-state'), 'active');
    assert.equal(state(sql.title).querySelector('.role-path-count').textContent, `2/${sql.keys.length}`);
    assert.equal(state('Multiple choice: Databases').getAttribute('data-state'), 'done');
    assert.equal(state('Mock interview: Onsite loop')?.hasAttribute('data-state') ?? false, false, 'mocks never count');
    assert.match(document.querySelector('.role-path-progress').textContent, /^3 of \d+ required steps done\.$/);
    assert.equal(requests.filter((u) => u.includes('/api/oj/')).length, 3);

    signedIn = false;
    await act(async () => root.render(createElement(RolePath, { ...backend.props, key: 'out' })));
    await settle();
    assert.match(document.querySelector('.role-path-progress').textContent, /Sign in/);
    assert.equal(document.querySelectorAll('.role-path-steps > li[data-state]').length, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});
