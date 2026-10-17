import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

test('progress page lists history, mistakes, reviews due today and the learner marks and notes', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/?view=progress',
  });
  for (const name of [
    'window',
    'document',
    'HTMLElement',
    'Element',
    'Node',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'localStorage',
    'sessionStorage',
    'navigator',
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { MyProgress } = await import('../components/my-progress.tsx');
  const day = 86400000;
  const now = Date.now();
  const history = [
    {
      problemId: 'oa-acme-1',
      attempts: 2,
      firstAt: now - day,
      lastAt: now - day,
      firstAcAt: null,
      failuresBeforeAc: 2,
      lastStatus: 'wrong_answer',
      languages: ['python'],
      acAt: [],
      stop: null,
      help: 'hint',
      solveSeconds: null,
    },
    {
      problemId: 'lc-1',
      attempts: 4,
      firstAt: now - 40 * day,
      lastAt: now - 40 * day,
      firstAcAt: now - 40 * day,
      failuresBeforeAc: 3,
      lastStatus: 'accepted',
      languages: ['cpp'],
      acAt: [now - 40 * day],
      stop: 'hash-counting',
      // The editorial before the first AC: back after a day first, on a five-step ladder.
      help: 'solution',
      solveSeconds: 1200,
    },
  ];
  const searches = [];
  const originalFetch = globalThis.fetch;
  const profile = { handle: 'me', visible: true, indexable: false, showContest: false, bio: '', featuredBadge: null };
  const featured = [];
  globalThis.fetch = async (url, init = {}) => {
    if (url.endsWith('/oj/history')) return Response.json({ items: history });
    // Two self-rated AI interviews: off by one, then spot on.
    if (url.endsWith('/oj/ai/interview-calibration'))
      return Response.json({
        calibration: { sessions: [{ gap: 1, bias: 1 }, { gap: 0, bias: 0 }], gap: 0.5, bias: 0.5 },
        trend: { communication: [4, 1, 4], star: [1, 3] },
      });
    // Every daily problem of February 2026, from the points ledger.
    if (url.endsWith('/oj/points/daily'))
      return Response.json({ days: Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`) });
    if (url.endsWith('/oj/profile') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      featured.push(body.featuredBadge);
      return Response.json({ profile: body });
    }
    if (url.endsWith('/oj/profile')) return Response.json({ profile, badges: [{ id: 'daily:2026-02' }] });
    if (url.endsWith('/oj/marks'))
      return Response.json({
        items: [
          { target: 'problem:lc-1', mark: 'star', createdAt: now },
          { target: 'problem:lc-2', mark: 'redo', createdAt: now },
          { target: 'content:interview_question/x', mark: 'star', createdAt: now },
        ],
      });
    if (url.endsWith('/oj/notes/tags'))
      return Response.json({ tags: [{ tag: 'off-by-one', count: 2 }], confidence: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 } });
    if (url.includes('/oj/notes?tag=')) {
      searches.push(url.split('?')[1]);
      return Response.json({
        items: [{ target: 'topic:hash-counting', updatedAt: now, snippet: '#off-by-one', problemId: null, title: null, confidence: 2 }],
        total: 1,
        nextCursor: null,
      });
    }
    if (url.endsWith('/oj/notes'))
      return Response.json({
        items: [{ target: 'problem:lc-1', updatedAt: now, snippet: 'One pass with a hash map', problemId: null, title: null }],
        total: 1,
        nextCursor: null,
      });
    if (url.includes('/oj/notes?q=')) {
      searches.push(decodeURIComponent(url.split('q=')[1]).replace(/\+/g, ' '));
      return Response.json({
        items: [
          { target: 'sub:s-9', updatedAt: now, snippet: '…WA on the EMPTY list…', problemId: 'lc-2', title: null },
          {
            target: 'content:interview_question/lru',
            updatedAt: now,
            snippet: 'empty cache evicts nothing',
            problemId: null,
            title: { title: 'Design an LRU cache', titleZh: '设计 LRU 缓存' },
          },
        ],
        total: 2,
        nextCursor: null,
      });
    }
    if (url.endsWith('/oj/library?collection=ling-selected-500'))
      return Response.json({
        collection: {
          sections: [
            { slug: 'array-foundations', solved: 1, total: 2 },
            // This round shows nothing solved, but lc-1 was accepted here before.
            { slug: 'hash-counting', solved: 0, total: 1 },
          ],
        },
      });
    throw new Error(`unexpected ${url}`);
  };
  const navigations = [];
  const boot = {
    person: { id: 'me' },
    problems: [
      { id: 'lc-1', title: '两数之和', titleEn: 'Two Sum', difficulty: '简单', tags: [] },
      { id: 'lc-2', title: '两数相加', titleEn: 'Add Two Numbers', difficulty: '中等', tags: [] },
      { id: 'oa-acme-1', title: 'Acme OA', difficulty: '困难', tags: [] },
    ],
    activity: [],
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const tab = (name) => document.querySelector(`#progress-tab-${name}`);
  // Visible titles; the star's screen-reader text is checked on its own.
  const titles = () =>
    [...document.querySelectorAll('.progress-row strong')].map((n) => {
      const copy = n.cloneNode(true);
      copy.querySelectorAll('.sr-only').forEach((x) => x.remove());
      return copy.textContent.trim();
    });
  try {
    await act(async () =>
      root.render(
        createElement(MyProgress, {
          boot,
          navigate: (view, extra) => navigations.push([view, extra]),
        }),
      ),
    );
    await settle();
    assert.equal(document.querySelector('h1').textContent, 'My progress');
    // Self-assessment calibration: the mean gap, which way it leans, and the trend.
    const calibration = document.getElementById('calibration-title').parentElement.textContent;
    assert.match(calibration, /Last 2 AI interviews, mean gap 0\.5 points · You overrate: 0\.5 above the interviewer/);
    assert.match(calibration, /Gap per interview, oldest first: 1\.0 → 0\.0/);
    // Each dimension's scores as a small line, in rubric order, with the latest score.
    const trend = [...document.querySelectorAll('.trend-list li')];
    assert.deepEqual(trend.map((li) => li.textContent), ['Communication4/4 3 interviews', 'Structure (STAR)3/4 2 interviews']);
    assert.equal(trend[0].querySelector('svg').getAttribute('aria-label'), 'Communication: 4 → 1 → 4');
    assert.equal(trend[0].querySelector('polyline').getAttribute('points'), '3,3 48,23 93,3');
    assert.deepEqual(
      [...document.querySelectorAll('[role="tab"] .progress-count')].map((n) => n.textContent),
      ['2', '2', '1', '1', '1', '1', '2'],
      'history, mistakes, due, starred (problems only), redo, notes, badges earned (a stop and a month)',
    );
    assert.deepEqual(titles(), ['Acme OA', '1. Two Sum']);
    assert.match(document.querySelectorAll('.progress-detail')[1].textContent, /Editorial or AI used · 20 min to solve/);
    // Solve quality: one solve, with help, after three failures; 20 minutes against Easy's 15.
    const quality = document.getElementById('solve-quality-title').parentElement.textContent;
    assert.match(quality, /Solved on your own 0% \(0 of 1\) · First-try AC 0%/);
    assert.match(quality, /Median first-solve time \(interview budget\): Easy 20 min \(15\), over budget/);
    assert.ok(!!document.querySelector('.progress-row .study-star'), 'starred rows show the star');
    assert.match(document.querySelectorAll('.progress-row strong')[1].textContent, /\(starred\)/);
    assert.match(document.querySelector('.progress-stop').textContent, /Hashing/);
    // Filters narrow the history in place.
    const select = document.querySelectorAll('.progress-filters select')[0];
    await act(async () => {
      select.value = 'oa';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.deepEqual(titles(), ['Acme OA']);
    // Arrow keys move between tabs.
    await act(async () =>
      tab('history').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      ),
    );
    assert.equal(tab('mistakes').getAttribute('aria-selected'), 'true');
    assert.ok(document.activeElement === tab('mistakes'));
    assert.deepEqual(titles(), ['Acme OA', '1. Two Sum']);
    // Beside the wrong book: solves made with help (an unsolved problem is not one yet).
    const view = document.querySelector('.progress-filters select');
    await act(async () => {
      view.value = 'assisted';
      view.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.deepEqual(titles(), ['1. Two Sum']);
    assert.match(document.querySelector('.progress-detail').textContent, /Editorial or AI used · Solved/);
    await act(async () => tab('review').click());
    assert.deepEqual(titles(), ['1. Two Sum']);
    assert.match(document.querySelector('.progress-detail').textContent, /Review 1 of 5 · Editorial or AI used · \d+ days overdue/);
    await act(async () => tab('starred').click());
    assert.deepEqual(titles(), ['1. Two Sum'], 'the Starred tab lists star marks');
    await act(async () => tab('redo').click());
    assert.deepEqual(titles(), ['2. Add Two Numbers']);
    assert.match(document.querySelector('.progress-detail').textContent, /Not submitted yet/);
    const link = document.querySelector('.progress-row');
    assert.equal(link.getAttribute('href'), '/?view=problem&problem=lc-2');
    await act(async () => link.click());
    assert.deepEqual(navigations, [['problem', { problem: 'lc-2' }]]);
    assert.equal(sessionStorage.length > 0, true, 'prev/next follows the tab list');
    await act(async () => tab('notes').click());
    assert.deepEqual(titles(), ['1. Two Sum']);
    assert.equal(document.querySelector('.progress-snippet').textContent, 'One pass with a hash map');
    // Search waits for typing to pause, then marks each word in the snippets.
    const search = document.querySelector('input[type="search"]');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    for (const value of ['emp', 'empty list']) {
      await act(async () => {
        setter.call(search, value);
        search.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    assert.deepEqual(searches, ['empty list'], 'debounced: one request');
    assert.deepEqual(titles(), ['2. Add Two Numbers', 'Design an LRU cache']);
    assert.deepEqual(
      [...document.querySelectorAll('.progress-snippet mark')].map((m) => m.textContent),
      ['EMPTY', 'list', 'empty'],
    );
    const [subRow, contentRow] = document.querySelectorAll('.progress-list .progress-row');
    assert.equal(subRow.getAttribute('href'), '/?view=problem&problem=lc-2&tab=history');
    assert.match(subRow.textContent, /Submission note/);
    await act(async () => subRow.click());
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'lc-2', tab: 'history' }]);
    assert.equal(contentRow.getAttribute('href'), '/?view=content&type=interview_question&slug=lru');
    await act(async () => contentRow.click());
    assert.deepEqual(navigations.at(-1), ['content', { type: 'interview_question', slug: 'lru' }]);
    // A #tag chip filters the notes; a stop's pattern notes link to its topic page.
    await act(async () => {
      setter.call(search, '');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const chips = [...document.querySelectorAll('.note-chips button')];
    assert.deepEqual(chips.map((b) => b.textContent), ['Confidence ≤2 ×1', '#off-by-one ×2']);
    await act(async () => chips[1].click());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    assert.equal(searches.at(-1), 'tag=off-by-one');
    assert.equal(chips[1].getAttribute('aria-pressed'), 'true');
    const topicRow = document.querySelector('.progress-list .progress-row');
    assert.equal(topicRow.getAttribute('href'), '/topics/hash-counting');
    assert.match(topicRow.textContent, /^Hashing.*Pattern notes · Note updated .* · Confidence 2/);
    // The badge wall: stop roundels in line order, milestones with their progress.
    await act(async () => tab('badges').click());
    const stops = [...document.querySelectorAll('.badge-stops li')];
    assert.equal(stops.length, 2);
    assert.deepEqual(stops.map((li) => li.hasAttribute('data-earned')), [false, true]);
    assert.match(stops[0].textContent, /1 of 2 solved/);
    assert.match(stops[1].textContent, /Hashing, cleared/);
    assert.match(document.querySelector('.badge-board-head p').textContent, /1 of 2 stops cleared/);
    const section = (id) => document.getElementById(id).parentElement;
    const medals = [...section('badge-milestone-title').querySelectorAll('.badge-medal')].map((m) => m.textContent);
    assert.deepEqual(medals.slice(0, 3), ['77-day streak1 / 7', '3030-day streak1 / 30', '100100-day streak1 / 100']);
    assert.equal(medals.length, 9, 'three streaks, two active-day counts, the perfect mock and three domain stars');
    // Line 500 counts the stops' solves: 2 of the 10 for its first star.
    assert.equal(medals[6], 'Algorithms stars2 / 10');
    assert.match(section('badge-company-title').querySelector('.badge-empty').textContent, /3\+ problems/);
    assert.match(section('badge-list-title').querySelector('.badge-empty').textContent, /Blind 75/);
    // The month badge, featurable because the public page would show it.
    const month = section('badge-daily-title').querySelector('.badge-medal');
    assert.match(month.textContent, /Daily problem every day, Feb 2026Unlocked/);
    const feature = month.querySelector('.badge-feature');
    assert.equal(feature.getAttribute('aria-pressed'), 'false');
    assert.equal(section('badge-milestone-title').querySelector('.badge-feature'), null, 'nothing unearned');
    await act(async () => feature.click());
    await settle();
    assert.deepEqual(featured, ['daily:2026-02']);
    assert.equal(month.querySelector('.badge-feature').getAttribute('aria-pressed'), 'true');
    await act(async () => month.querySelector('.badge-feature').click());
    await settle();
    assert.deepEqual(featured, ['daily:2026-02', null]);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
  }
});

test('solve quality flags over budget on the minutes it shows', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SolveQuality } = await import('../components/solve-quality.tsx');
  const solved = (problemId, solveSeconds) => ({
    problemId,
    attempts: 1,
    firstAt: 1,
    lastAt: 1,
    firstAcAt: 1,
    failuresBeforeAc: 0,
    lastStatus: 'accepted',
    languages: ['python'],
    acAt: [1],
    stop: null,
    help: 'none',
    solveSeconds,
  });
  const text = (history) =>
    renderToStaticMarkup(
      createElement(SolveQuality, { history, difficultyOf: () => '中等', english: true }),
    ).replace(/<[^>]+>/g, '');
  // A median of 1501s shows as 25 min against 25: not over. 1531s shows as 26: over.
  assert.match(text([solved('a', 1000), solved('b', 2002)]), /Medium 25 min \(25\)(?!, over budget)/);
  assert.match(text([solved('a', 1531)]), /Medium 26 min \(25\), over budget/);
  // Whiteboard and stress lines only once there is something to count.
  assert.doesNotMatch(text([solved('a', 600)]), /Whiteboard|Stress-tested/);
  const modes = [
    { ...solved('a', 600), whiteboard: 1, brute: true },
    { ...solved('b', 600), whiteboard: 0 },
    { ...solved('c', 600), brute: true },
  ];
  assert.match(text(modes), /Whiteboard first-try pass rate 50% \(1 of 2\) · Stress-tested before AC: 2/);
  assert.match(text([{ ...solved('a', 600), whiteboard: 1 }]), /Whiteboard first-try pass rate 100% \(1 of 1\)(?! ·)/);
});
