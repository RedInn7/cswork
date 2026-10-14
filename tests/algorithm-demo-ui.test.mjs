// The demo player: graph kinds draw an SVG with labelled nodes, the step controls move through
// frames, a reduced-motion switch stops playback, and topic pages embed their stop's demos.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

test('a graph demo renders an SVG, steps forward and back, and reduced motion stops playback', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  const motion = { matches: false, listeners: [], addEventListener: (_t, fn) => motion.listeners.push(fn), removeEventListener() {} };
  dom.window.matchMedia = () => motion;
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { AlgorithmDemo } = await import('../components/algorithm-demo.tsx');
  const { createDemoTrace } = await import('../lib/algorithm-demo.ts');
  const root = createRoot(document.getElementById('root'));
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  const caption = () => document.querySelector('.algorithm-demo-caption').textContent;
  try {
    await act(async () => root.render(createElement(AlgorithmDemo, { kind: 'dijkstra' })));
    const trace = createDemoTrace('dijkstra', true);
    const svg = document.querySelector('svg.algorithm-demo-graph');
    assert.ok(svg !== null);
    assert.equal(svg.getAttribute('role'), 'img');
    assert.ok(svg.getAttribute('aria-label').startsWith('Graph: A (0)'));
    assert.equal(svg.querySelectorAll('.algorithm-demo-node').length, 6);
    assert.equal(svg.querySelectorAll('.algorithm-demo-edge').length, 8);
    // English by default (the site language), and the queue box names the priority queue.
    assert.equal(caption(), trace.frames[0].caption);
    assert.ok(document.querySelector('.algorithm-demo-queue strong').textContent.startsWith('Priority queue'));
    assert.equal(button('Back').disabled, true);
    await act(async () => button('Next').click());
    assert.equal(caption(), trace.frames[1].caption);
    assert.ok(document.querySelector('.algorithm-demo-node.is-active') !== null);
    await act(async () => button('Back').click());
    assert.equal(caption(), trace.frames[0].caption);
    // Play, then the OS switches to reduced motion: playback stops.
    await act(async () => button('Play').click());
    assert.equal(button('Pause').getAttribute('aria-pressed'), 'true');
    motion.matches = true;
    await act(async () => motion.listeners.forEach((fn) => fn()));
    assert.ok(button('Play') !== undefined);
    // Grid kinds keep the cell layout; a table this wide gets the dense grid.
    await act(async () => root.render(createElement(AlgorithmDemo, { kind: 'monotonic-stack' })));
    assert.ok(document.querySelector('.algorithm-demo-grid.is-dense') !== null);
    assert.ok(document.querySelector('svg.algorithm-demo-graph') === null);
    await act(async () => root.render(createElement(AlgorithmDemo, { kind: 'nope' })));
    assert.ok(document.querySelector('.algorithm-demo') === null);
  } finally {
    await act(async () => root.unmount());
  }
});

test('topic pages embed their stop demos under an anchor; stops without one have no section', async () => {
  const { TopicView } = await import('../app/topics/views.tsx');
  const { topicStop } = await import('../app/topics/stops.ts');
  const render = (slug) =>
    new JSDOM(`<main>${renderToStaticMarkup(createElement(TopicView, { stop: topicStop(slug), zh: false }))}</main>`).window
      .document;
  const doc = render('stacks-heaps');
  const section = doc.getElementById('algorithm-demo');
  assert.ok(section !== null);
  assert.equal(section.querySelectorAll('.algorithm-demo').length, 2);
  assert.ok(doc.getElementById(section.getAttribute('aria-labelledby')) !== null);
  assert.ok(render('linked-list').getElementById('algorithm-demo') === null);
});
