import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(`export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ComplexityBudget, FailureChecklist } = await import('../components/constraint-hints.tsx');
const root = createRoot(document.getElementById('root'));
const render = (element) => act(async () => root.render(element));

test('the budget stays folded until asked for, then gives its line', async () => {
  const bounds = { n: 100000, name: 'nums.length' };
  const folded = renderToStaticMarkup(createElement(ComplexityBudget, { bounds, language: 'cpp', english: false }));
  assert.match(folded, /aria-expanded="false"/);
  assert.match(folded, /复杂度预算/);
  assert.doesNotMatch(folded, /O\(/);
  assert.equal(renderToStaticMarkup(createElement(ComplexityBudget, { bounds: null, language: 'cpp', english: false })), '');

  await render(createElement(ComplexityBudget, { bounds, language: 'cpp', english: true }));
  const button = document.querySelector('button');
  assert.equal(button.textContent, 'Complexity budget');
  await act(async () => button.click());
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  const line = document.getElementById('complexity-budget');
  assert.match(line.textContent, /nums\.length ≤ 10\^5 → .* aim for O\(n log n\) or better; O\(n²\) ≈ 10\^10 is too slow\./);
  assert.equal(line.querySelector('a'), null);
  // Python at 10^6: the warning and the lesson on estimating complexity.
  await render(createElement(ComplexityBudget, { bounds: { n: 1000000, name: 'n' }, language: 'python', english: false }));
  assert.match(document.getElementById('complexity-budget').textContent, /Python 每秒大约只有 10\^7 次/);
  assert.equal(document.querySelector('#complexity-budget a').getAttribute('href'), '/learn/big-o/complexity');
  await render(null);
});

test('the checklist: lines and links when it has checks, nothing otherwise', () => {
  const html = (props) =>
    renderToStaticMarkup(
      createElement(FailureChecklist, { codingMode: 'leetcode', code: '', stderr: '', bounds: null, statement: '', english: false, ...props }),
    );
  assert.equal(html({ status: 'accepted', language: 'python' }), '');
  assert.equal(html({ status: 'wrong_answer', language: 'sql' }), '');
  const code = ['def bfs(root):', '    queue = [root]', '    while queue:', '        node = queue.pop(0)'].join('\n');
  const zh = html({ status: 'time_limit', language: 'python', code });
  assert.match(zh, /排查清单：先看这几处/);
  assert.match(zh, /第 4 行/);
  assert.match(zh, /href="\/topics\/binary-tree#topic-pitfalls">看专题</);
  assert.equal((zh.match(/<li/g) ?? []).length, 3);
  const en = html({ status: 'runtime_error', language: 'python', codingMode: 'acm', stderr: 'RecursionError', english: true });
  assert.match(en, /What to check first/);
  assert.match(en, /href="\/judge-environment#recursion">Judge environment</);
});

test('the workspace hides both in a mock, contest, whiteboard or drill; the anchors they link to exist', () => {
  const source = readFileSync(new URL('../components/problem-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /\{!examMode && !wb\.on && <ComplexityBudget bounds=\{bounds\}/);
  assert.match(source, /\{!examMode && !wb\.on && drillN === null && submission\.mode !== 'drill' && \(\s*<FailureChecklist/);
  // The generic "correct but too slow" line stays.
  assert.match(readFileSync(new URL('../components/oj-results.tsx', import.meta.url), 'utf8'), /正确但太慢/);
  const env = readFileSync(new URL('../app/judge-environment/page.tsx', import.meta.url), 'utf8');
  for (const id of ['limits', 'recursion', 'io']) assert.match(env, new RegExp(`<h2 id="${id}">`));
  assert.match(readFileSync(new URL('../app/topics/views.tsx', import.meta.url), 'utf8'), /id="topic-pitfalls"/);
});
