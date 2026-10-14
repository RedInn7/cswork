import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

test('problem timer counts up, persists, counts down and alerts at zero', async (t) => {
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
    'localStorage',
  ]) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  t.mock.timers.enable({
    apis: ['Date', 'setInterval', 'setTimeout'],
    now: 1_700_000_000_000,
  });
  const { createRoot } = await import('react-dom/client');
  const { ProblemTimer, formatClock, timerSeconds } =
    await import('../components/problem-timer.tsx');
  let root = createRoot(document.getElementById('root'));
  const mount = () =>
    act(async () =>
      root.render(
        createElement(ProblemTimer, {
          userId: 'u1',
          problemId: 'p1',
          difficulty: '简单',
        }),
      ),
    );
  const clock = () => document.querySelector('[role="timer"]')?.textContent;
  const has = (label) => !!document.querySelector(`[aria-label="${label}"]`);
  const click = (label) =>
    act(async () => document.querySelector(`[aria-label="${label}"]`).click());
  const tick = (ms) => act(async () => t.mock.timers.tick(ms));
  try {
    assert.equal(formatClock(754), '12:34');
    assert.equal(formatClock(3725), '1:02:05');
    assert.equal(formatClock(-61), '-01:01');
    await mount();
    assert.equal(clock(), '00:00');
    assert.equal(timerSeconds('u1', 'p1'), null);
    await click('Start timer');
    await tick(65_000);
    assert.equal(clock(), '01:05');
    assert.equal(timerSeconds('u1', 'p1'), 65);
    await click('Pause timer');
    await tick(10_000);
    assert.equal(clock(), '01:05');
    // A reload keeps the paused reading.
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await mount();
    assert.equal(clock(), '01:05');
    assert.equal(has('Resume timer'), true);
    await click('Reset timer');
    assert.equal(timerSeconds('u1', 'p1'), null);
    // Easy presets 15 minutes; the length stays editable until it starts.
    await click('Switch to countdown');
    const length = document.querySelector('[aria-label="Countdown length"]');
    assert.equal(length.value, '15');
    await act(async () => {
      length.value = '5';
      length.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click('Start timer');
    await tick(4 * 60_000);
    assert.equal(clock(), '01:00');
    assert.equal(document.querySelector('.cs-timer.is-overdue') === null, true);
    await tick(61_000);
    assert.equal(clock(), '-00:01');
    assert.equal(document.querySelector('.cs-timer.is-overdue') !== null, true);
    assert.match(
      document.querySelector('[role="status"]').textContent,
      /5-minute countdown is up/,
    );
    await tick(8_000);
    assert.equal(document.querySelector('[role="status"]').textContent, '');
    assert.equal(timerSeconds('u1', 'p1'), 5 * 60 + 9);
    // Corrupt storage reads as a timer that never ran.
    localStorage.setItem('cswork:timer:u1:p1', '{broken');
    assert.equal(timerSeconds('u1', 'p1'), null);
  } finally {
    await act(async () => root.unmount());
    t.mock.timers.reset();
    dom.window.close();
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  }
});
