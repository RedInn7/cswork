import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

// Stylesheets load as nothing (the same loader as tests/testcase-structured-ui.test.mjs, CSS only).
register(
  `data:text/javascript,${encodeURIComponent(`export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const settle = (ms = 10) => act(async () => new Promise((r) => setTimeout(r, ms)));
const respond = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });

test('the stress test shows the first disagreeing case with both outputs and adds it as a custom case', async () => {
  const { createRoot } = await import('react-dom/client');
  const { StressTest, stressReady } = await import('../components/stress-result.tsx');
  assert.equal(stressReady('lc-53'), true);
  assert.equal(stressReady('lc-1'), false, 'two sum promises exactly one answer: not whitelisted');
  const ok = (ordinal, stdout) => ({ ordinal, status: 'finished', hidden: false, stdin: `[${ordinal}]`, stdout });
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push([String(url), init?.body && JSON.parse(init.body)]);
    if (String(url).endsWith('/stress')) return respond({ id: 'mine', referenceId: 'ref', cases: 30 }, 201);
    return String(url).endsWith('/ref')
      ? respond({ id: 'ref', status: 'finished', mode: 'run', cases: [ok(0, '1\n'), ok(1, '2\n'), ok(2, '3\n')] })
      : respond({ id: 'mine', status: 'wrong_answer', mode: 'run', cases: [ok(0, '1\n'), ok(1, '5\n'), ok(2, '9\n')] });
  };
  const added = [];
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      createElement(StressTest, {
        problemId: 'lc-53',
        code: 'class Solution: pass',
        language: 'python',
        checker: 'tokens',
        onAdd: (input) => (added.push(input), true),
      }),
    ),
  );
  try {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Stress test');
    await act(async () => button.click());
    assert.match(document.body.textContent, /Stress testing/);
    await settle(1200);
    // Only a seed, the language and the code go up: the server draws the cases.
    const [path, body] = sent[0];
    assert.equal(path, '/api/oj/problems/lc-53/stress');
    assert.deepEqual(Object.keys(body).sort(), ['code', 'language', 'seed']);
    assert.match(document.body.textContent, /Case 2 of 30 \(smallest first\) disagrees/);
    assert.match(document.body.textContent, /Reference output/);
    assert.match(document.body.textContent, /Your output/);
    assert.equal(document.querySelectorAll('.is-diff').length, 2, 'the differing line is marked on both sides');
    const add = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Add to my cases');
    await act(async () => add.click());
    assert.deepEqual(added, ['[1]']);
    assert.ok([...document.querySelectorAll('button')].some((b) => b.textContent === 'Added' && b.disabled));
  } finally {
    await act(async () => root.unmount());
  }
});

test('an OA reference output says the input went in unchecked', async () => {
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const submission = (problem_id) => ({
    id: 'r1',
    problem_id,
    language: 'python',
    mode: 'run',
    status: 'finished',
    passed: 0,
    total: 1,
    created_at: 1,
    cases: [{ ordinal: 0, status: 'finished', hidden: false, stdin: '3\n1 2 3\n', stdout: '6\n', stderr: '' }],
  });
  const root = createRoot(document.getElementById('root'));
  const show = (id) =>
    act(async () =>
      root.render(
        createElement(SubmissionResult, { submission: submission(id), ranCase: 1, reference: { status: 'done', output: '6\n' }, checker: 'tokens' }),
      ),
    );
  try {
    await show('oa-airbnb-1');
    assert.match(document.body.textContent, /the input wasn't checked against the constraints/);
    await show('lc-53');
    assert.doesNotMatch(document.body.textContent, /wasn't checked/);
  } finally {
    await act(async () => root.unmount());
  }
});
