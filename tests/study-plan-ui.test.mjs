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
    [...document.querySelectorAll('.route-plan-fields label')]
      .find((node) => node.textContent.startsWith(label))
      .querySelector('input, select');
  try {
    await act(async () =>
      root.render(
        createElement(StudyLibrary, {
          navigate: () => {},
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
    assert.ok(requests.every((url) => url.includes('oj/library?')), 'no plan requests yet');

    await act(async () => button('Plan my sprint').click());
    await settle();
    const date = field('OA date');
    assert.ok(document.activeElement === date, 'the date field takes focus');
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
    assert.equal(document.querySelector('.route-target'), null, 'the plan replaces the picker');
    assert.equal(document.querySelector('.route-pace'), null);

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
