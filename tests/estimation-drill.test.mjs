// The capacity estimation drill (components/estimation-drill.tsx): self-consistent reference
// answers for every scenario and seed, lenient number input, ±30% grading and the worked steps.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DISK,
  EstimationDrill,
  FIELDS,
  REPLICAS,
  SCENARIOS,
  bytes,
  close,
  count,
  drillParams,
  parseAmount,
  solve,
  steps,
} from '../components/estimation-drill.tsx';

const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

test('ten scenarios, and every seed of every scenario has self-consistent answers', () => {
  assert.equal(SCENARIOS.length, 10);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, 10);
  for (const scenario of SCENARIOS) {
    assert.equal(drillParams(scenario, 0), scenario, 'seed 0 is the scenario as written');
    for (let seed = 0; seed < 25; seed++) {
      const p = drillParams(scenario, seed);
      const where = `${scenario.id} seed ${seed}`;
      assert.deepEqual(drillParams(scenario, seed), p, `${where}: the same seed gives the same numbers`);
      for (const key of ['dau', 'writes', 'ratio', 'size', 'retention', 'peak', 'serverQps'])
        assert.ok(Number.isFinite(p[key]) && p[key] > 0, `${where}.${key}`);
      const { answers: a, appServers, storageServers } = solve(p);
      near(a.qps * 86_400, p.dau * p.writes * (1 + p.ratio), `${where} qps`);
      near(a.peak, a.qps * p.peak, `${where} peak`);
      near(a.storage * 1e12, p.dau * p.writes * p.size * 365, `${where} storage`);
      near(a.bandwidth * 1e6, a.qps * p.size, `${where} bandwidth`);
      assert.equal(appServers, Math.ceil(a.peak / p.serverQps), where);
      assert.equal(storageServers, Math.ceil((p.dau * p.writes * p.size * p.retention * REPLICAS) / DISK), where);
      assert.equal(a.machines, Math.max(appServers, storageServers), where);
      assert.ok(Number.isInteger(a.machines) && a.machines >= 1, where);
      // Interview-sized numbers: not a toy, not absurd.
      assert.ok(a.qps >= 5 && a.qps <= 1e8, `${where}: qps ${a.qps}`);
      // The worked steps end on the same answers the grader uses.
      const text = steps(p, false).join('\n');
      assert.ok(text.includes(`≈ ${count(a.qps, false)}.`), where);
      assert.ok(text.includes(`≈ ${count(a.peak, false)}.`), where);
      assert.ok(text.includes(`the larger of the two: ${a.machines}.`), where);
      assert.equal(steps(p, true).length, steps(p, false).length);
      for (const field of FIELDS) assert.ok(close(a[field], a[field]), `${where}.${field}`);
    }
    assert.notDeepEqual(
      [1, 2, 3, 4].map((seed) => drillParams(scenario, seed).dau),
      [scenario.dau, scenario.dau, scenario.dau, scenario.dau],
      `${scenario.id}: new numbers actually change`,
    );
  }
  // Both kinds of bottleneck appear.
  const bound = SCENARIOS.map((s) => solve(s)).map((s) => s.storageServers > s.appServers);
  assert.ok(bound.includes(true) && bound.includes(false));
});

test('grading is ±30%, and answers can be typed with separators, suffixes or exponents', () => {
  assert.equal(close(129, 100), true);
  assert.equal(close(71, 100), true);
  assert.equal(close(131, 100), false);
  assert.equal(close(69, 100), false);
  assert.equal(close(null, 100), false);
  for (const [text, value] of [
    ['46000', 46000],
    ['46,000', 46000],
    [' 46k ', 46000],
    ['46K', 46000],
    ['4.6万', 46000],
    ['2亿', 2e8],
    ['1.5m', 1.5e6],
    ['3b', 3e9],
    ['4.6e4', 46000],
    ['.5', 0.5],
  ])
    assert.equal(parseAmount(text), value, text);
  for (const text of ['', 'abc', '1.2.3', '-5', '5x', '1e999']) assert.equal(parseAmount(text), null, text);
  assert.equal(count(46_296, true), '4.63 万');
  assert.equal(count(46_296, false), '46.3K');
  assert.equal(count(2e8, true), '2 亿');
  assert.equal(count(729, false), '729');
  assert.equal(bytes(5e9), '5 GB');
  assert.equal(bytes(500), '500 B');
});

test('the drill renders on the server, then checks answers and shows the steps and tables', async () => {
  let doc = new JSDOM(renderToStaticMarkup(createElement(EstimationDrill, { zh: true }))).window.document;
  assert.equal(doc.querySelector('h2').textContent, '容量估算练习');
  assert.equal(doc.querySelectorAll('select option').length, 10);
  assert.equal(doc.querySelectorAll('.sd-drill-field input').length, 5);
  for (const input of doc.querySelectorAll('.sd-drill-field input'))
    assert.ok(doc.querySelector(`label[for="${input.id}"]`), `${input.id} has a label`);
  assert.equal(doc.querySelector('.sd-drill-steps'), null, 'no answers before checking');

  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/system-design/estimation' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'navigator'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.getElementById('root'));
  const type = (input, value) => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text);
  try {
    await act(async () => root.render(createElement(EstimationDrill, { zh: false })));
    const { answers } = solve(SCENARIOS[0]);
    const input = (field) => document.getElementById(`sd-drill-${field}`);
    await act(async () => {
      type(input('qps'), String(Math.round(answers.qps * 1.2)));
      type(input('peak'), `${(answers.peak / 1000).toFixed(1)}k`);
      type(input('storage'), String(answers.storage));
      type(input('bandwidth'), String(answers.bandwidth * 2));
      type(input('machines'), String(answers.machines));
    });
    await act(async () => button('Check answers').click());
    const state = [...document.querySelectorAll('.sd-drill-field')].map((f) => f.dataset.state);
    assert.deepEqual(state, ['right', 'right', 'right', 'wrong', 'right']);
    assert.equal(document.querySelector('[role="status"]').textContent, '4 of 5 right');
    assert.match(document.querySelectorAll('.sd-drill-mark')[3].textContent, /^✗ Reference /);
    assert.equal(document.querySelectorAll('.sd-drill-steps li').length, 7);
    assert.deepEqual(
      [...document.querySelectorAll('.sd-drill-tables caption')].map((c) => c.textContent),
      ['Powers of two and handy numbers', 'Latency numbers (orders of magnitude)'],
    );
    // New numbers: a fresh prompt, the answers cleared.
    const dau = () => document.querySelector('.sd-drill-params dd').textContent;
    const before = dau();
    let tries = 0;
    while (dau() === before && tries++ < 5) await act(async () => button('New numbers').click());
    assert.notEqual(dau(), before);
    assert.equal(input('qps').value, '');
    assert.equal(document.querySelector('.sd-drill-steps'), null);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
