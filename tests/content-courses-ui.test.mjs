// The Line 500 editorial tab and the /system-design course: server-rendered pages,
// the chapter quiz's saving (account note or this browser) and the editorial's lock and diff.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const prefix = `import React from ${JSON.stringify(react)};`;
const mocks = {
  'next/headers': `export const cookies = async () => ({ get: () => (globalThis.__locale ? { value: globalThis.__locale } : undefined) }); export const headers = async () => new Headers();`,
  'next/navigation': `export function notFound() { throw Object.assign(new Error('NEXT_NOT_FOUND'), { digest: 'NEXT_NOT_FOUND' }); }`,
  'next/link': `${prefix}export default function Link({ href, prefetch, children, ...rest }) { return React.createElement('a', { href, ...rest }, children); }`,
  editor: `${prefix}export function CodeDiff(p) { return React.createElement('pre', { 'data-diff': '', 'data-original': p.original, 'data-modified': p.modified, 'data-language': p.originalLanguage, 'aria-label': p.ariaLabel }); }`,
  alert: `${prefix}export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;const Box=({children})=>React.createElement('div',null,children);export const AlertDialogContent=({children,finalFocus})=>{React.useEffect(()=>()=>{const to=finalFocus?.();queueMicrotask(()=>to instanceof HTMLElement&&to.focus());},[]);return Box({children});};export const AlertDialogDescription=Box;export const AlertDialogHeader=Box;export const AlertDialogFooter=Box;export const AlertDialogTitle=Box;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`,
};
register(
  `data:text/javascript,${encodeURIComponent(`const mocks=${JSON.stringify(mocks)};
export async function resolve(s,c,n){if(s.startsWith('next/')&&mocks[s])return {url:'mock:'+s,shortCircuit:true};return n(s,c);}
export async function load(u,c,n){
  if(u.startsWith('mock:'))return {format:'module',source:mocks[u.slice(5)],shortCircuit:true};
  if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};
  if(u.endsWith('/components/editor.tsx'))return {format:'module',source:mocks.editor,shortCircuit:true};
  if(u.endsWith('/components/ui/alert-dialog.tsx'))return {format:'module',source:mocks.alert,shortCircuit:true};
  return n(u,c);}`)}`,
  import.meta.url,
);

const course = JSON.parse(readFileSync(new URL('../lib/content/system-design-course.json', import.meta.url), 'utf8'));
const editorials = JSON.parse(readFileSync(new URL('../lib/content/ling-editorials.json', import.meta.url), 'utf8'));
const [framework, second] = course.chapters;
const last = course.chapters.at(-1);
// One saved pick per question: `set` maps question index to choice, the rest are unanswered.
const picksOf = (quiz, set = {}) => quiz.map((_, i) => set[i] ?? null);
// An editorial with at least two approaches, so the second one's comparison is reachable.
const [editorialId, editorial] = Object.entries(editorials).find(([, e]) => e.approaches.length > 1);

function useDom() {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/system-design/framework' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
const parse = (html) => new JSDOM(`<main>${html}</main>`).window.document;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
const buttons = (text) => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(text));

test('the course index and chapters render on the server with links, quiz and pager', async () => {
  const { default: Index, generateMetadata: indexMeta } = await import('../app/system-design/page.tsx');
  const { default: Chapter, generateMetadata } = await import('../app/system-design/[slug]/page.tsx');
  const { PublicLibraryMarkdown } = await import('../app/library/markdown.tsx');
  const params = (slug) => ({ params: Promise.resolve({ slug }) });
  globalThis.__locale = 'zh';
  let doc = parse(renderToStaticMarkup(await Index()));
  const cards = [...doc.querySelectorAll('.sd-sheets a')];
  assert.equal(cards.length, course.chapters.length);
  assert.ok(cards.every((a, i) => a.getAttribute('href') === `/system-design/${course.chapters[i].slug}`));
  assert.ok(cards[0].querySelector('.sd-sheet-title').textContent === framework.titleZh);
  assert.equal(doc.querySelectorAll('h1').length, 1);
  const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent));
  assert.deepEqual(ld.map((x) => x['@type']), ['BreadcrumbList', 'ItemList']);
  assert.equal((await indexMeta()).alternates.canonical, 'https://cswork.org/system-design');

  globalThis.__locale = 'en';
  doc = parse(renderToStaticMarkup(await Chapter(params('framework'))));
  assert.equal(doc.querySelector('h1').textContent, framework.titleEn);
  // The quiz waits for its saved answers.
  assert.equal(doc.querySelectorAll('.sd-quiz fieldset').length, framework.quiz.length);
  assert.ok([...doc.querySelectorAll('.sd-quiz-choices button')].every((b) => b.disabled));
  assert.ok(doc.querySelector('.sd-pager a[rel="next"]').getAttribute('href') === `/system-design/${second.slug}`);
  const meta = await generateMetadata(params('framework'));
  assert.ok(meta.title.startsWith(framework.titleEn));
  assert.equal(meta.alternates.canonical, 'https://cswork.org/system-design/framework');

  // The last chapter: its GFM table renders, the pager goes back one and then to the index.
  doc = parse(renderToStaticMarkup(await Chapter(params(last.slug))));
  assert.ok(doc.querySelector('.public-library-prose table') !== null);
  assert.ok(doc.querySelector('.sd-pager a[rel="prev"]').getAttribute('href') === `/system-design/${course.chapters.at(-2).slug}`);
  assert.ok(doc.querySelector('.sd-pager > :last-child').getAttribute('href') === '/system-design');
  await assert.rejects(Chapter(params('nope')), /NEXT_NOT_FOUND/);
  await assert.rejects(Chapter(params('__proto__')), /NEXT_NOT_FOUND/);
  // Links between chapters and to an MCQ topic survive the safe renderer as plain in-site links; other relative paths do not.
  doc = parse(
    renderToStaticMarkup(
      createElement(PublicLibraryMarkdown, {
        body: `[next](/system-design/${second.slug}) [x](/admin) [mcq](/oa/mcq?topic=os) [y](/oa/mcq?topic=os&next=x)`,
        math: false,
      }),
    ),
  );
  assert.deepEqual(
    [...doc.querySelectorAll('a')].map((a) => [a.getAttribute('href'), a.getAttribute('rel')]),
    [
      [`/system-design/${second.slug}`, null],
      ['/oa/mcq?topic=os', null],
    ],
  );
});

test('course Markdown groups code blocks into tabs and embeds ```algorithm-demo; a post keeps them as code', async () => {
  const { PublicLibraryMarkdown } = await import('../app/library/markdown.tsx');
  const render = (body, ugc = false) => parse(renderToStaticMarkup(createElement(PublicLibraryMarkdown, { body, math: false, ugc })));
  let doc = render('```python\nprint(1)\n```\n\n```cpp\nint main() {}\n```');
  const groups = doc.querySelectorAll('.cs-code-tabs');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].querySelectorAll('[role="tab"]').length, 2);
  assert.deepEqual([...groups[0].querySelectorAll('[role="tabpanel"]')].map((p) => p.querySelector('pre').textContent.trim()), ['print(1)', 'int main() {}']);
  doc = render('```algorithm-demo\nbinary-search\n```');
  assert.equal(doc.querySelector('pre'), null);
  assert.ok(doc.querySelector('section.algorithm-demo'));
  assert.equal(render('```algorithm-demo\nbinary-search\n```', true).querySelector('pre').textContent.trim(), 'binary-search');
});

test('signed out, quiz answers lock, explain and stay in this browser; bad saved data is ignored', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdQuiz } = await import('../app/system-design/quiz.tsx');
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push(init.method ?? 'GET');
    return Response.json({ error: 'Sign in first' }, { status: 401 });
  };
  const key = 'cswork:sd-quiz:framework';
  const root = createRoot(document.getElementById('root'));
  try {
    localStorage.setItem(key, JSON.stringify({ picks: picksOf(framework.quiz, { 0: 9 }) }));
    await act(async () => root.render(createElement(SdQuiz, { slug: 'framework', quiz: framework.quiz, zh: false })));
    await settle();
    assert.equal(document.querySelectorAll('.sd-quiz-why').length, 0, 'an out-of-range pick is ignored');
    assert.ok(document.querySelector('.sd-quiz-foot').textContent.includes('stay on this device'));
    const wrong = framework.quiz[0].answer === 0 ? 1 : 0;
    const first = () => [...document.querySelectorAll('.sd-quiz-list > li')][0];
    first().querySelectorAll('button')[wrong].focus();
    await act(async () => first().querySelectorAll('button')[wrong].click());
    assert.ok(document.activeElement === first().querySelectorAll('button')[wrong], 'the pick keeps focus');
    assert.ok(first().querySelector('.sd-quiz-why[data-state="wrong"]') !== null);
    assert.ok(first().querySelector('.sd-quiz-why').textContent.includes(`The answer is ${'ABCD'[framework.quiz[0].answer]}.`));
    assert.ok(first().querySelector(`button[data-state="right"]`) === first().querySelectorAll('button')[framework.quiz[0].answer]);
    assert.ok([...first().querySelectorAll('button')].every((b) => b.getAttribute('aria-disabled') === 'true'), 'an answered question is locked');
    await act(async () => first().querySelectorAll('button')[framework.quiz[0].answer].click());
    assert.ok(first().querySelector('.sd-quiz-why[data-state="wrong"]') !== null, 'a second click changes nothing');
    assert.deepEqual(JSON.parse(localStorage.getItem(key)).picks, picksOf(framework.quiz, { 0: wrong }));
    const second = () => [...document.querySelectorAll('.sd-quiz-list > li')][1];
    await act(async () => second().querySelectorAll('button')[framework.quiz[1].answer].click());
    assert.ok(second().querySelector('.sd-quiz-why[data-state="right"]') !== null);
    assert.equal(document.querySelector('.sd-quiz-score').textContent, `2 of ${framework.quiz.length} answered · 1 correct`);
    assert.deepEqual(calls, ['GET'], 'nothing is sent while signed out');
    await act(async () => buttons('Start over')[0].click());
    assert.equal(localStorage.getItem(key), null);
    assert.equal(document.querySelectorAll('.sd-quiz-why').length, 0);

    // Saved answers come back on the next visit.
    localStorage.setItem(key, JSON.stringify({ picks: picksOf(framework.quiz, { 0: framework.quiz[0].answer }) }));
    await act(async () => root.render(createElement('div')));
    await act(async () => root.render(createElement(SdQuiz, { slug: 'framework', quiz: framework.quiz, zh: true })));
    await settle();
    assert.ok(document.querySelector('.sd-quiz-why[data-state="right"]').textContent.startsWith('答对了。'));
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('signed in, answers are the sd:<slug> note, sent in order, and guest answers move over', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { SdQuiz } = await import('../app/system-design/quiz.tsx');
  const original = globalThis.fetch;
  const puts = [];
  let inFlight = 0;
  let overlapped = false;
  globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), `/api/oj/notes?target=sd%3A${second.slug}`);
    if (init.method === 'PUT') {
      puts.push(JSON.parse(init.body).body);
      overlapped ||= ++inFlight > 1;
      // The first save is slow: the next one must wait for it rather than overtake it.
      await new Promise((r) => setTimeout(r, puts.length === 1 ? 40 : 0));
      inFlight--;
      return Response.json({ ok: true });
    }
    return Response.json({ target: `sd:${second.slug}`, body: '', updatedAt: null });
  };
  const key = `cswork:sd-quiz:${second.slug}`;
  const root = createRoot(document.getElementById('root'));
  try {
    localStorage.setItem(key, JSON.stringify({ picks: picksOf(second.quiz, { 0: 1 }) }));
    await act(async () => root.render(createElement(SdQuiz, { slug: second.slug, quiz: second.quiz, zh: false })));
    await settle();
    assert.equal(localStorage.getItem(key), null, 'the guest copy moved to the account');
    assert.ok(document.querySelector('.sd-quiz-foot').textContent.includes('saved to your account'));
    const third = () => [...document.querySelectorAll('.sd-quiz-list > li')][2];
    await act(async () => third().querySelectorAll('button')[0].click());
    await act(async () => new Promise((r) => setTimeout(r, 60)));
    assert.equal(overlapped, false, 'one save at a time');
    assert.deepEqual(
      puts.map((body) => JSON.parse(body).picks),
      [picksOf(second.quiz, { 0: 1 }), picksOf(second.quiz, { 0: 1, 2: 0 })],
    );
    await act(async () => buttons('Start over')[0].click());
    await settle();
    assert.equal(puts.at(-1), '', 'starting over removes the note');
    assert.equal(localStorage.getItem(key), null, 'nothing is kept in the browser while signed in');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = original;
    dom.window.close();
  }
});

test('the editorial stays locked until solved or confirmed, is fetched only then, switches language and diffs my code', async () => {
  const dom = useDom();
  const { createRoot } = await import('react-dom/client');
  const { LingEditorial } = await import('../components/ling-editorial.tsx');
  const root = createRoot(document.getElementById('root'));
  const original = globalThis.fetch;
  const fetched = [];
  const votes = [];
  let release;
  const stored = new Promise((resolve) => (release = resolve));
  let reply = [200, editorial];
  globalThis.fetch = async (url, init) => {
    // The helpful / not helpful vote under it (components/editorial-vote.tsx): its own mark.
    if (String(url).startsWith('/api/oj/marks')) {
      if (init?.method === 'POST') votes.push(JSON.parse(init.body));
      // The stored vote ("not helpful") arrives only after the click below, which must win.
      else await stored;
      const items = init?.method === 'POST' ? [] : [{ mark: 'down' }];
      return new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } });
    }
    fetched.push(String(url));
    return new Response(JSON.stringify(reply[1]), { status: reply[0], headers: { 'Content-Type': 'application/json' } });
  };
  let unlocks = 0;
  const render = (props) =>
    act(async () =>
      root.render(
        createElement(LingEditorial, {
          problemId: editorialId,
          // Unverified first; the badge comes from this prop, the verified one is rendered below.
          verified: false,
          english: true,
          unlocked: false,
          onUnlock: () => unlocks++,
          code: 'my code',
          language: 'cpp',
          settings: {},
          ...props,
        }),
      ),
    );
  try {
    await render();
    assert.ok(document.querySelector('.cs-route-hint-locked') !== null);
    assert.equal(document.querySelectorAll('.cs-ling-code').length, 0, 'no code before unlocking');
    await act(async () => buttons('Show anyway')[0].click());
    assert.ok(document.querySelector('[role="alertdialog"]') !== null);
    await act(async () => buttons('Show editorial')[0].click());
    assert.equal(unlocks, 1);
    assert.deepEqual(fetched, [], 'nothing is fetched while locked');

    await render({ unlocked: true });
    await settle();
    // The confirm unmounted the "Show anyway" button; focus goes to the heading, not <body>.
    assert.ok(document.activeElement === document.getElementById('ling-editorial-title'), 'focus lands on the heading');
    assert.deepEqual(fetched, [`/api/oj/problems/${editorialId}/editorial`]);
    // Two or more approaches open step by step (tests/clarify-panel-ui.test.mjs); "Show all" is remembered.
    assert.ok(document.querySelector('.cs-ling-steps') !== null);
    assert.equal(document.querySelectorAll('.cs-ling-approaches > li').length, 0);
    await act(async () => buttons('Show all')[0].click());
    assert.equal(localStorage.getItem('cswork:editorial-mode'), 'all');
    assert.equal(document.querySelectorAll('.cs-ling-approaches > li').length, editorial.approaches.length);
    assert.ok(document.querySelector('.cs-ling-unverified') !== null);
    await act(async () => buttons('Helpful')[0].click());
    assert.deepEqual(votes, [{ target: `content:editorial/${editorialId}`, mark: 'up', on: true }]);
    assert.equal(buttons('Helpful')[0].getAttribute('aria-pressed'), 'true');
    assert.equal(buttons('Not helpful')[0].getAttribute('aria-pressed'), 'false');
    release();
    await settle();
    assert.equal(buttons('Helpful')[0].getAttribute('aria-pressed'), 'true', 'a late read does not undo the click');
    // The editor's language picks the tab; C++ code shows first.
    assert.ok(buttons('C++')[0].getAttribute('aria-pressed') === 'true');
    assert.equal(document.querySelector('.cs-ling-code').textContent, editorial.approaches[0].cpp);
    for (const [name, key] of [['Java', 'java'], ['Go', 'go'], ['Python', 'python']]) {
      await act(async () => buttons(name)[0].click());
      assert.ok(buttons(name)[0].getAttribute('aria-pressed') === 'true', name);
      assert.equal(document.querySelector('.cs-ling-code').textContent, editorial.approaches[0][key], name);
    }
    const compare = buttons('Compare with my code')[1];
    await act(async () => compare.click());
    assert.equal(compare.getAttribute('aria-expanded'), 'true');
    let diff = document.querySelector('pre[data-diff]');
    // Python is shown, but my C++ diffs against the C++ editorial.
    assert.equal(diff.getAttribute('data-original'), editorial.approaches[1].cpp);
    assert.equal(diff.getAttribute('data-modified'), 'my code');
    assert.equal(diff.getAttribute('data-language'), 'cpp');
    assert.ok(document.querySelector('.cs-diff-labels').textContent.includes('Editorial · C++'), 'both labels use display names');
    assert.ok(document.querySelector('.cs-diff-labels').textContent.includes('My code · C++'), 'both labels use display names');
    assert.equal(diff.getAttribute('aria-label'), 'Differences between the editorial and my code');
    await act(async () => buttons('Hide comparison')[0].click());
    assert.equal(document.querySelectorAll('pre[data-diff]').length, 0);

    await render({ unlocked: true, english: false, verified: true });
    assert.ok(document.querySelector('.cs-ling-verified').textContent.includes('Python 代码已通过本题全部测试，C++、Java、Go 已通过公开样例'));
    assert.ok(document.querySelector('.cs-ling-approaches h3').textContent.includes(editorial.approaches[0].nameZh));
    assert.equal(fetched.length, 1, 'fetched once');

    // Refused during the learner's running contest: the server's reason and a retry.
    reply = [403, { error: '这道题在你正在进行的比赛里，题解、讨论和 AI 助教赛后开放' }];
    await render({ unlocked: true, key: 'refused' });
    await settle();
    assert.ok(document.querySelector('[role="alert"]').textContent.includes("contest you're taking"));
    assert.equal(document.querySelectorAll('.cs-ling-code').length, 0);
    reply = [200, editorial];
    await act(async () => buttons('Retry')[0].click());
    await settle();
    assert.equal(document.querySelectorAll('.cs-ling-approaches > li').length, editorial.approaches.length);
    assert.equal(fetched.length, 3);

    // A Java editor opens on Java and diffs Java; an editor language the editorial lacks opens on
    // Python and diffs whichever tab is shown.
    await render({ unlocked: true, language: 'java', key: 'java' });
    await settle();
    assert.ok(buttons('Java')[0].getAttribute('aria-pressed') === 'true');
    assert.equal(document.querySelector('.cs-ling-code').textContent, editorial.approaches[0].java);
    await act(async () => buttons('Compare with my code')[0].click());
    diff = document.querySelector('pre[data-diff]');
    assert.equal(diff.getAttribute('data-original'), editorial.approaches[0].java);
    assert.equal(diff.getAttribute('data-language'), 'java');
    await render({ unlocked: true, language: 'sql', key: 'sql' });
    await settle();
    assert.ok(buttons('Python')[0].getAttribute('aria-pressed') === 'true');
    await act(async () => buttons('Go')[0].click());
    await act(async () => buttons('Compare with my code')[0].click());
    diff = document.querySelector('pre[data-diff]');
    assert.equal(diff.getAttribute('data-original'), editorial.approaches[0].go);
    assert.equal(diff.getAttribute('data-language'), 'go');
    assert.ok(document.querySelector('.cs-diff-labels').textContent.includes('Editorial · Go'));
  } finally {
    globalThis.fetch = original;
    await act(async () => root.unmount());
    dom.window.close();
  }
});
