import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

test('a submission judged on every case shows its weighted score, groups and the too-slow hint', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  const descriptors = new Map();
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'navigator', 'localStorage']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const root = createRoot(document.getElementById('root'));
  const render = (submission) =>
    act(async () => root.render(createElement(SubmissionResult, { submission })));
  const base = { id: 's1', problem_id: 'oa-x', language: 'python', mode: 'judge', created_at: 1, allCases: true };
  const text = () => document.body.textContent;
  try {
    await render({ ...base, status: 'running', passed: 1, total: 4, cases: [] });
    assert.match(text(), /Every case runs and the score is weighted/);
    const cases = [
      { ordinal: 0, status: 'accepted', hidden: false, group: 'correctness', stdin: '1', stdout: '1', expected: '1' },
      { ordinal: 1, status: 'accepted', hidden: true, group: 'correctness' },
      { ordinal: 2, status: 'time_limit', hidden: true, group: 'performance' },
      { ordinal: 3, status: 'accepted', hidden: true, group: 'performance' },
    ];
    await render({
      ...base,
      status: 'time_limit',
      passed: 3,
      total: 4,
      score: 75,
      groups: { correctness: 100, performance: 50 },
      cases,
    });
    assert.match(text(), /3 \/ 4 test cases passed · Score 75\/100 \(weighted\) · Correctness 100% · Performance 50%/);
    assert.match(text(), /Correct but too slow/);
    // Nothing was skipped, so no early-stop note.
    assert.doesNotMatch(text(), /were not run|judging stopped early/);
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    assert.equal(tabs[2].getAttribute('aria-label'), 'Performance test case 3: Time Limit Exceeded');
    assert.match(tabs[2].textContent, /^Perf/);
    assert.doesNotMatch(tabs[1].textContent, /Perf/);
    // A wrong answer in the performance group is not "too slow"; three limits stop the rest.
    await render({
      ...base,
      status: 'time_limit',
      passed: 1,
      total: 4,
      score: 25,
      groups: { correctness: 50, performance: 0 },
      cases: [cases[0], { ...cases[1], status: 'time_limit' }, cases[2], { ...cases[3], status: 'skipped' }],
    });
    assert.doesNotMatch(text(), /Correct but too slow/);
    assert.match(text(), /Three test cases hit a time, memory or output limit, so the rest were not run/);
    await render({
      ...base,
      status: 'time_limit',
      passed: 3,
      total: 4,
      score: 75,
      groups: { correctness: 100, performance: 50 },
      cases: [cases[0], cases[1], { ...cases[2], status: 'wrong_answer' }, cases[3]],
    });
    assert.doesNotMatch(text(), /Correct but too slow/);
    // An ordinary submission keeps the fail-fast wording and shows no weighted score.
    await render({
      ...base,
      allCases: undefined,
      status: 'wrong_answer',
      passed: 1,
      total: 4,
      score: 25,
      cases: [cases[0], { ...cases[1], status: 'wrong_answer', group: undefined }, { ordinal: 2, status: 'skipped', hidden: true }],
    });
    assert.doesNotMatch(text(), /weighted|Correctness/);
    assert.match(text(), /judging stopped early/);
    localStorage.setItem('cswork:locale', 'zh');
    await render({ ...base, status: 'time_limit', passed: 3, total: 4, score: 75, groups: { correctness: 100, performance: 50 }, cases });
    assert.match(text(), /得分 75\/100（按权重） · 正确性 100% · 性能 50%/);
    assert.match(text(), /正确但太慢/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
