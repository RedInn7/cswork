// /career/offers (components/offer-compare.tsx): saved offers come back from this browser, edits are
// saved there only, the table and bars add up each year, a bad custom schedule says so, and the
// tracker import fills in only company and role from cards at the offer stage.
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createElement, act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const KEY = 'cswork:offers:v1';
const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/career/offers' });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location', 'history'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { OfferCompare } = await import('../components/offer-compare.tsx');

const calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push(`${init.method ?? 'GET'} ${String(url)}`);
  return Response.json({
    items: [
      { id: '1', company: 'Acme', role: 'SWE', stage: 'offer', offerDeadline: new Date(2099, 0, 5, 17).getTime() },
      { id: '2', company: 'Zed', role: 'SDE', stage: 'onsite', offerDeadline: null },
    ],
  });
};

const roots = [];
// A failed test skips its unmount; the countdown's interval would then keep the run alive.
after(() => act(async () => roots.forEach((r) => r.unmount())));
const mount = async (props = {}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);
  await act(async () => root.render(createElement(OfferCompare, { zh: false, signedIn: false, ...props })));
  return { host, unmount: () => act(async () => root.unmount()) };
};
const setValue = async (field, value, type = 'input') => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event(type, { bubbles: true }));
  });
};
const labelled = (scope, text) => [...scope.querySelectorAll('label')].find((l) => l.firstChild.textContent === text).querySelector('input, select');
const button = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent === text);
const row = (host, head) => [...host.querySelectorAll('.offer-table tr')].find((r) => r.querySelector('th')?.textContent === head);
const cells = (host, head) => [...row(host, head).querySelectorAll('td')].map((td) => td.textContent);

test('the server render has two blank offer cards, the vesting choices and no figures of anyone', () => {
  const doc = new JSDOM(renderToStaticMarkup(createElement(OfferCompare, { zh: true, signedIn: false }))).window.document;
  assert.equal(doc.querySelectorAll('.offer-card').length, 2);
  assert.deepEqual(
    [...labelled(doc.querySelector('.offer-card'), '归属方式').options].map((o) => o.value),
    ['even', '5-15-40-40', 'front-40-30-20-10', 'custom'],
  );
  assert.equal(doc.querySelectorAll('[aria-labelledby="offer-table-title"] thead th').length, 3);
  assert.equal(doc.querySelector('.offer-intern-table'), null);
  assert.equal(doc.querySelector('.offer-bar'), null);
  assert.ok(![...doc.querySelectorAll('button')].some((b) => b.textContent === '从投递看板导入'));
  assert.ok(doc.querySelector('.resume-actions small').textContent.includes('不会上传'));
});

test('saved offers come back with yearly totals, the best four-year and first-year cash, bars and countdowns', async () => {
  localStorage.setItem(
    KEY,
    JSON.stringify([
      { id: 'a', company: 'Acme', role: 'SWE', schedule: 'even', base: 150000, grant: 400000, deadline: '2099-01-01', clawbackNote: 'Repay within a year' },
      { id: 'b', company: 'Beta', role: '', schedule: '5-15-40-40', base: 160000, grant: 400000, signOn1: 20000 },
    ]),
  );
  const { host, unmount } = await mount();
  assert.deepEqual(
    [...host.querySelectorAll('.offer-card legend')].map((l) => l.textContent),
    ['Acme', 'Beta'],
  );
  assert.deepEqual(cells(host, 'Year 1'), ['250,000stock 100,000', '200,000stock 20,000']);
  assert.deepEqual(cells(host, 'Year 3'), ['250,000stock 100,000', '320,000stock 160,000']);
  assert.deepEqual(cells(host, '4-year total'), ['1,000,000', '1,060,000Highest']);
  assert.deepEqual(cells(host, 'First-year cash (no stock)'), ['150,000', '180,000Highest']);
  assert.match(cells(host, 'Reply by')[0], /^2099-01-01\d+d \d+h left$/);
  assert.equal(cells(host, 'Reply by')[1], '—');
  assert.deepEqual(cells(host, 'Clawback'), ['Repay within a year', '—']);
  assert.equal(host.querySelectorAll('.offer-year').length, 4);
  assert.equal(host.querySelectorAll('.offer-year')[0].querySelectorAll('.offer-bar-row').length, 2);
  assert.equal(host.querySelector('.offer-bar').getAttribute('aria-hidden'), 'true');
  await unmount();
});

test('edits are saved in this browser; a custom schedule off 100% is flagged until it adds up', async () => {
  const { host, unmount } = await mount();
  const [acme] = host.querySelectorAll('.offer-card');
  await setValue(labelled(acme, 'Base salary (yearly)'), '170000');
  assert.equal(JSON.parse(localStorage.getItem(KEY))[0].base, 170000);
  // The live region is there before the error, so the error is read out when it appears.
  const live = acme.querySelector('[aria-live="polite"]');
  assert.equal(live.textContent, '');
  await setValue(labelled(acme, 'Vesting schedule'), 'custom', 'change');
  assert.equal(acme.querySelector('.resume-error'), live);
  assert.match(live.textContent, /adds up to 0%/);
  assert.equal(cells(host, 'Year 1')[0], '—');
  const years = acme.querySelectorAll('.offer-custom input');
  assert.deepEqual(
    [...years].map((y) => [y.getAttribute('aria-invalid'), y.getAttribute('aria-describedby')]),
    Array(4).fill(['true', live.id]),
  );
  for (const [i, v] of ['10', '20', '30', '40'].entries()) await setValue(years[i], v);
  assert.equal(acme.querySelector('.resume-error'), null);
  assert.equal(live.textContent, '');
  assert.equal(years[0].getAttribute('aria-invalid'), 'false');
  assert.deepEqual(JSON.parse(localStorage.getItem(KEY))[0].custom, [10, 20, 30, 40]);
  assert.equal(cells(host, 'Year 1')[0], '210,000stock 40,000');
  // Blanking a field drops it rather than saving 0.
  await setValue(labelled(acme, 'Base salary (yearly)'), '');
  assert.equal('base' in JSON.parse(localStorage.getItem(KEY))[0], false);
  await unmount();
});

test('up to four offers, removable down to two, and Clear forgets them', async () => {
  const { host, unmount } = await mount();
  const add = button(host, 'Add an offer');
  await act(async () => add.click());
  await act(async () => add.click());
  assert.equal(host.querySelectorAll('.offer-card').length, 4);
  assert.equal(add.disabled, true);
  const remove = host.querySelector('.offer-card:nth-child(3) .offer-remove');
  assert.equal(remove.getAttribute('aria-label'), 'Remove Offer 3');
  await act(async () => remove.click());
  assert.equal(JSON.parse(localStorage.getItem(KEY)).length, 3);
  await act(async () => button(host, 'Clear').click());
  assert.equal(localStorage.getItem(KEY), null);
  assert.equal(host.querySelectorAll('.offer-card').length, 2);
  assert.equal(host.querySelector('.offer-remove'), null);
  await unmount();
});

test('signed in, the tracker import fills company and role from offer-stage cards only', async () => {
  localStorage.clear();
  const { host, unmount } = await mount({ signedIn: true, zh: true });
  const note = host.querySelector('output.offer-note');
  assert.equal(note.textContent, '');
  await act(async () => button(host, '从投递看板导入').click());
  assert.deepEqual(calls, ['GET /api/oj/applications']);
  const saved = JSON.parse(localStorage.getItem(KEY));
  // The card's offer deadline comes along as a local date.
  assert.equal(saved[0].deadline, '2099-01-05');
  assert.deepEqual(
    saved.map((o) => [o.company, o.role, o.base]),
    [
      ['Acme', 'SWE', undefined],
      ['', '', undefined],
    ],
  );
  assert.equal(host.querySelector('.offer-note'), note);
  assert.match(note.textContent, /导入了 1 个 offer/);
  await act(async () => button(host, '从投递看板导入').click());
  assert.match(host.querySelector('.offer-note').textContent, /没有新的/);
  await unmount();
});

test('typing while the import is out is kept: the import merges into the offers as they are then', async () => {
  localStorage.clear();
  const real = globalThis.fetch;
  let answer;
  globalThis.fetch = () => new Promise((resolve) => (answer = resolve));
  try {
    const { host, unmount } = await mount({ signedIn: true });
    await act(async () => button(host, 'Import from my tracker').click());
    const [first, second] = host.querySelectorAll('.offer-card');
    await setValue(labelled(second, 'Base salary (yearly)'), '123000');
    await act(async () => answer(Response.json({ items: [{ id: '1', company: 'Acme', role: 'SWE', stage: 'offer', offerDeadline: null }] })));
    assert.deepEqual(
      JSON.parse(localStorage.getItem(KEY)).map((o) => [o.company, o.base]),
      [
        ['Acme', undefined],
        ['', 123000],
      ],
    );
    assert.equal(labelled(second, 'Base salary (yearly)').value, '123000');
    assert.equal(labelled(first, 'Company').value, 'Acme');
    assert.match(host.querySelector('.offer-note').textContent, /Added 1 offer/);
    await unmount();
  } finally {
    globalThis.fetch = real;
  }
});

test('blocked storage still renders and compares', async () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    },
  });
  try {
    const { host, unmount } = await mount();
    await setValue(labelled(host.querySelector('.offer-card'), 'Base salary (yearly)'), '100000');
    assert.equal(cells(host, 'Year 1')[0], '100,000stock 0');
    await unmount();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', real);
  }
});
