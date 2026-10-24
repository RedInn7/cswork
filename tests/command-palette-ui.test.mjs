import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="root"></div></body></html>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'PopStateEvent', 'localStorage', 'navigator', 'location', 'history', 'getSelection'])
  Object.defineProperty(globalThis, name, { configurable: true, value: name === 'getSelection' ? dom.window.getSelection.bind(dom.window) : dom.window[name] });
dom.window.scrollTo = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.localStorage.setItem('cswork:locale', 'en'); // English UI copy below; the site defaults to zh.
const { createRoot } = await import('react-dom/client');
const palette = await import('../components/command-palette.tsx');
const { CommandPalette, SelectionAsk, openCommandPalette, topicHits, companyHits, mergeHits } = palette;

test('local matches: topics in both languages, companies by prefix, a capped and ordered list', () => {
  assert.equal(topicHits('two pointers', false).some((h) => h.href === '/topics/two-pointers-windows'), true);
  assert.equal(topicHits('双指针', true)[0].title, '双指针滑窗');
  assert.deepEqual(topicHits('  ', false), []);
  const companies = [{ slug: 'jpmorgan-chase', name: 'JPMorgan Chase' }, { slug: 'amazon', name: 'Amazon' }, { slug: 'samazon', name: 'Samazon' }];
  assert.deepEqual(companyHits('ama', companies).map((h) => h.href), ['/company/amazon', '/company/samazon']);
  const hit = (group, n) => ({ group, key: `${group}${n}`, title: `${group} ${n}`, href: '/' });
  const merged = mergeHits({ content: [hit('content', 1)], problems: Array.from({ length: 8 }, (_, i) => hit('problems', i)) });
  assert.equal(merged.length, 6, 'five per group');
  assert.equal(merged[0].group === 'problems' && merged.at(-1).group === 'content', true);
  const order = mergeHits({ companies: [hit('companies', 1)], terms: [hit('terms', 1)], topics: [hit('topics', 1)] });
  assert.deepEqual(order.map((h) => h.group), ['topics', 'terms', 'companies'], 'glossary terms right after the topics');
});

test('the workspace search button and the lecture page use the palette', () => {
  const academy = readFileSync(new URL('../components/academy.tsx', import.meta.url), 'utf8');
  assert.equal(academy.includes('onClick={() => openCommandPalette()}'), true);
  assert.equal(academy.includes('<PaletteKey />') && !academy.includes('<kbd>⌘K</kbd>'), true, 'Ctrl K off Apple devices');
  assert.equal(academy.includes("api<SearchResult[]>"), false, 'the old lesson-only dialog is gone');
  assert.equal(readFileSync(new URL('../components/learning.tsx', import.meta.url), 'utf8').includes('<SelectionAsk clip={{ target: `clip:lesson/${id}`'), true);
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.equal(layout.includes('<CommandPalette ai={aiEnabled()}>{children}</CommandPalette>'), true);
});

const calls = [];
let gate = null;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  calls.push({ url: u, body: init.body ? JSON.parse(init.body) : null });
  if (u.startsWith('/api/oj/library?collection=all')) return Response.json({ error: '请先登录' }, { status: 401 });
  if (u.startsWith('/api/oj/library?q=')) return Response.json({ items: [{ id: 'lc-1', number: 1, titleZh: '两数之和', titleEn: 'Two Sum', difficulty: '简单', judgeProblemId: 'lc-1' }, { id: 'lc-2', number: 2, titleEn: 'Not judgeable', judgeProblemId: null }] });
  if (u.startsWith('/api/oj/oa-library')) return Response.json({ items: [{ id: 'oa-acme-1', companySlug: 'acme', companyName: 'Acme', number: 1, title: 'Two Towers' }] });
  if (u.startsWith('/api/content/list')) return Response.json({ items: [{ type: 'concept', slug: 'two-pointers', title: 'Two Pointers', partial: false }, { type: 'experience', slug: 'draft', title: 'Two rounds', partial: true, company: { name: 'Acme' } }] });
  if (u.startsWith('/api/oj/reports/companies')) return Response.json({ items: [{ slug: 'two-sigma', name: 'Two Sigma' }] });
  if (u === '/api/oj/ai/ask') await gate;
  if (u === '/api/oj/ai/ask')
    return Response.json({ text: 'Move both ends inward [1].', sources: [{ n: 1, title: 'Two Pointers', url: '/library/concept/two-pointers', type: 'concept' }], remaining: 9 });
  return Response.json({ error: 'nope' }, { status: 404 });
};
const wait = (ms) => act(async () => new Promise((r) => setTimeout(r, ms)));
const press = (key, extra = {}) =>
  act(async () => {
    (document.activeElement ?? window).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, ...extra }));
  });
async function type(value) {
  const input = document.querySelector('.cmdk-bar input');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await wait(300);
}
const options = () => [...document.querySelectorAll('[role="option"]')];

test('⌘K: merged results, keyboard selection, same-tab workspace navigation, Ask AI with sources', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(CommandPalette, { ai: true }, createElement(SelectionAsk, null, createElement('p', null, 'Lecture text')))));
  const dialog = document.querySelector('dialog.cmdk');
  assert.equal(dialog.hasAttribute('open'), false);
  // Inside the code editor ⌘K belongs to Monaco.
  const editor = document.createElement('div');
  editor.className = 'monaco-editor';
  editor.append(document.createElement('textarea'));
  document.body.append(editor);
  await act(async () => editor.firstChild.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })));
  assert.equal(dialog.hasAttribute('open'), false);
  editor.remove();
  await act(async () => window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
  assert.equal(dialog.hasAttribute('open'), true);
  const input = document.querySelector('.cmdk-bar input');
  assert.equal(input.getAttribute('role'), 'combobox');

  await type('two');
  // Signed out: the full bank answers 401, so the curated line is searched and lessons are skipped.
  assert.equal(calls.some((c) => c.url.startsWith('/api/oj/library?q=two')), true);
  await type('tw');
  await type('two');
  const after = calls.filter((c) => c.url.startsWith('/api/oj/library?collection=all') || c.url.startsWith('/api/search'));
  assert.equal(after.length, 2, 'once signed out is known, members-only searches stop');
  const rows = options();
  const titles = rows.map((o) => o.textContent);
  assert.equal(titles[0].startsWith('1. Two Sum'), true);
  assert.equal(titles.some((x) => x.includes('Not judgeable')), false, 'only judgeable problems');
  assert.equal(titles.some((x) => x.includes('Two Towers')), true);
  assert.equal(titles.some((x) => x.includes('Two Pointers') && x.includes('Template')), true, 'a Line 500 topic');
  assert.equal(titles.some((x) => x.includes('Two Sigma')), true, 'a company page');
  const groups = [...document.querySelectorAll('.cmdk-group')].map((g) => g.dataset.group);
  assert.equal(groups.indexOf('terms'), groups.indexOf('topics') + 1, 'glossary terms follow the topics');
  const term = rows.find((o) => o.getAttribute('href') === '/topics/glossary#term-two-pointers');
  assert.ok(term && term.textContent.includes('two pointers') && term.textContent.includes('双指针'), 'a term shows both languages');
  assert.equal(rows.at(-1).classList.contains('cmdk-ask'), true, 'Ask AI is the last row');
  assert.equal(document.querySelector('.cmdk-ask-note').textContent.includes('Anthropic'), true);
  const hrefs = rows.map((o) => o.getAttribute('href'));
  assert.equal(hrefs.includes('/oa/acme/oa-acme-1') && hrefs.includes('/library/concept/two-pointers'), true);
  assert.equal(hrefs.includes('/?view=content&type=experience&slug=draft'), true, 'partial pages open in the workspace');
  assert.equal(rows[0].getAttribute('aria-selected'), 'true');
  assert.equal(input.getAttribute('aria-activedescendant'), rows[0].id);

  await press('ArrowDown');
  assert.equal(options()[1].getAttribute('aria-selected'), 'true');
  await press('ArrowUp');
  await press('Enter');
  assert.equal(location.search, '?view=problem&problem=lc-1', 'workspace links stay in the tab');
  assert.equal(dialog.hasAttribute('open'), false);

  // Selected lecture text opens the palette as context, Ask AI first.
  await act(async () => openCommandPalette({ context: 'two pointers move inward' }));
  assert.equal(document.querySelector('.cmdk-context q').textContent, 'two pointers move inward');
  assert.equal(options()[0].classList.contains('cmdk-ask'), true);
  await press('Enter');
  await wait(50);
  const ask = calls.find((c) => c.url === '/api/oj/ai/ask');
  assert.deepEqual(ask.body, { question: 'two', locale: 'en', context: 'two pointers move inward' });
  const answer = document.querySelector('.cmdk-answer');
  assert.equal(answer.textContent.includes('Move both ends inward'), true);
  assert.equal(document.querySelector('.cmdk-sources a').getAttribute('href'), '/library/concept/two-pointers');
  assert.equal(answer.textContent.includes('9 left today'), true);

  // One question at a time: Enter again while it is in flight sends nothing more.
  const asks = () => calls.filter((c) => c.url === '/api/oj/ai/ask');
  let release;
  gate = new Promise((r) => (release = r));
  await type('x');
  await press('Enter');
  assert.equal(options()[0].getAttribute('aria-disabled'), 'true');
  await press('Enter');
  assert.equal(asks().length, 2);
  // Under 2 characters, the selection is asked about with the default question.
  assert.equal(asks()[1].body.question, 'What does this passage mean?');
  release();
  await wait(50);
  assert.equal(options()[0].hasAttribute('aria-disabled'), false);
  assert.equal(input.getAttribute('maxlength'), '500');
  await act(async () => root.unmount());
});

test('without AI there is no ask row and selections stay plain', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(CommandPalette, { ai: false }, createElement(SelectionAsk, { className: 'prose' }, 'Body'))));
  assert.equal(host.querySelector('.prose').textContent, 'Body');
  await act(async () => openCommandPalette());
  await type('two');
  assert.equal(document.querySelector('.cmdk-ask') === null, true);
  assert.equal(document.querySelector('.cmdk-ask-note') === null, true);
  await act(async () => root.unmount());
});

test('with a clip, a selection offers saving and a card even without AI; saving appends a cited quote', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const clip = { target: 'clip:concept/two-pointers', title: 'Two [Pointers]', href: '/library/concept/two-pointers' };
  const notes = [];
  let stored = '> earlier';
  let answer = 200;
  globalThis.fetch = async (url, init = {}) => {
    notes.push([init.method ?? 'GET', String(url)]);
    if (answer !== 200) return Response.json({ error: 'x' }, { status: answer });
    if (init.method === 'PUT') stored = JSON.parse(init.body).body;
    return Response.json({ target: clip.target, body: stored, updatedAt: 1 });
  };
  await act(async () => root.render(createElement(CommandPalette, { ai: false }, createElement(SelectionAsk, { className: 'prose', clip }, createElement('p', null, 'Move both ends inward')))));
  const text = host.querySelector('.prose p').firstChild;
  const select = async () => {
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 9);
    range.getBoundingClientRect = () => ({ left: 10, width: 20, bottom: 30 });
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    await act(async () => host.querySelector('.prose').dispatchEvent(new dom.window.Event('mouseup')));
  };
  await select();
  const bar = host.querySelector('.cmdk-selection-ask');
  assert.equal(bar.getAttribute('role'), 'toolbar');
  assert.deepEqual([...bar.querySelectorAll('button')].map((b) => b.textContent.trim()), ['Save to notes', 'Make a card'], 'no Ask AI without AI');
  await act(async () => bar.querySelector('button').click());
  await wait(20);
  assert.deepEqual(notes.map(([m]) => m), ['GET', 'PUT'], 'read, then the appended note');
  assert.equal(notes[0][1], '/api/oj/notes?target=clip%3Aconcept%2Ftwo-pointers');
  assert.equal(stored, '> earlier\n\n> Move both\n> — [Two Pointers](/library/concept/two-pointers)\n');
  assert.equal(host.querySelector('.cmdk-selection-ask [role="status"]').textContent.startsWith('Saved to your notes.'), true);
  // The View link survives its own press: mousedown keeps the selection, mouseup inside the toolbar doesn't re-measure.
  const view = host.querySelector('.cmdk-selection-ask [role="status"] a');
  assert.equal(view.getAttribute('href'), '/?view=review-session&tab=cards');
  assert.equal(view.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true })), false, 'mousedown keeps the selection');
  await act(async () => view.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true })));
  await act(async () => view.dispatchEvent(new dom.window.KeyboardEvent('keyup', { bubbles: true, key: 'Tab' })));
  assert.equal(view.isConnected, true, 'still there when the click comes');
  // Signed out: a sign-in prompt instead.
  answer = 401;
  await select();
  await act(async () => host.querySelector('.cmdk-selection-ask button').click());
  await wait(20);
  assert.equal(host.querySelector('.cmdk-selection-ask [role="status"]').textContent, 'Sign in to save notes.');
  await act(async () => root.unmount());
});

test('with AI and a clip, Ask AI joins the two clip buttons', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const clip = { target: 'clip:sd/caching', title: 'Caching', href: '/system-design/caching' };
  await act(async () => root.render(createElement(CommandPalette, { ai: true }, createElement(SelectionAsk, { className: 'prose', clip }, createElement('p', null, 'Write-through cache')))));
  const range = document.createRange();
  range.selectNodeContents(host.querySelector('.prose p'));
  range.getBoundingClientRect = () => ({ left: 0, width: 10, bottom: 10 });
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  await act(async () => host.querySelector('.prose').dispatchEvent(new dom.window.Event('keyup')));
  assert.deepEqual([...host.querySelectorAll('.cmdk-selection-ask button')].map((b) => b.textContent.trim()), ['Save to notes', 'Make a card', 'Ask AI']);
  await act(async () => root.unmount());
});
