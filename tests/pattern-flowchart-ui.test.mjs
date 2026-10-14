import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { FlowchartWalk } = await import('../app/flowchart/walk.tsx');
const { FLOWCHART, questionOrder } = await import('../lib/pattern-flowchart.ts');
const tutorials = { 'binary-search': 'Binary Search' };

test('without JavaScript the walk is hidden and the whole tree is an open, linked outline', () => {
  const html = renderToStaticMarkup(createElement(FlowchartWalk, { zh: false, tutorials }));
  assert.ok(/<section class="flow-walk" hidden=""/.test(html));
  assert.ok(/<details class="flow-outline" open=""/.test(html));
  assert.equal(html.match(/<li id="q-/g).length, questionOrder().length);
  assert.ok(html.includes('href="#q-design-lookup"'));
  assert.ok(html.includes('href="/?view=problems&amp;section=binary-search"'));
  assert.ok(html.includes('href="/library/algorithm/binary-search"'));
  // Tutorials the library does not have are not linked.
  assert.ok(!html.includes('/library/algorithm/hash-table'));
});

test('with JavaScript it walks one question at a time, with back, trail and restart', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.org/flowchart' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(FlowchartWalk, { zh: true, tutorials })));
  const { nodes, start } = FLOWCHART;
  const heading = () => document.getElementById('flow-now');
  const click = async (selector, index = 0) => {
    const button = document.querySelectorAll(selector)[index];
    assert.ok(Boolean(button), selector);
    await act(async () => button.click());
  };
  assert.equal(document.querySelector('.flow-walk').hidden, false);
  assert.equal(document.querySelector('.flow-outline').open, false);
  assert.equal(heading().textContent, nodes[start].q[0]);
  assert.equal(document.activeElement === heading(), false, 'no focus steal on load');

  await click('.flow-answers [data-answer="yes"]');
  assert.equal(heading().textContent, nodes['q-design-lookup'].q[0]);
  assert.equal(document.activeElement === heading(), true);
  await click('.flow-controls button'); // back
  assert.equal(heading().textContent, nodes[start].q[0]);

  // No, yes, yes, yes: not a design class, connected, a binary tree, a BST.
  for (const answer of ['no', 'yes', 'yes', 'yes']) await click(`.flow-answers [data-answer="${answer}"]`);
  assert.equal(document.querySelector('.flow-answers') === null, true);
  assert.ok(heading().textContent.includes('二叉搜索树'));
  const practise = document.querySelector('.flow-board .flow-links a');
  assert.equal(practise.getAttribute('href'), '/?view=problems&section=binary-search-tree');
  assert.equal(document.querySelectorAll('.flow-trail li').length, 4);

  await click('.flow-trail button', 1); // back to the second answer's question
  assert.equal(heading().textContent, nodes['q-graph'].q[0]);
  await click('.flow-controls button', 1); // start over
  assert.equal(heading().textContent, nodes[start].q[0]);
  assert.equal(document.querySelector('.flow-trail') === null, true);
  await act(async () => root.unmount());
});
