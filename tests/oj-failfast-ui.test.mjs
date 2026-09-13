import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

test('judge renders live stages, selects first failure once, preserves privacy and labels truncation', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  const descriptors = new Map();
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'navigator',
  ]) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SubmissionResult } = await import('../components/oj-results.tsx');
  const root = createRoot(document.getElementById('root'));
  const submission = {
    id: 's1',
    problem_id: 'p1',
    language: 'cpp',
    mode: 'judge',
    status: 'queued',
    passed: 0,
    total: 3,
    created_at: 1,
    cases: [],
  };
  const render = async (changes) => {
    Object.assign(submission, changes);
    await act(async () =>
      root.render(
        createElement(SubmissionResult, { submission: { ...submission } }),
      ),
    );
  };
  const clickCase = async (index) =>
    act(async () => document.querySelectorAll('[role="tab"]')[index].click());
  try {
    await render({});
    assert.match(document.body.textContent, /等待评测资源/);
    await render({ status: 'compiling' });
    assert.match(document.body.textContent, /正在编译代码/);
    await render({
      status: 'running',
      passed: 1,
      cases: [
        {
          ordinal: 0,
          status: 'accepted',
          hidden: false,
          stdin: 'public input',
        },
        { ordinal: 1, status: 'running', hidden: true },
        { ordinal: 2, status: 'pending', hidden: true },
      ],
    });
    assert.match(document.body.textContent, /已检查 1 \/ 3 个测试点，1 个通过/);
    assert.match(document.body.textContent, /全部通过才会显示通过/);
    assert.equal(
      document.querySelector('.cs-result-summary .cs-verdict').textContent,
      '运行中',
    );
    await render({
      status: 'wrong_answer',
      score: 33,
      firstFailure: {
        ordinal: 1,
        status: 'wrong_answer',
        stdin: 'failing input',
        expected: 'expected value',
        stdout: 'actual value',
        stderr: '',
        truncated: { stdin: true },
      },
      cases: [
        submission.cases[0],
        { ordinal: 1, status: 'wrong_answer', hidden: true },
        { ordinal: 2, status: 'skipped', hidden: true, stdin: 'secret input' },
      ],
    });
    assert.equal(
      document.querySelector('[role="tab"][aria-selected="true"]').id,
      'case-s1-1',
    );
    assert.match(document.body.textContent, /failing input/);
    assert.match(document.body.textContent, /expected value/);
    assert.match(document.body.textContent, /actual value/);
    assert.match(document.body.textContent, /仅显示部分内容/);
    assert.match(document.body.textContent, /已停止后续评测/);
    assert.doesNotMatch(document.body.textContent, /33 分/);
    assert.equal(document.querySelector('.cs-spin'), null);
    await clickCase(0);
    await render({});
    assert.equal(
      document.querySelector('[role="tab"][aria-selected="true"]').id,
      'case-s1-0',
    );
    await clickCase(2);
    assert.match(
      document.querySelector('[role="tabpanel"]').textContent,
      /未运行/,
    );
    assert.doesNotMatch(document.body.textContent, /secret input/);
    await render({ id: 's2' });
    assert.equal(
      document.querySelector('[role="tab"][aria-selected="true"]').id,
      'case-s2-1',
    );
    await render({
      id: 's3',
      status: 'accepted',
      passed: 3,
      firstFailure: undefined,
      cases: [0, 1, 2].map((ordinal) => ({
        ordinal,
        status: 'accepted',
        hidden: true,
      })),
    });
    assert.equal(
      document.querySelector('.cs-result-summary .cs-verdict').textContent,
      '通过',
    );
    assert.match(document.body.textContent, /已通过 3 \/ 3/);
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
