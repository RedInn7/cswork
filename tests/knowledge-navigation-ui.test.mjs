import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
register(
  `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
  import.meta.url,
);

test('knowledge and engineering course lists have separate membership', async () => {
  const { CourseList } = await import('../components/learning.tsx');
  const boot = {
    person: null,
    courses: [
      {
        id: 'gomall',
        title: '工程实战课程',
        summary: 'Engineering',
        lessons: [],
        version: '1',
        has_access: false,
      },
      {
        id: 'sde-interview-foundations',
        title: '算法图解专题',
        summary: 'Algorithms',
        lessons: [],
        version: '2',
        has_access: false,
      },
    ],
    problems: [],
    progress: [],
    submissions: [],
    notifications: [],
    services: {},
  };
  const render = (knowledge) =>
    renderToStaticMarkup(
      createElement(CourseList, {
        boot,
        knowledge,
        navigate() {},
        login() {},
        ask() {},
      }),
    );
  assert.match(render(true), /算法图解专题/);
  assert.doesNotMatch(render(true), /工程实战课程/);
  assert.match(render(false), /工程实战课程/);
  assert.doesNotMatch(render(false), /算法图解专题/);
});

test('exercise panel shows authoritative statuses, refreshes after practice, and retries errors', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const key of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
  ])
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: dom.window[key],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { KnowledgeExercises } =
    await import('../components/knowledge-exercises.tsx');
  const oldFetch = globalThis.fetch;
  let solved = false,
    failure = false;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify(
        failure
          ? { error: 'offline' }
          : {
              lessonId: 'interview-04',
              currentRound: { id: 'r1', number: 1 },
              completed: solved ? 1 : 0,
              total: 3,
              items: [
                {
                  id: 'lc-35',
                  number: 35,
                  title: '搜索插入位置',
                  difficulty: 'Easy',
                  hint: '检查插入边界',
                  available: true,
                  judging: false,
                  status: solved ? 'solved' : 'not_started',
                },
                {
                  id: 'lc-875',
                  number: 875,
                  title: '爱吃香蕉的珂珂',
                  difficulty: 'Medium',
                  hint: '证明单调性',
                  available: true,
                  judging: false,
                  status: 'attempted',
                },
                {
                  id: 'lc-215',
                  number: 215,
                  title: '第K大',
                  difficulty: 'Medium',
                  hint: '比较堆',
                  available: true,
                  judging: false,
                  status: 'not_started',
                },
              ],
            },
      ),
      {
        status: failure ? 503 : 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(
        createElement(KnowledgeExercises, {
          lessonId: 'interview-04',
          userId: 'alice',
          navigate() {},
        }),
      ),
    );
    assert.match(document.body.textContent, /已通过 0 \/ 3/);
    assert.match(document.body.textContent, /尝试过，未通过/);
    assert.match(document.body.textContent, /未开始/);
    solved = true;
    await act(async () =>
      window.dispatchEvent(new Event('cswork:practice-progress-changed')),
    );
    assert.match(document.body.textContent, /已通过 1 \/ 3/);
    failure = true;
    await act(async () =>
      window.dispatchEvent(new Event('cswork:practice-progress-changed')),
    );
    assert.match(document.body.textContent, /暂时无法获取完成情况/);
    assert.doesNotMatch(document.body.textContent, /未开始/);
    failure = false;
    await act(async () => document.querySelector('button').click());
    assert.match(document.body.textContent, /已通过 1 \/ 3/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = oldFetch;
    dom.window.close();
  }
});
