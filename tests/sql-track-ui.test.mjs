import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { register } from 'node:module';

register(
  `data:text/javascript,${encodeURIComponent("export async function load(url, context, next) { if (url.endsWith('.css')) return { format: 'module', source: 'export default {}', shortCircuit: true }; return next(url, context); }")}`,
  import.meta.url,
);

// The bank's SQL track: topic groups of published problems, progress and the next problem.
test('the SQL track lists published problems by topic and opens them', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { AlgorithmLibrary } = await import('../components/algorithm-library.tsx');
  const navigations = [];
  let authPrompts = 0;
  window.addEventListener('cswork:auth-required', () => authPrompts++);
  const root = createRoot(document.getElementById('root'));
  const render = (signedIn, availableProblemIds) =>
    act(async () => {
      root.render(
        createElement(AlgorithmLibrary, {
          key: `${signedIn}:${availableProblemIds.length}`,
          navigate: (...args) => navigations.push(args),
          availableProblemIds,
          collection: 'sql',
          // sql-04 is solved; lc-1 belongs to another list.
          activity: [{ problem_id: 'sql-04', created_at: 1 }, { problem_id: 'lc-1', created_at: 1 }],
          signedIn,
        }),
      );
    });
  const click = (node) =>
    act(async () => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  const published = ['sql-01', 'sql-04', 'sql-05', 'sql-16', 'lc-1'];
  try {
    // Nothing published yet: a plain notice, no rows.
    await render(true, ['lc-1']);
    assert.equal(document.querySelectorAll('a.study-row').length, 0);
    assert.ok(document.body.textContent.includes('being published'));

    // Guests see the published rows; opening one asks them to sign in.
    await render(false, published);
    const pressed = [...document.querySelectorAll('.algorithm-library-switch button')].find(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    assert.ok(pressed?.textContent.includes('SQL track'));
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('.classic-board h1').textContent.includes('SQL Practice Track'));
    const headings = [...document.querySelectorAll('.classic-group h2')].map((h) => h.textContent.replace(/\d.*$/, ''));
    assert.deepEqual(headings, ['Filtering & NULL', 'Joins', 'Window functions']);
    const rows = [...document.querySelectorAll('a.study-row')];
    assert.equal(rows.length, 4);
    assert.equal(rows[0].getAttribute('href'), '/?view=problem&problem=sql-01');
    assert.ok(rows[0].textContent.includes('1. Employees Without a Valid Manager'));
    assert.ok(rows[3].textContent.includes('Hard'));
    assert.ok(!document.querySelector('progress'), 'guests have no progress bar');
    assert.ok(!document.querySelector('[data-progress="solved"]'), 'guests have no solved marks');
    await click(rows[1]);
    assert.equal(authPrompts, 1);
    assert.equal(navigations.length, 0);

    // Members get progress, the solved mark and the next unsolved problem.
    await render(true, published);
    const bar = document.querySelector('progress');
    assert.equal(bar?.getAttribute('max'), '4');
    assert.equal(bar?.getAttribute('value'), '1');
    assert.equal(document.querySelectorAll('[data-progress="solved"]').length, 1);
    assert.ok(document.querySelector('a.study-row[data-next]')?.getAttribute('href').endsWith('sql-01'));
    const start = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Start next problem');
    assert.ok(!!start);
    await click(start);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'sql-01' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-sequence'), '["sql-01","sql-04","sql-05","sql-16"]');
    assert.equal(sessionStorage.getItem('cswork:problem-library'), 'sql');
    await click(document.querySelectorAll('a.study-row')[2]);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'sql-05' }]);

    // The other bank sections are one click away.
    const ling = [...document.querySelectorAll('.algorithm-library-switch button')][0];
    await click(ling);
    assert.deepEqual(navigations.at(-1), ['problems']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

// Once the pd- versions are listed, a SQL / Pandas switch picks which version the rows open.
test('the SQL track switches to the pandas versions once they are listed', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/' });
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SqlTrack } = await import('../components/sql-track.tsx');
  const navigations = [];
  const root = createRoot(document.getElementById('root'));
  const render = (availableProblemIds, key) =>
    act(async () => {
      root.render(
        createElement(SqlTrack, {
          key,
          navigate: (...args) => navigations.push(args),
          availableProblemIds,
          activity: [{ problem_id: 'pd-01' }, { problem_id: 'sql-04' }],
          signedIn: true,
        }),
      );
    });
  const click = (node) =>
    act(async () => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  const switchButtons = () => [...document.querySelectorAll('fieldset.classic-site button')];
  const hrefs = () => [...document.querySelectorAll('a.study-row')].map((a) => a.getAttribute('href').split('=').at(-1));
  try {
    // The judge has no pandas yet: no pd- problems listed, no switch.
    await render(['sql-01', 'sql-04'], 'sql-only');
    assert.equal(switchButtons().length, 0);
    assert.deepEqual(hrefs(), ['sql-01', 'sql-04']);

    await render(['sql-01', 'sql-04', 'pd-01', 'pd-04', 'pd-05', 'pd-101'], 'both');
    assert.deepEqual(switchButtons().map((b) => [b.textContent, b.getAttribute('aria-pressed')]), [
      ['SQL', 'true'],
      ['Pandas', 'false'],
    ]);
    assert.equal(document.querySelector('fieldset.classic-site legend').textContent, 'Practice language');
    await click(switchButtons()[1]);
    assert.equal(switchButtons()[1].getAttribute('aria-pressed'), 'true');
    assert.equal(localStorage.getItem('cswork:sql-track-language'), 'pandas');
    assert.ok(document.querySelector('.classic-kicker').textContent.includes('pandas edition'));
    // The rows open the pandas versions; their solves are their own. Pandas-only problems join as their own groups.
    assert.deepEqual(hrefs(), ['pd-01', 'pd-04', 'pd-05', 'pd-101']);
    assert.equal([...document.querySelectorAll('.classic-group h2')].at(-1).textContent.replace(/\d.*$/, ''), 'Reshaping & pivots');
    assert.ok(document.querySelectorAll('a.study-row')[3].textContent.includes('Quarterly Sales, Wide to Long'));
    assert.equal(document.querySelector('progress')?.getAttribute('value'), '1');
    assert.ok(document.querySelector('a.study-row[data-next]')?.getAttribute('href').endsWith('pd-04'));
    assert.ok(document.querySelectorAll('a.study-row')[1].textContent.includes('4.'));
    await click(document.querySelectorAll('a.study-row')[2]);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'pd-05' }]);
    assert.equal(sessionStorage.getItem('cswork:problem-sequence'), '["pd-01","pd-04","pd-05","pd-101"]');
    await click(document.querySelectorAll('a.study-row')[3]);
    assert.deepEqual(navigations.at(-1), ['problem', { problem: 'pd-101' }]);

    // The choice is remembered for the next visit.
    await render(['sql-01', 'sql-04', 'pd-01', 'pd-04', 'pd-05', 'pd-101'], 'again');
    assert.deepEqual(hrefs(), ['pd-01', 'pd-04', 'pd-05', 'pd-101']);
    // SQL mode lists no pandas-only rows.
    await click(switchButtons()[0]);
    assert.deepEqual(hrefs(), ['sql-01', 'sql-04']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

// Interview patterns cut across the topic groups: ?pattern= (linked from /learn/sql) keeps one pattern's rows.
test('the SQL track filters by interview pattern, from the URL and the chips', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://cswork.test/?view=problems&library=sql&pattern=anti-join#sql-group-joins',
  });
  let scrolled = '';
  dom.window.Element.prototype.scrollIntoView = function () {
    scrolled = this.id;
  };
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'sessionStorage', 'location', 'history'])
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SqlTrack } = await import('../components/sql-track.tsx');
  const root = createRoot(document.getElementById('root'));
  const render = (key) =>
    act(async () => {
      root.render(
        createElement(SqlTrack, {
          key,
          navigate() {},
          // sql-01 is an anti-join and a self-join, sql-05 a self-join, sql-17 a running total.
          availableProblemIds: ['sql-01', 'sql-04', 'sql-05', 'sql-17', 'sql-26'],
          activity: [],
          signedIn: true,
        }),
      );
    });
  const click = (node) =>
    act(async () => {
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
  const chips = () => [...document.querySelectorAll('fieldset.classic-patterns button')];
  const chip = (label) => chips().find((b) => b.textContent.startsWith(label));
  const rows = () => [...document.querySelectorAll('a.study-row')].map((a) => a.getAttribute('href').split('=').at(-1));
  try {
    await render('url');
    assert.equal(document.querySelector('fieldset.classic-patterns legend').textContent, 'Filter by pattern');
    // Only patterns with a published problem get a chip, counted over what is published.
    assert.deepEqual(
      chips().map((b) => [b.textContent, b.getAttribute('aria-pressed')]),
      [
        ['All patterns', 'false'],
        ['Running totals 1', 'false'],
        ['Anti-join (never …) 3', 'true'],
        ['Self-join 2', 'false'],
      ],
    );
    assert.deepEqual(rows(), ['sql-01', 'sql-04', 'sql-26']);
    assert.equal(document.querySelector('progress')?.getAttribute('max'), '3');
    assert.equal(scrolled, 'sql-group-joins', 'a topic link scrolls to its group once the rows render');

    await click(chip('Self-join'));
    assert.deepEqual(rows(), ['sql-01', 'sql-05']);
    assert.equal(new URL(location.href).searchParams.get('pattern'), 'self-join');
    assert.equal(new URL(location.href).searchParams.get('library'), 'sql');

    await click(chip('All patterns'));
    assert.deepEqual(rows(), ['sql-01', 'sql-04', 'sql-05', 'sql-26', 'sql-17']);
    assert.equal(new URL(location.href).searchParams.has('pattern'), false);

    // An unknown pattern shows the whole track.
    history.replaceState(null, '', '/?view=problems&library=sql&pattern=nope');
    await render('unknown');
    assert.equal(rows().length, 5);
    assert.equal(chip('All patterns').getAttribute('aria-pressed'), 'true');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
