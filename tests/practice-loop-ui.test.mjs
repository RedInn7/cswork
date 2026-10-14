// The bank's daily ticket, topic frequency on the line, the calendar's daily star, and
// the badge unlock line the workspace shows under "Accepted".
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';

register(
  `data:text/javascript,${encodeURIComponent(
    `export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}`,
  )}`,
  import.meta.url,
);

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame ??= (fn) => setTimeout(fn, 0);
const { createRoot } = await import('react-dom/client');
const { StudyLibrary } = await import('../components/study-library.tsx');
const { AcceptedExtras, progressBadges } = await import('../components/achievements.tsx');
const { beijingDate } = await import('../lib/daily-problem.ts');

const DAY = 86400000;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)));
const section = (slug, total, solved, companies, reports) => ({ slug, title: slug, titleEn: slug, total, solved, companies, reports });
const page = {
  items: [
    {
      id: 'lc-1', number: 1, slug: 'two-sum', titleZh: '两数之和', titleEn: 'Two Sum', difficulty: 'Easy', topics: [],
      caseStatus: 'verified', caseCount: 1, judgeProblemId: 'lc-1', solved: false,
      selection: { order: 1, sectionSlug: 'hash-counting', sectionTitle: '哈希', stage: '基础', reason: '' },
    },
  ],
  total: 1, page: 1, pageSize: 30, topics: [], rounds: [], activeRoundId: null, currentRound: null,
  sequence: ['lc-1'], nextProblemId: 'lc-1',
  next: { judgeProblemId: 'lc-1', number: 1, titleZh: '两数之和', titleEn: 'Two Sum', difficulty: 'Easy', sectionSlug: 'hash-counting', stage: '基础' },
  collection: {
    id: 'ling-selected-500', title: 'x', total: 3, available: 3, ready: 3, solved: 0,
    sections: [section('array-foundations', 1, 0, 2, 3), section('hash-counting', 2, 0, 18, 64), section('linked-list', 0, 0, 0, 0)],
  },
};

async function renderBank(props) {
  const navigations = [];
  globalThis.fetch = async () => Response.json(page);
  const root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(createElement(StudyLibrary, { navigate: (...a) => navigations.push(a), availableProblemIds: ['lc-1'], ...props })),
  );
  await settle();
  return { root, navigations };
}

test('members get today’s problem next to the next stop, with its streak and a star on the calendar', async () => {
  const now = Date.now();
  const daily = {
    date: beijingDate(now), id: 'oa-amazon-7', kind: 'oa', title: '仓库调度', titleEn: 'Warehouse Dispatch',
    difficulty: '中等', company: { slug: 'amazon', name: 'Amazon' }, done: [now, now - DAY],
  };
  const { root, navigations } = await renderBank({
    signedIn: true, userId: 'me', daily,
    activity: [{ problem_id: 'oa-amazon-7', created_at: now }],
  });
  try {
    const ticket = document.querySelector('.route-daily');
    assert.ok(ticket !== null);
    assert.equal(ticket.hasAttribute('data-done'), true);
    assert.match(ticket.querySelector('strong').textContent, /Warehouse Dispatch/);
    assert.match(ticket.querySelector('.route-daily-meta').textContent, /Amazon OA/);
    assert.equal(ticket.querySelector('.route-daily-run').textContent, '2-day daily streak');
    const go = ticket.querySelector('.route-daily-go');
    assert.equal(go.getAttribute('href'), '/?view=problem&problem=oa-amazon-7');
    await act(async () => go.click());
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'oa-amazon-7' }]);
    assert.equal(document.querySelectorAll('.practice-calendar-grid [data-daily]').length >= 1, true);
    // Topic frequency: tooltips and aria labels, a heat dot per asked stop, the stop heading.
    const stops = [...document.querySelectorAll('.route-stop')];
    assert.match(stops[1].getAttribute('title'), /asked by 18 companies · in 64 reports/);
    assert.deepEqual(stops.map((s) => s.querySelector('.route-heat')?.getAttribute('data-heat') ?? ''), ['1', '3', '']);
    assert.equal(document.querySelector('.route-heading .route-asked').textContent, 'asked by 18 companies · in 64 reports');
    assert.ok(document.querySelector('.route-heat-key') !== null);
  } finally {
    await act(async () => root.unmount());
  }
});

test('guests open the public daily page', async () => {
  const daily = {
    date: beijingDate(Date.now()), id: 'lc-35', kind: 'lc', title: '搜索插入位置', titleEn: 'Search Insert Position',
    difficulty: '简单', stop: 'binary-search', done: [],
  };
  const { root } = await renderBank({ daily });
  try {
    const go = document.querySelector('.route-daily .route-daily-go');
    assert.equal(go.getAttribute('href'), '/daily');
    assert.equal(go.textContent, 'View');
    assert.match(document.querySelector('.route-daily-meta').textContent, /Line 500 · Binary Search/);
    assert.equal(document.querySelector('.route-daily-run') === null, true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('the Accepted dialog line names a stop this AC cleared, a streak milestone and the freezes left', async () => {
  const now = Date.now();
  // Six days in a row before today: today's AC makes seven.
  const activity = Array.from({ length: 6 }, (_, k) => ({ problem_id: `lc-${100 + k}`, created_at: now - (k + 1) * DAY }));
  globalThis.fetch = async () =>
    Response.json({
      items: [{ id: 'lc-35', judgeProblemId: 'lc-35', selection: { sectionSlug: 'binary-search' } }],
      collection: {
        solved: 5, total: 9,
        sections: [{ slug: 'binary-search', solved: 5, total: 5 }, { slug: 'linked-list', solved: 0, total: 4 }],
      },
    });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(AcceptedExtras, { problemId: 'lc-35', acceptedAt: now, activity, english: true })),
    );
    await settle();
    assert.equal(document.querySelector('.cs-accepted-unlock').textContent, 'Unlocked: Binary Search, 7-day streak');
    assert.match(document.querySelector('.cs-accepted-freeze').textContent, /2 streak freezes left this month/);
    // Accepted before: the stop was already counted, and a 1-day streak needs no freeze line.
    await act(async () =>
      root.render(
        createElement(AcceptedExtras, {
          problemId: 'lc-35', acceptedAt: now, english: false,
          activity: [{ problem_id: 'lc-35', created_at: now - 3 * DAY }],
        }),
      ),
    );
    await settle();
    assert.equal(document.querySelector('.cs-accepted-extras') === null, true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('no unlock for a stop a LeetCode import already cleared, or a streak milestone the best run already holds', async () => {
  const now = Date.now();
  // 30 days in a row two months ago, then six to yesterday: today makes seven again.
  const days = [...Array.from({ length: 30 }, (_, k) => 31 + k), ...Array.from({ length: 6 }, (_, k) => k + 1)];
  const activity = days.map((d) => ({ problem_id: `lc-${100 + d}`, created_at: now - d * DAY }));
  globalThis.fetch = async () =>
    Response.json({
      items: [{ id: 'lc-35', judgeProblemId: 'lc-35', importedSources: ['us'], selection: { sectionSlug: 'binary-search' } }],
      collection: { solved: 5, total: 5, sections: [{ slug: 'binary-search', solved: 5, total: 5 }] },
    });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(AcceptedExtras, { problemId: 'lc-35', acceptedAt: now, activity, english: true })),
    );
    await settle();
    assert.equal(document.querySelector('.cs-accepted-unlock') === null, true);
    assert.equal(document.querySelector('.cs-accepted-freeze') !== null, true);
  } finally {
    await act(async () => root.unmount());
  }
});

test('company badges fold aliased OA slugs into one employer with its library name', () => {
  const ids = ['barclay-1', 'barclay-2', 'barclays-1', 'barclays-2', 'sig-1', 'sig-2', 'sig-3', 'susquehanna-international-group-1'];
  const problems = ids.map((id) => ({ id: `oa-${id}`, title: id, difficulty: '中等', tags: [] }));
  const history = problems
    .filter((p) => p.id !== 'oa-susquehanna-international-group-1')
    .map((p) => ({ problemId: p.id, firstAcAt: 1, acAt: [1], stop: null }));
  const badges = progressBadges({
    sections: [], history, problems, now: Date.now(),
    companyNames: new Map([['susquehanna-international-group', 'SIG']]),
  }).filter((b) => b.group === 'company');
  assert.deepEqual(
    badges.map((b) => [b.id, b.en, b.earned, b.progress.join('/')]),
    [
      ['company:barclays', 'Barclays OA cleared', true, '4/4'],
      ['company:susquehanna-international-group', 'SIG OA cleared', false, '3/4'],
    ],
  );
});

test('a streak badge counts freezes bought with points, as the calendar does', () => {
  // October: free freezes bridge the 2nd and 4th, a freeze bought on the 9th the 8th.
  const day = (d) => new Date(2026, 9, d, 12).getTime();
  const history = [{ problemId: 'lc-1', firstAcAt: day(1), acAt: [1, 3, 5, 6, 7, 9, 10, 11].map(day), stop: null }];
  const week = (bought) =>
    progressBadges({ sections: [], history, problems: [], now: day(11), bought }).find((b) => b.id === 'streak:7').earned;
  assert.equal(week(undefined), false);
  assert.equal(week([day(9)]), true);
});
