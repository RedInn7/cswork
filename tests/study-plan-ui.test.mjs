import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// The real bank page with a planned sprint: first-visit card, the form, today's
// target from the plan, the week view and the .ics download.
test('the sprint plan card saves a goal that drives today’s trip', async () => {
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
  ])
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: dom.window[name],
    });
  dom.window.localStorage.setItem('cswork:locale', 'en');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.setItem('cswork:practice:daily-target', '5');
  const { createRoot } = await import('react-dom/client');
  const { StudyLibrary } = await import('../components/study-library.tsx');
  const { addDays, localDay } = await import('../lib/study-plan.ts');
  const today = localDay();
  const requests = [];
  const page = {
    rounds: [{ id: 'one', number: 1, createdAt: 1, solved: 0 }],
    activeRoundId: 'one',
    currentRound: { id: 'one', number: 1, createdAt: 1 },
    items: [],
    total: 0,
    page: 1,
    pageSize: 30,
    topics: [],
    planTodo: Array.from({ length: 40 }, (_, i) => [`lc-${i + 1}`, '中等', i < 20 ? 0 : 1]),
    sequence: Array.from({ length: 40 }, (_, i) => `lc-${i + 1}`),
    nextProblemId: 'lc-1',
    next: {
      judgeProblemId: 'lc-1',
      number: 1,
      titleZh: '两数之和',
      titleEn: 'Two Sum',
      difficulty: '简单',
      sectionSlug: 'array-foundations',
      stage: '基础',
    },
    collection: {
      id: 'ling-selected-500',
      total: 40,
      ready: 40,
      solved: 0,
      sections: [
        { slug: 'array-foundations', title: '数组', titleEn: 'Arrays', total: 20, solved: 0 },
        { slug: 'hash-counting', title: '哈希', titleEn: 'Hashing', total: 20, solved: 0 },
      ],
    },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    // The daily problem month beside the calendar reads the points ledger once.
    if (url.endsWith('oj/points/daily')) return Response.json({ days: [] });
    // The streak reads the study goal's rest and frozen days (components/daily-goal.tsx); none here.
    if (url.includes('oj/study-goal?')) return new Response(null, { status: 401 });
    requests.push(url);
    if (url.includes('mock-oa/presets'))
      return Response.json({
        companies: [{ slug: 'amazon', name: 'Amazon', aliases: ['amazon'], minutes: 90 }],
      });
    if (url.includes('oa-library'))
      return Response.json({
        items: [
          { id: 'oa-amazon-1', difficulty: '中等' },
          { id: 'oa-amazon-2', difficulty: '中等', progress: 'solved' },
        ],
        total: 2,
      });
    return Response.json(page);
  };
  const downloads = [];
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  URL.createObjectURL = (blob) => {
    downloads.push(blob);
    return 'blob:plan';
  };
  dom.window.HTMLAnchorElement.prototype.click = function () {
    downloads.push(this.download);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () =>
    act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  const button = (text) =>
    [...document.querySelectorAll('button')].find((node) => node.textContent === text);
  const type = async (node, value) => {
    const proto = Object.getPrototypeOf(node);
    await act(async () => {
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
      node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  };
  const field = (label) =>
    [...document.querySelectorAll('.route-plan-fields label')].find(
      (node) => node.textContent.startsWith(label),
    ).control;
  const opened = [];
  try {
    await act(async () =>
      root.render(
        createElement(StudyLibrary, {
          navigate: (view, params) => opened.push(params?.problem),
          availableProblemIds: [],
          signedIn: true,
          userId: 'u1',
        }),
      ),
    );
    await settle();
    // First visit: the card, and the old "5 a day" still sets today's target.
    assert.match(document.body.textContent, /When is your OA\?/);
    assert.equal(document.querySelector('.route-today-count').textContent, '0 / 5');
    assert.equal(document.querySelector('.route-target select').value, '5');
    // The bank also reads the learner's own lists once, for its list filter; the plan reads the account's copy.
    assert.ok(
      requests.every((url) => url.includes('oj/library?') || url.endsWith('oj/lists') || url.endsWith('notes?target=pref%3Aplan')),
      'no other plan requests yet',
    );

    await act(async () => button('Plan my sprint').click());
    await settle();
    const date = field('OA date');
    assert.ok(document.activeElement === date, 'the date field takes focus');
    assert.ok(
      !document.querySelector('.route-plan-fields label small'),
      'hints describe the fields instead of naming them',
    );
    assert.equal(date.min, today);
    assert.equal(date.max, addDays(today, 365));
    assert.ok(requests.some((url) => url.includes('mock-oa/presets')));
    // Out of range: an alert, nothing saved.
    await type(date, addDays(today, 400));
    await act(async () => button('Save plan').click());
    assert.match(document.querySelector('.route-plan [role="alert"]').textContent, /between today/);
    assert.equal(localStorage.getItem('cswork:plan:v1:u1'), null);

    await type(date, addDays(today, 37));
    await type(field('Target company'), 'amazon');
    await type(field('Hours a week'), '14');
    await type(field('LeetCode problems solved'), '40');
    assert.equal(field('Start at stop').value, '1', '40 solved suggests the second stop');
    await type(field('LeetCode problems solved'), '0');
    assert.equal(field('Start at stop').value, '0');
    await act(async () => button('Save plan').click());
    await settle();

    const saved = JSON.parse(localStorage.getItem('cswork:plan:v1:u1'));
    assert.equal(saved.status, 'planned');
    assert.equal(saved.oaDate, addDays(today, 37));
    assert.equal(saved.company.slug, 'amazon');
    assert.equal(saved.weeklyHours, 14);
    assert.equal(saved.dailyTarget, 5, 'the old target moved into the plan');
    assert.ok(
      requests.some((url) => /oa-library\?company=amazon&ready=1&page=1/.test(url)),
      'the target company’s OA problems are fetched',
    );
    // 40 line + 1 unsolved OA over 30 days → 2 a day (the 14h budget allows 4).
    const heading = document.getElementById('route-plan-title');
    assert.ok(document.activeElement === heading, 'focus lands on the summary');
    assert.match(heading.textContent, /^37 days to your OA · This week: \d+ planned$/);
    assert.match(document.querySelector('.route-plan-text').textContent, /2 a day · 14 h a week · Target: Amazon/);
    assert.equal(document.querySelector('.route-today-count').textContent, '0 / 2');
    assert.ok(!document.querySelector('.route-target'), 'the plan replaces the picker');
    assert.ok(!document.querySelector('.route-pace'));
    assert.deepEqual(
      JSON.parse(localStorage.getItem('cswork:practice:today-target')),
      { date: today, n: 2 },
      'the AC dialog reads today’s target',
    );

    const weeks = [...document.querySelectorAll('.route-plan-weeks li')];
    assert.ok(weeks.length >= 6);
    assert.match(weeks[0].textContent, /^This week/);
    assert.ok(weeks.some((li) => li.hasAttribute('data-sprint')));
    assert.equal(document.querySelectorAll('.route-plan-weeks a[href="/mock-oa/amazon"]').length, 2);
    assert.ok(weeks.at(-1).hasAttribute('data-oa'));

    await act(async () => button('Add to calendar (.ics)').click());
    assert.equal(downloads[1], 'cswork-sprint-plan.ics');
    const ics = await downloads[0].text();
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.match(ics, /URL:https:\/\/cswork\.test\/mock-oa\/amazon\r\n/);
    assert.match(ics, /SUMMARY:CSWork daily trip: 2 problems\r\n/);

    // Editing again starts from the saved values; cancel keeps them.
    await act(async () => button('Edit plan').click());
    assert.equal(field('OA date').value, addDays(today, 37));
    assert.equal(field('Hours a week').value, '14');
    await act(async () => button('Cancel').click());
    assert.ok(document.activeElement === document.getElementById('route-plan-title'));

    // A later start stop: the trip starts there, not at the line's first problem.
    assert.ok(!!document.querySelector('.route-ticket'));
    await act(async () => button('Edit plan').click());
    await type(field('Start at stop'), '1');
    await act(async () => button('Save plan').click());
    await settle();
    assert.equal(document.querySelector('.route-name').textContent, 'Hashing');
    assert.ok(!document.querySelector('.route-ticket'), 'the ticket only knows the line’s first');
    await act(async () => button('Start next problem').click());
    assert.deepEqual(opened, ['lc-21']);
    assert.equal(JSON.parse(sessionStorage.getItem('cswork:problem-sequence'))[0], 'lc-21');

    // OA day: no practice target, no punches, no celebration.
    await act(async () => button('Edit plan').click());
    await type(field('OA date'), today);
    await act(async () => button('Save plan').click());
    await settle();
    assert.equal(document.getElementById('route-plan-title').textContent, 'Your OA is today. Good luck!');
    assert.equal(document.querySelector('.route-today-rest').textContent, 'OA day, no practice planned');
    assert.equal(document.querySelectorAll('.route-punch').length, 0);
    assert.ok(!document.querySelector('[data-celebrate]'));
    assert.match(document.querySelector('.route-nudge').textContent, /No practice planned today/);
    assert.equal(JSON.parse(localStorage.getItem('cswork:practice:today-target')).n, 0);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    Object.defineProperty(URL, 'createObjectURL', originalCreate);
    dom.window.close();
  }
});

test('skipping the card leaves a way back to it', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/',
  });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  dom.window.localStorage.setItem('cswork:locale', 'en');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { StudyLibrary } = await import('../components/study-library.tsx');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      rounds: [],
      activeRoundId: null,
      currentRound: null,
      items: [],
      total: 0,
      page: 1,
      pageSize: 30,
      topics: [],
      planTodo: [['lc-1', '简单', 0]],
      collection: {
        id: 'ling-selected-500',
        total: 1,
        ready: 1,
        solved: 0,
        sections: [{ slug: 'array-foundations', title: '数组', titleEn: 'Arrays', total: 1, solved: 0 }],
      },
    });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () =>
      root.render(createElement(StudyLibrary, { navigate: () => {}, availableProblemIds: [] })),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    // Guests get the card too; their plan lives under the guest key.
    const skip = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Skip for now');
    await act(async () => skip.click());
    assert.equal(JSON.parse(localStorage.getItem('cswork:plan:v1:guest')).status, 'skipped');
    assert.doesNotMatch(document.body.textContent, /When is your OA\?/);
    const entry = document.querySelector('.route-plan-entry');
    assert.ok(document.activeElement === entry, 'focus moves to the way back');
    assert.equal(entry.textContent, 'Plan a sprint to your OA');
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test('a plan from a classic list, for some weeks, difficulties and topics, and regenerated', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  dom.window.localStorage.setItem('cswork:locale', 'en');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { StudyLibrary } = await import('../components/study-library.tsx');
  const item = (n, difficulty, stop, extra = {}) => ({
    number: n,
    judgeProblemId: `lc-${n}`,
    difficulty,
    solved: false,
    stop: stop ? { slug: stop, code: '01', nameZh: '', nameEn: '' } : null,
    ...extra,
  });
  const pool = {
    collection: { id: 'blind-75', total: 6, ready: 5, solved: 1 },
    groups: [
      {
        items: [
          item(1, 'Easy', 'hash-counting'),
          item(2, 'Hard', 'array-foundations'),
          item(3, 'Medium', null),
          item(4, 'Easy', null, { judgeProblemId: null }),
          item(5, 'Easy', 'hash-counting', { solved: true }),
        ],
      },
      { items: [item(1, 'Easy', 'hash-counting')] },
    ],
    sequence: ['lc-1', 'lc-2', 'lc-3', 'lc-5'],
  };
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    requests.push(url);
    if (url.includes('collection=blind-75')) return Response.json(pool);
    if (url.includes('mock-oa/presets')) return Response.json({ companies: [] });
    return Response.json({
      rounds: [],
      activeRoundId: null,
      currentRound: null,
      items: [],
      total: 0,
      page: 1,
      pageSize: 30,
      topics: [],
      planTodo: [['lc-1', '简单', 1, 0, null]],
      sequence: ['lc-1'],
      collection: {
        id: 'ling-selected-500',
        total: 1,
        ready: 1,
        solved: 0,
        sections: [{ slug: 'array-foundations', title: '数组', titleEn: 'Arrays', total: 1, solved: 0 }],
      },
    });
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
  const button = (text) => [...document.querySelectorAll('button')].find((node) => node.textContent === text);
  const label = (text) =>
    [...document.querySelectorAll('.route-plan-fields label')].find((node) => node.textContent.startsWith(text));
  const set = async (node, value) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value').set.call(node, value);
      node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
  };
  const click = (node) => act(async () => node.click());
  const saved = () => JSON.parse(localStorage.getItem('cswork:plan:v1:u1'));
  try {
    await act(async () =>
      root.render(
        createElement(StudyLibrary, { navigate: () => {}, availableProblemIds: [], signedIn: true, userId: 'u1' }),
      ),
    );
    await settle();
    await click(button('Plan my sprint'));
    await settle();
    // No OA date: the weeks slider sets the length.
    const weeks = document.getElementById('route-plan-weeks');
    assert.equal(weeks.type, 'range');
    assert.equal(weeks.value, '4');
    await set(weeks, '2');
    assert.match(document.getElementById('route-plan-weeks-hint').textContent, /^2 weeks/);
    await set(label('Problem pool').control, 'blind-75');
    assert.ok(!label('Start at stop'), 'a classic list has no start stop');
    await click(label('Hard').control);
    await click(button('Save plan'));
    await settle();
    assert.deepEqual(
      (({ pool, weeks, difficulties, topics, shuffle }) => ({ pool, weeks, difficulties, topics, shuffle }))(saved()),
      { pool: 'blind-75', weeks: 2, difficulties: ['easy', 'medium'], topics: [], shuffle: 0 },
    );
    assert.ok(requests.some((url) => url.endsWith('/api/oj/library?collection=blind-75')));
    // Easy lc-1 (listed twice) and medium lc-3; not the hard one, the external or the solved one.
    const text = document.querySelector('.route-plan-text').textContent;
    assert.match(text, /3 a day · 7 h a week · Pool: Blind 75/);
    const group = document.querySelector('.route-plan-view select');
    await set(group, 'topic');
    const groups = [...document.querySelectorAll('.route-plan-weeks ol[data-group] .route-plan-week')];
    assert.equal(groups.length, 2, 'one stop and the list problems off the line');
    assert.equal(groups[1].firstChild.textContent, 'Other problems');

    // Regenerate: a new mix of the same unsolved problems.
    await click(button('Regenerate'));
    assert.equal(saved().shuffle, 1);

    // No topic at all is refused; a topic the list does not reach leaves an empty plan that says why.
    await click(button('Edit plan'));
    await click(button('Clear all'));
    await click(button('Save plan'));
    assert.match(document.querySelector('.route-plan [role="alert"]').textContent, /at least one topic/);
    await click(label('05 ').control);
    await click(button('Save plan'));
    await settle();
    assert.deepEqual(saved().topics, ['prefix-intervals']);
    assert.match(document.querySelector('.route-plan-text').textContent, /^Nothing left under your filters/);
    assert.match(document.querySelector('.route-plan-note').textContent, /Widen the difficulty or topics/);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

// A bank page at `path` with a 40-problem line (`stored` already in this browser); `routes` answers the plan's
// own requests, the rest get the page.
async function bank(routes, props, stored = {}, path = '/') {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: `https://cswork.test${path}` });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
  dom.window.localStorage.setItem('cswork:locale', 'en');
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { StudyLibrary } = await import('../components/study-library.tsx');
  const page = {
    rounds: [],
    activeRoundId: null,
    currentRound: null,
    items: [],
    total: 0,
    page: 1,
    pageSize: 30,
    topics: [],
    planTodo: Array.from({ length: 40 }, (_, i) => [`lc-${i + 1}`, '中等', 0]),
    sequence: Array.from({ length: 40 }, (_, i) => `lc-${i + 1}`),
    collection: {
      id: 'ling-selected-500',
      total: 40,
      ready: 40,
      solved: 0,
      sections: [{ slug: 'array-foundations', title: '数组', titleEn: 'Arrays', total: 40, solved: 0 }],
    },
  };
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('oj/study-goal?')) return new Response(null, { status: 401 });
    requests.push([init.method ?? 'GET', url, init.body]);
    for (const [part, answer] of Object.entries(routes)) if (url.includes(part)) return answer(init);
    return Response.json(page);
  };
  const root = createRoot(document.getElementById('root'));
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 10)));
  await act(async () => root.render(createElement(StudyLibrary, { navigate: () => {}, availableProblemIds: [], ...props })));
  await settle();
  return {
    requests,
    settle,
    button: (text) => [...document.querySelectorAll('button')].find((node) => node.textContent === text),
    field: (text) =>
      [...document.querySelectorAll('.route-plan-fields label')].find((node) => node.textContent.startsWith(text))?.control,
    async close() {
      await act(async () => root.unmount());
      globalThis.fetch = originalFetch;
      dom.window.close();
    },
  };
}

test('the plan follows the account across devices and sprints to the tracker’s dates', async () => {
  const { addDays, localDay } = await import('../lib/study-plan.ts');
  const today = localDay();
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 5);
  deadline.setHours(12, 0, 0, 0);
  const remote = { status: 'planned', oaDate: addDays(today, 37), weeklyHours: 14, updatedAt: 100 };
  const card = {
    id: 'c1',
    company: 'Acme',
    companySlug: 'acme',
    stage: 'oa',
    oaDeadline: deadline.getTime(),
    interviewAt: null,
    nextAt: null,
    offerDeadline: null,
    links: { oa: null, mock: null },
  };
  const ui = await bank(
    {
      'notes?target=pref%3Aplan': (init) =>
        Response.json(init.method === 'PUT' ? {} : { target: 'pref:plan', body: JSON.stringify(remote), updatedAt: 100 }),
      'oj/applications': () => Response.json({ items: [card], max: 300 }),
    },
    { signedIn: true, userId: 'u1' },
  );
  try {
    // Another device's plan: this browser had none, so it takes the account's and keeps a copy.
    assert.match(document.getElementById('route-plan-title').textContent, /^37 days to your OA/);
    assert.equal(JSON.parse(localStorage.getItem('cswork:plan:v1:u1')).oaDate, addDays(today, 37));
    assert.ok(!ui.requests.some(([method]) => method === 'PUT'), 'nothing to upload');
    // The tracker's OA in 5 days: a sprint for Acme, linked to its reported problems (no mock OA preset).
    assert.ok(ui.requests.some(([, url]) => url.endsWith('/api/oj/applications')));
    assert.match(document.querySelector('.route-plan-text').textContent, /1 tracker date/);
    const tag = [...document.querySelectorAll('.route-plan-weeks .route-plan-tag')].find((node) => node.textContent === 'Sprint Acme');
    assert.ok(tag, 'the week view shows the sprint');
    assert.equal(tag.getAttribute('href'), '/?view=problems&company=acme&sort=frequency');
    assert.ok([...document.querySelectorAll('.route-plan-weeks [data-oa]')].some((node) => node.textContent === `Acme OA ${+addDays(today, 5).slice(5, 7)}/${+addDays(today, 5).slice(8, 10)}`));

    // The form opens on the account's date; saving goes up to the account.
    await act(async () => ui.button('Edit plan').click());
    assert.equal(ui.field('OA date').value, addDays(today, 37));
    const tracker = ui.field('Use my application tracker');
    assert.equal(tracker.checked, true);
    await act(async () => tracker.click());
    await act(async () => ui.button('Save plan').click());
    await ui.settle();
    const put = ui.requests.find(([method]) => method === 'PUT');
    assert.ok(put[1].endsWith('/api/oj/notes?target=pref%3Aplan'));
    const sent = JSON.parse(JSON.parse(put[2]).body);
    assert.equal(sent.oaDate, addDays(today, 37));
    assert.equal(sent.tracker, false);
    assert.ok(sent.updatedAt > 100, 'stamped at save time');
    assert.ok(![...document.querySelectorAll('.route-plan-weeks .route-plan-tag')].some((node) => node.textContent === 'Sprint Acme'));
  } finally {
    await ui.close();
  }
});

test('a failed account read changes nothing, and a handoff form takes the account copy that lands late', async () => {
  const { addDays, localDay } = await import('../lib/study-plan.ts');
  const today = localDay();
  // A 500 (or a 429) is not an empty account: this browser's older plan must not go over the account's.
  const local = JSON.stringify({ status: 'planned', oaDate: addDays(today, 20), weeklyHours: 14, updatedAt: 50 });
  const failed = await bank(
    { 'notes?target=pref%3Aplan': () => new Response(null, { status: 500 }), 'oj/applications': () => Response.json({ items: [] }) },
    { signedIn: true, userId: 'u1' },
    { 'cswork:plan:v1:u1': local },
  );
  try {
    assert.ok(failed.requests.some(([method, url]) => method === 'GET' && url.includes('pref%3Aplan')));
    assert.ok(!failed.requests.some(([method]) => method === 'PUT'), 'no upload after a failed read');
    assert.match(document.getElementById('route-plan-title').textContent, /^20 days to your OA/);
  } finally {
    await failed.close();
  }
  // A new device opened from /career/jd's gaps: the form is open before the account's plan arrives.
  const remote = { status: 'planned', oaDate: addDays(today, 50), weeklyHours: 14, updatedAt: 100 };
  let release;
  const arrived = new Promise((resolve) => (release = resolve));
  const late = await bank(
    {
      'notes?target=pref%3Aplan': (init) =>
        init.method === 'PUT'
          ? Response.json({})
          : arrived.then(() => Response.json({ target: 'pref:plan', body: JSON.stringify(remote) })),
      'oj/applications': () => Response.json({ items: [] }),
    },
    { signedIn: true, userId: 'u1' },
    {},
    '/?view=problems&planTopics=array-foundations',
  );
  try {
    assert.notEqual(late.field('OA date').value, remote.oaDate, 'the form opens on this browser’s default goal');
    release();
    await late.settle();
    assert.equal(late.field('OA date').value, remote.oaDate, 'and starts over from the account’s');
    await act(async () => late.button('Save plan').click());
    await late.settle();
    const sent = JSON.parse(JSON.parse(late.requests.find(([method]) => method === 'PUT')[2]).body);
    assert.equal(sent.oaDate, remote.oaDate);
    assert.deepEqual(sent.topics, ['array-foundations'], 'the handed topics stay');
  } finally {
    await late.close();
  }
});

test('guests never ask for the account copy or the tracker, and a running mock OA keeps OA problems out', async () => {
  const { addDays, localDay } = await import('../lib/study-plan.ts');
  const today = localDay();
  const amazon = { slug: 'amazon', name: 'Amazon', aliases: ['amazon'], minutes: 90 };
  const planned = JSON.stringify({ status: 'planned', oaDate: addDays(today, 37), company: amazon });
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 10);
  deadline.setHours(12, 0, 0, 0);
  const routes = {
    'mock-oa/presets': () => Response.json({ companies: [amazon] }),
    'oa-library': () => Response.json({ items: [{ id: 'oa-amazon-1', difficulty: '中等' }], total: 1 }),
    'notes?target=pref%3Aplan': () => Response.json({ target: 'pref:plan', body: '', updatedAt: null }),
    'oj/applications': () =>
      Response.json({
        items: [
          {
            id: 'c2',
            company: 'Amazon',
            companySlug: 'amazon',
            stage: 'oa',
            oaDeadline: deadline.getTime(),
            interviewAt: null,
            nextAt: null,
            offerDeadline: null,
            links: { oa: '/oa/amazon', mock: '/mock-oa/amazon' },
          },
        ],
      }),
  };
  const guest = await bank(routes, {}, { 'cswork:plan:v1:guest': planned, 'cswork:plan:view': JSON.stringify({ by: 'topic', order: 'plan' }) });
  try {
    assert.ok(guest.requests.some(([, url]) => url.includes('oa-library?company=amazon')), 'a guest plan still has its company');
    assert.ok(
      [...document.querySelectorAll('ol[data-group="topic"] .route-plan-week')].some((node) => node.firstChild.textContent === 'Amazon OA'),
      'the target company’s OA problems are labelled with its name',
    );
    await act(async () => guest.button('Edit plan').click());
    assert.equal(guest.field('Use my application tracker'), undefined, 'no tracker option without an account');
    await act(async () => guest.button('Save plan').click());
    await guest.settle();
    assert.ok(!guest.requests.some(([method, url]) => method === 'PUT' || url.includes('pref%3Aplan') || url.includes('oj/applications')));
  } finally {
    await guest.close();
  }
  // Signed in while a mock OA runs in this browser: no OA problems (their progress shows its verdicts).
  const sealed = await bank(routes, { signedIn: true, userId: 'u1' }, {
    'cswork:plan:v1:u1': planned,
    'cswork:mock:v1:u1': JSON.stringify({
      active: { id: 'm1', ids: ['oa-amazon-1'], slots: ['medium'], minutes: 90, createdAt: Date.now() },
      history: [],
    }),
  });
  try {
    assert.ok(sealed.requests.some(([, url]) => url.endsWith('/api/oj/applications')));
    assert.ok(!sealed.requests.some(([, url]) => url.includes('oa-library')));
    // The account had no copy yet: this browser's plan goes up.
    assert.ok(sealed.requests.some(([method, url]) => method === 'PUT' && url.endsWith('notes?target=pref%3Aplan')));
    const tag = [...document.querySelectorAll('.route-plan-weeks .route-plan-tag')].find((node) => node.textContent === 'Sprint Amazon');
    assert.equal(tag?.tagName, 'SPAN', 'a sprint with a mock OA preset');
  } finally {
    await sealed.close();
  }
});
