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

test('your own input reruns the demo, and predict mode scores clicks on cells and graph nodes', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'localStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { AlgorithmDemo } = await import('../components/algorithm-demo.tsx');
  const root = createRoot(document.getElementById('root'));
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  const question = () => document.querySelector('.algorithm-demo-header p').textContent;
  const guessText = () => document.querySelector('.algorithm-demo-guess').textContent;
  const type = async (value) => {
    const input = document.querySelector('.algorithm-demo-input input');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    });
    await act(async () => button('Apply').click());
    return input;
  };
  try {
    await act(async () => root.render(createElement(AlgorithmDemo, { kind: 'binary-search' })));
    assert.equal(document.querySelector('.algorithm-demo-input summary').textContent, 'Try your own input');
    assert.equal(document.querySelector('.algorithm-demo-input label').textContent, 'Sorted array; target');
    // A bad input is explained in place and leaves the demo alone.
    const input = await type('3 1; 2');
    assert.equal(document.querySelector('.algorithm-demo-error[role="alert"]').textContent, 'The array must be sorted from small to large');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(input.getAttribute('aria-describedby'), document.querySelector('.algorithm-demo-error').id);
    assert.equal(question(), 'Find 23 in a sorted array');
    await type('1 3 5 7; 7');
    assert.equal(document.querySelector('.algorithm-demo-error'), null);
    assert.equal(question(), 'Find 7 in a sorted array');
    assert.equal(document.querySelectorAll('.algorithm-demo-cell').length, 4);

    await act(async () => button('Predict the next step').click());
    assert.equal(button('Predict the next step').getAttribute('aria-pressed'), 'true');
    assert.equal(button('Play').disabled, true);
    // Every cell is a button, so the next mid (index 1) is not given away.
    assert.equal(document.querySelectorAll('button.algorithm-demo-cell').length, 4);
    assert.equal(button('Next'), undefined);
    await act(async () => document.querySelectorAll('button.algorithm-demo-cell')[0].click());
    assert.match(guessText(), /✗ Not this time It was 1: 3;/);
    assert.match(guessText(), /This round: 0 \/ 1 right/);
    assert.equal(document.querySelector('.algorithm-demo-caption').textContent, 'Check index 1: compare 3 with the target 7.');
    // Moving left past mid turns nothing new current: no question, Next just plays it.
    assert.equal(document.querySelectorAll('button.algorithm-demo-cell').length, 0);
    assert.match(guessText(), /Nothing new turns current next/);
    await act(async () => button('Next').click());
    await act(async () => document.querySelectorAll('button.algorithm-demo-cell')[2].click());
    assert.match(guessText(), /✓ Right/);
    assert.match(guessText(), /1 \/ 2 right/);
    await act(async () => button('Next').click());
    await act(async () => button('Show me').click());
    assert.match(guessText(), /✗ Not this time It was 3: 7;/);
    assert.match(guessText(), /1 \/ 3 right/);
    assert.equal(document.querySelectorAll('.algorithm-demo-cell.is-active').length, 1);

    // Restore default: the original question, a fresh round.
    await act(async () => button('Restore default').click());
    assert.equal(question(), 'Find 23 in a sorted array');
    assert.match(guessText(), /0 \/ 0 right/);

    // Graph kinds: nodes are focusable buttons answered with Enter.
    await act(async () => root.render(createElement(AlgorithmDemo, { kind: 'dijkstra' })));
    assert.equal(document.querySelector('.algorithm-demo-input'), null);
    await act(async () => button('Predict the next step').click());
    const svg = document.querySelector('svg.algorithm-demo-graph');
    assert.equal(svg.getAttribute('role'), 'group');
    const nodes = [...svg.querySelectorAll('.algorithm-demo-node[role="button"]')];
    assert.equal(nodes.length, 6);
    assert.equal(nodes[0].getAttribute('tabindex'), '0');
    await act(async () => nodes[0].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.match(guessText(), /✓ Right It was A;/);
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

test('dark mode: graph labels clear 4.5:1 on their node and arrowheads match their line', async () => {
  const fs = await import('node:fs');
  const postcss = (await import('postcss')).default;
  const { contrast, parseColor } = await import('../scripts/dark-theme.mjs');
  // Hand-tuned app/theme.css wins; the rest comes from the generated block.
  const sheets = ['app/theme.css', 'app/algorithm-demo.css'].map((f) => postcss.parse(fs.readFileSync(f, 'utf8')));
  const dark = (selector, prop) => {
    for (const sheet of sheets) {
      let value;
      sheet.walkRules((r) => {
        if (r.selectors.includes(`.dark .algorithm-demo ${selector}`))
          r.walkDecls(prop, (d) => {
            value = d.value;
          });
      });
      if (value) return parseColor(value).rgb;
    }
    throw new Error(`no dark ${prop} for ${selector}`);
  };
  const node = '.algorithm-demo-node';
  const halo = dark(`${node} .algorithm-demo-note`, 'stroke');
  const pairs = [
    [dark(`${node} text`, 'fill'), dark(`${node} circle`, 'fill')],
    [dark(`${node} text`, 'fill'), dark(`${node}.is-visited circle`, 'fill')],
    [dark(`${node} .algorithm-demo-note`, 'fill'), halo],
    [dark(`${node}.is-active .algorithm-demo-note`, 'fill'), halo],
    ...['is-active', 'is-answer', 'is-blocked'].map((s) => [dark(`${node}.${s} text`, 'fill'), dark(`${node}.${s} circle`, 'fill')]),
  ];
  for (const [text, ground] of pairs) assert.ok(contrast(text, ground) >= 4.5);
  for (const s of ['', '.is-active', '.is-visited', '.is-answer', '.is-muted'])
    assert.deepEqual(dark(`.algorithm-demo-edge${s} polygon`, 'fill'), dark(`.algorithm-demo-edge${s} line`, 'stroke'));
});
