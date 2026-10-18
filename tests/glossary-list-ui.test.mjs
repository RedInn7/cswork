// The glossary list: search hides what doesn't match (a hash pointing at a hidden term clears it),
// the browser's voice reads a term and its sentence, and a term opens the card editor prefilled;
// saving signed out shows the editor's 401 text.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><html lang="zh-CN"><body><div id="root"></div></body></html>', { url: 'https://cswork.test/topics/glossary' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'localStorage', 'navigator', 'location', 'history', 'getComputedStyle'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
localStorage.setItem('cswork:locale', 'zh');
const spoken = [];
globalThis.speechSynthesis = { speak: (u) => spoken.push(u), cancel: () => {} };
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
const puts = [];
globalThis.fetch = async (url, init = {}) => {
  puts.push([init.method, String(url), JSON.parse(init.body).body]);
  return Response.json({ error: '请先登录' }, { status: 401 });
};
const { createRoot } = await import('react-dom/client');
const { GlossaryList } = await import('../components/glossary-list.tsx');
const { GLOSSARY } = await import('../lib/glossary.ts');

const settle = (ms = 30) => act(async () => new Promise((r) => setTimeout(r, ms)));
const visible = () => [...document.querySelectorAll('.glossary-term')].filter((el) => !el.hidden);

test('search, listen, and make a card from a term', async () => {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(GlossaryList, { zh: true })));
  assert.equal(visible().length, GLOSSARY.length);
  assert.equal(document.querySelector('[role="status"]').textContent, `共 ${GLOSSARY.length} 条`);

  const input = document.querySelector('.glossary-tools input');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, '差分');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.ok(visible().some((el) => el.id === 'term-difference-array'));
  assert.ok(visible().every((el) => el.textContent.includes('差分')));
  assert.equal(document.querySelector('[role="status"]').textContent, `找到 ${visible().length} 条`);
  const shownGroups = [...document.querySelectorAll('section.glossary-group')].filter((s) => !s.hidden);
  assert.deepEqual(shownGroups.map((s) => s.getAttribute('aria-labelledby')), ['glossary-array']);

  const term = document.getElementById('term-difference-array');
  const [sayTerm, saySentence] = term.querySelectorAll('.glossary-listen');
  await act(async () => sayTerm.click());
  await act(async () => saySentence.click());
  assert.deepEqual(spoken.map((u) => [u.text, u.lang, u.rate]), [
    ['difference array', 'en-US', 0.9],
    [GLOSSARY.find((t) => t.id === 'difference-array').say, 'en-US', 0.9],
  ]);
  // Chinese labels inside the lang="en" term text carry their own language.
  assert.equal(sayTerm.getAttribute('lang'), 'zh-CN');
  for (const label of document.querySelectorAll('.glossary-alt .sr-only')) assert.equal(label.getAttribute('lang'), 'zh-CN');

  // ⌘K on this page only changes the hash: a term the search hides clears the search and scrolls into view.
  const hidden = document.querySelector('.glossary-term[hidden]');
  const scrolled = [];
  dom.window.Element.prototype.scrollIntoView = function () {
    scrolled.push(this.id);
  };
  history.replaceState(null, '', `#${hidden.id}`);
  await act(async () => window.dispatchEvent(new dom.window.Event('hashchange')));
  assert.equal(input.value, '');
  assert.equal(visible().length, GLOSSARY.length);
  assert.deepEqual(scrolled, [hidden.id]);

  await act(async () => term.querySelector('.glossary-actions button').click());
  // The editor is loaded on first use.
  for (let i = 0; i < 100 && !document.querySelector('[role="dialog"]'); i++) await settle(50);
  const dialog = document.querySelector('[role="dialog"]');
  assert.ok(dialog, 'the card editor opens');
  const [front, back] = dialog.querySelectorAll('textarea');
  assert.equal(front.value, '「差分」英文怎么说？');
  assert.ok(back.value.startsWith('difference array\n') && back.value.includes('r plus one'));
  assert.equal(dialog.querySelector('input').value, 'glossary prefix-intervals');
  assert.equal(dialog.querySelector('a[href="/topics/glossary#term-difference-array"]').textContent, '差分');
  await act(async () => dialog.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  await settle();
  assert.equal(puts.length, 1);
  assert.match(puts[0][1], /^\/api\/oj\/notes\?target=card:[a-z0-9]{12}$/);
  assert.deepEqual(JSON.parse(puts[0][2]).src, { href: '/topics/glossary#term-difference-array', title: '差分' });
  assert.equal(dialog.querySelector('[role="alert"]').textContent, '登录后才能保存卡片。');
  await act(async () => root.unmount());
});
