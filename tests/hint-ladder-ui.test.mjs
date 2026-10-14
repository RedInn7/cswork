import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

const react = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const alert = `import React from ${JSON.stringify(react)};export const AlertDialog=({open,children})=>open?React.createElement('div',{role:'alertdialog'},children):null;export const AlertDialogContent=({children})=>React.createElement('div',null,children);export const AlertDialogDescription=AlertDialogContent;export const AlertDialogHeader=AlertDialogContent;export const AlertDialogFooter=AlertDialogContent;export const AlertDialogTitle=AlertDialogContent;export const AlertDialogAction=({children,onClick})=>React.createElement('button',{onClick},children);export const AlertDialogCancel=AlertDialogAction;`;
register(
  `data:text/javascript,${encodeURIComponent(`const alert=${JSON.stringify(alert)};export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};if(u.endsWith('/components/ui/alert-dialog.tsx'))return {format:'module',source:alert,shortCircuit:true};return n(u,c);}`)}`,
  import.meta.url,
);

test('hints open one at a time, unlock on failures or time, and similar problems navigate in-app', async (t) => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/' });
  const beacons = [];
  for (const [name, value] of [
    ...['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage'].map(
      (name) => [name, dom.window[name]],
    ),
    [
      'navigator',
      {
        userAgent: dom.window.navigator.userAgent,
        sendBeacon: (_url, body) => beacons.push(...JSON.parse(body).events) > 0,
      },
    ],
  ])
    Object.defineProperty(globalThis, name, { configurable: true, value });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_700_000_000_000 });
  const { createRoot } = await import('react-dom/client');
  const { HintLadder, useHintLadder } = await import('../components/hint-ladder.tsx');
  const { SimilarProblems } = await import('../components/similar-problems.tsx');
  const hints = { zh: ['观察一', '不变量二', '步骤三'], en: ['Look one', 'Invariant two', 'Steps three'] };
  // The workspace keeps the ladder's memory; the ladder itself mounts only with the statement.
  function Workspace({ submission = null, failedIds, mounted = true, ...props }) {
    const ladder = useHintLadder(submission, failedIds);
    return mounted
      ? createElement(HintLadder, { problemId: 'lc-1', userId: 'u1', hints, english: true, ladder, ...props })
      : null;
  }
  const root = createRoot(document.getElementById('root'));
  const render = (props = {}) => act(async () => root.render(createElement(Workspace, props)));
  const $ = (selector) => document.querySelector(selector);
  const shown = () => document.querySelectorAll('.cs-hint-ladder-list li').length;
  const button = (text) =>
    [...document.querySelectorAll('button')].find((b) => b.textContent.includes(text));
  const click = (text) => act(async () => button(text).click());
  try {
    // A paused timer reading from an earlier attempt counts, but cannot hold hint 2 shut.
    localStorage.setItem(
      'cswork:timer:u1:lc-1',
      JSON.stringify({ mode: 'up', minutes: 15, elapsed: 360_000, startedAt: null }),
    );
    await render();
    assert.equal(shown(), 0);
    // Hint 1 is open from the start; showing it moves focus onto it.
    await click('Show next hint');
    assert.equal(shown(), 1);
    assert.equal(document.activeElement === $('.cs-hint-ladder-list li'), true);
    assert.match($('.cs-hint-ladder-list').textContent, /Hint 1 · Observation.*Look one/);
    assert.deepEqual(beacons.at(-1), { name: 'hint_open', params: { problem_id: 'lc-1', level: 1 } });
    // Hint 2 says what opens it; ten minutes on the page opens it.
    assert.equal(button('Show next hint') === undefined, true);
    assert.match($('.cs-route-hint-locked').textContent, /Hint 2: .*failed submission or 10 minutes.*4 min to go/);
    await act(async () => t.mock.timers.tick(600_000));
    assert.equal(button('Show next hint') !== undefined, true);
    // A failed live verdict counts once however often it re-renders; two open hint 3.
    const failed = { id: 's1', mode: 'judge', status: 'wrong_answer' };
    await render({ submission: failed });
    await render({ submission: { ...failed } });
    await click('Show next hint');
    assert.equal(shown(), 2);
    assert.match($('.cs-route-hint-locked').textContent, /Hint 3: .*1 more to go/);
    // Switching tabs unmounts the ladder; a failure that lands meanwhile still counts,
    // and the shown hints stay shown.
    await render({ submission: failed, mounted: false });
    await render({ submission: { ...failed, id: 's2' }, mounted: false });
    await render({ submission: { ...failed, id: 's2' } });
    assert.equal(shown(), 2);
    await click('Show next hint');
    assert.equal(shown(), 3);
    assert.equal(button('Show next hint') === undefined, true);
    assert.equal($('.cs-route-hint-locked') === null, true);
    assert.equal(beacons.filter((b) => b.name === 'hint_open').length, 3);

    // A fresh page: the problem timer's reading counts, and a locked hint can be shown after a confirm.
    await act(async () => root.unmount());
    localStorage.setItem(
      'cswork:timer:u1:lc-2',
      JSON.stringify({ mode: 'up', minutes: 15, elapsed: 600_000, startedAt: null }),
    );
    const again = createRoot(document.getElementById('root'));
    // Left mid-judge and came back: the restored verdict is already among the server's ids.
    const restored = { id: 's9', mode: 'judge', status: 'wrong_answer' };
    await act(async () =>
      again.render(
        createElement(Workspace, { problemId: 'lc-2', english: false, failedIds: ['s9'], submission: restored }),
      ),
    );
    await click('显示下一条提示');
    await click('显示下一条提示');
    assert.equal(shown(), 2);
    assert.match($('.cs-route-hint-locked').textContent, /提示 3：两次提交未通过后解锁（还差 1 次）/);
    await click('仍要查看');
    assert.equal($('[role="alertdialog"]') !== null, true);
    await click('查看提示');
    assert.equal(shown(), 3);
    assert.equal($('[role="alertdialog"]') === null, true);
    assert.match($('.cs-hint-ladder-list').textContent, /提示 3 · 步骤步骤三/);
    assert.deepEqual(beacons.at(-1).params, { problem_id: 'lc-2', level: 3 });

    // Similar problems: collapsed, then links open problems in the app.
    const went = [];
    await act(async () =>
      again.render(
        createElement(SimilarProblems, {
          items: [
            { id: 'lc-49', title: '字母异位词分组', titleEn: 'Group Anagrams', difficulty: '中等', solved: true },
            { id: 'oa-acme-2', title: 'Rate Limiter', difficulty: '困难', solved: false },
          ],
          english: true,
          navigate: (view, extra) => went.push([view, extra]),
        }),
      ),
    );
    const toggle = $('.cs-similar h3 button');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal($('#similar-problems-list').hidden, true);
    await act(async () => toggle.click());
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    assert.equal($('#similar-problems-list').hidden, false);
    const links = [...document.querySelectorAll('.cs-similar a')];
    assert.deepEqual(
      links.map((a) => a.textContent),
      ['Solved: 49. Group AnagramsMedium', 'Rate LimiterHard'],
    );
    assert.equal(links[0].getAttribute('href'), '/?view=problem&problem=lc-49');
    await act(async () => links[1].click());
    assert.deepEqual(went, [['problem', { problem: 'oa-acme-2' }]]);
    await act(async () => again.unmount());
  } finally {
    for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
      delete globalThis[name];
  }
});
