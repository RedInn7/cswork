import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// Exercise the real component with a delayed API, including ambiguous create retries.
test('curated practice UI preserves language and round history, deduplicates clicks and retries', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'localStorage',
    'sessionStorage',
  ]) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { StudyLibrary } = await import('../components/study-library.tsx');
  const rounds = [{ id: 'one', number: 1, createdAt: 1, solved: 12 }];
  let activeRoundId = 'one';
  let failCreate = true;
  let pendingVerdict = null;
  let pendingResolve;
  const mutations = [];
  const requests = [];
  const navigations = [];
  const longTitleZh = '不含重复字符的最长子字符串及其边界情况';
  const longTitleEn =
    'Longest Substring Without Repeating Characters and Its Boundary Cases';
  const roundState = () => ({
    rounds: [...rounds],
    activeRoundId,
    currentRound: rounds.find((r) => r.id === activeRoundId),
  });
  const page = () => ({
    ...roundState(),
    items: ['solved', 'attempted', 'not_started'].map(
      (progressStatus, index) => ({
        id: `lc-${index + 1}`,
        number: index + 1,
        titleZh: index === 2 ? longTitleZh : `题目${index + 1}`,
        titleEn: index === 2 ? longTitleEn : `Problem ${index + 1}`,
        difficulty: 'Easy',
        topics: [],
        caseStatus: 'verified',
        judgeProblemId: `lc-${index + 1}`,
        progressStatus:
          activeRoundId === 'one'
            ? index === 1 && pendingVerdict === 'accepted'
              ? 'solved'
              : progressStatus
            : 'not_started',
        solved:
          activeRoundId === 'one' &&
          (progressStatus === 'solved' ||
            (index === 1 && pendingVerdict === 'accepted')),
        judging: index === 1 && pendingVerdict === 'queued',
      }),
    ),
    total: 3,
    page: 1,
    pageSize: 30,
    topics: [],
    collection: {
      id: 'ling-selected-500',
      total: 500,
      ready: 500,
      solved: roundState().currentRound.solved,
      sections: [
        {
          slug: 'array',
          title: '数组',
          titleEn: 'Arrays',
          total: 30,
          solved: 2,
        },
      ],
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      const request = JSON.parse(options.body);
      mutations.push(request);
      if (request.action === 'create') {
        await new Promise((resolve) => {
          pendingResolve = resolve;
        });
        if (failCreate)
          return Response.json({ error: 'Temporary failure' }, { status: 503 });
        rounds.push({ id: 'two', number: 2, createdAt: 2, solved: 0 });
        activeRoundId = 'two';
      } else activeRoundId = request.roundId;
      return Response.json(roundState());
    }
    requests.push(url);
    return Response.json(page());
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find(
      (node) => node.textContent === text,
    );
  const select = async (node, value) => {
    await act(async () => {
      node.value = value;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
  };
  try {
    await act(async () =>
      root.render(
        createElement(StudyLibrary, {
          navigate: (...args) => navigations.push(args),
          availableProblemIds: [],
        }),
      ),
    );
    await settle();
    assert.match(document.body.textContent, /灵神题单精选/);
    assert.deepEqual(
      [...document.querySelectorAll('.study-progress')].map(
        (node) => node.textContent,
      ),
      ['已通过', '未通过', '未开始'],
    );
    assert.equal(
      document.querySelectorAll('.study-row[data-progress="solved"]').length,
      1,
    );
    const rows = [...document.querySelectorAll('.study-row')];
    assert.deepEqual(
      [...rows[0].children].map((node) => node.className),
      ['study-progress', 'study-row-main', 'study-level'],
      'each compact row contains only status, numbered title, and difficulty',
    );
    assert.equal(
      rows[0].querySelector('.study-row-main').textContent,
      '1. 题目1',
    );
    assert.equal(
      rows[0].querySelector('.study-progress .sr-only').textContent,
      '已通过',
    );
    assert.equal(rows[1].querySelector('.study-progress').title, '未通过');
    assert.equal(rows[2].querySelector('.study-progress svg'), null);
    assert.equal(
      rows[2].querySelector('.study-row-main').title,
      `3. ${longTitleZh}`,
    );
    await act(async () => rows[0].click());
    assert.deepEqual(navigations, [['problem', { problem: 'lc-1' }]]);
    const beforeRefresh = requests.length;
    await act(async () =>
      window.dispatchEvent(new Event('cswork:practice-progress-changed')),
    );
    await settle();
    assert.ok(requests.length > beforeRefresh);
    assert.doesNotMatch(document.body.textContent, /全部灵神题单|课程练习/);
    assert.ok(
      requests.every(
        (url) =>
          new URL(url, 'https://cswork.test').searchParams.get('collection') ===
          'ling-selected-500',
      ),
    );
    await select(document.querySelector('[aria-label="题单语言"]'), 'en');
    assert.match(document.body.textContent, /Ling’s Curated 500/);
    assert.match(document.body.textContent, /Arrays/);
    assert.match(document.body.textContent, /All difficulties/);
    assert.equal(localStorage.getItem('cswork:problem:locale'), 'en');
    const englishTitle = document.querySelectorAll('.study-row-main')[2];
    assert.equal(englishTitle.textContent, `3. ${longTitleEn}`);
    assert.equal(
      englishTitle.title,
      `3. ${longTitleEn}`,
      'full long title remains available',
    );
    const start = button('Start a new round');
    await act(async () => {
      start.click();
      start.click();
    });
    assert.equal(mutations.length, 1);
    assert.equal(document.querySelector('#practice-round').disabled, true);
    await act(async () => pendingResolve());
    await settle();
    assert.match(
      document.querySelector('[role="alert"]').textContent,
      /Could not update your round/,
    );
    failCreate = false;
    await act(async () => button('Start a new round').click());
    assert.equal(mutations[1].idempotencyKey, mutations[0].idempotencyKey);
    await act(async () => pendingResolve());
    await settle();
    assert.equal(document.querySelector('#practice-round').value, 'two');
    assert.equal(
      document.querySelectorAll('.study-row[data-progress="solved"]').length,
      0,
    );
    assert.match(document.body.textContent, /Round 1 · 12\/500/);
    assert.match(document.body.textContent, /Round 2 · 0\/500/);
    assert.equal(sessionStorage.getItem('cswork:practice:create-key'), null);
    await select(document.querySelector('#practice-round'), 'one');
    assert.equal(mutations[2].roundId, 'one');
    assert.match(document.body.textContent, /Solved in round 1/);
    assert.match(document.body.textContent, /12 \/ 500/);
    assert.equal(rounds.length, 2);
    pendingVerdict = 'queued';
    await act(async () => window.dispatchEvent(new Event('focus')));
    await settle();
    assert.match(
      document.querySelectorAll('.study-progress')[1].textContent,
      /Judging/,
    );
    pendingVerdict = 'accepted';
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });
    await settle();
    assert.equal(
      document.querySelectorAll('.study-progress')[1].textContent,
      'Solved',
    );
    const requestsAfterVerdict = requests.length;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3100));
    });
    assert.equal(
      requests.length,
      requestsAfterVerdict,
      'polling stops when the visible verdicts finish',
    );
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
