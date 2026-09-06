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
  let pendingResolve;
  const mutations = [];
  const requests = [];
  const roundState = () => ({
    rounds: [...rounds],
    activeRoundId,
    currentRound: rounds.find((r) => r.id === activeRoundId),
  });
  const page = () => ({
    ...roundState(),
    items: [],
    total: 0,
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
        createElement(StudyLibrary, { navigate() {}, availableProblemIds: [] }),
      ),
    );
    await settle();
    assert.match(document.body.textContent, /灵神题单精选/);
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
    assert.match(document.body.textContent, /Round 1 · 12\/500/);
    assert.match(document.body.textContent, /Round 2 · 0\/500/);
    assert.equal(sessionStorage.getItem('cswork:practice:create-key'), null);
    await select(document.querySelector('#practice-round'), 'one');
    assert.equal(mutations[2].roundId, 'one');
    assert.match(document.body.textContent, /Solved in round 1/);
    assert.match(document.body.textContent, /12 \/ 500/);
    assert.equal(rounds.length, 2);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});
