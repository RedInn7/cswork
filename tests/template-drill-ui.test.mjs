// components/template-drill.tsx in a browser: swap lines back into order by tapping, fill the
// blanks, switch language, and get a fresh drill.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/topics/binary-search' }).window;
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { TemplateDrill } = await import('../components/template-drill.tsx');
const { orderDrill, blankDrill } = await import('../lib/template-drills.ts');
const { templateFor, TEMPLATE_LANGS } = await import('../lib/route-templates.ts');
const { createRoot } = await import('react-dom/client');

const button = (text) => [...document.querySelectorAll('button')].find((n) => n.textContent.trim() === text);
const said = () => document.querySelector('.topics-drill-actions output').textContent;
// React tracks an input's value; set it through the prototype setter so onChange fires.
const type = (input, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
};

test('ordering: tap two lines to swap them until the template reads in order', async () => {
  const { code } = templateFor('binary-search');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, { code, langs: TEMPLATE_LANGS, zh: false })));
  const drill = orderDrill(code.python, 'python', 1);
  const lines = () => [...document.querySelectorAll('.topics-drill-lines button')];
  assert.equal(lines().length, drill.lines.length);
  await act(async () => button('Check').click());
  assert.match(said(), /still out of place/);
  assert(lines().some((b) => b.dataset.state === 'wrong'));
  // Selection sort by taps: put the line that belongs at i into slot i.
  const now = [...drill.start];
  for (let i = 0; i < now.length; i++) {
    const j = now.indexOf(i);
    if (j === i) continue;
    await act(async () => lines()[j].click());
    assert.equal(lines()[j].getAttribute('aria-pressed'), 'true');
    await act(async () => lines()[i].click());
    [now[i], now[j]] = [now[j], now[i]];
  }
  await act(async () => button('Check').click());
  assert.equal(said(), 'All lines are in order.');
  assert(lines().every((b) => b.dataset.state === 'right'));

  // Another language starts a fresh drill on that language's template.
  await act(async () => button('Go').click());
  assert.equal(lines().length, orderDrill(code.go, 'go', 1).lines.length);
  assert.equal(said(), '');
  root.unmount();
});

test('blanks: typing the cut expressions, spacing aside, is right; Show answers fills them in', async () => {
  const { code } = templateFor('binary-search');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(TemplateDrill, { code, langs: TEMPLATE_LANGS, zh: true })));
  await act(async () => button('填空题').click());
  const holes = blankDrill(code.python, 'python', 1).filter((l) => typeof l !== 'string');
  const inputs = () => [...document.querySelectorAll('.topics-drill-code input')];
  assert.equal(inputs().length, holes.length);
  assert.equal(inputs()[0].getAttribute('aria-label'), '第 1 空');
  await act(async () => button('检查').click());
  assert.match(said(), /还有 \d+ 个不对/);
  assert.equal(inputs()[0].getAttribute('aria-invalid'), 'true');
  for (const [i, hole] of holes.entries()) await act(async () => type(inputs()[i], ` ${hole.answer.replace(/ /g, '   ')} `));
  await act(async () => button('检查').click());
  assert.equal(said(), '全部填对了。');
  // A new drill clears the answers.
  await act(async () => button('换一题').click());
  assert(inputs().every((input) => input.value === ''));
  await act(async () => button('显示答案').click());
  const fresh = blankDrill(code.python, 'python', 2).filter((l) => typeof l !== 'string');
  assert.deepEqual(inputs().map((input) => input.value), fresh.map((h) => h.answer));
  assert(inputs().every((input) => input.readOnly));
  root.unmount();
});
