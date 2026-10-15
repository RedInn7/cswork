// The daily problem month: ledger days ticked, today starred, "this month n/total", up to 12
// months back, and nothing at all for a guest.
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

const dom = new JSDOM('<div id="root"></div>', { url: 'https://cswork.test/daily' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { DailyMonth } = await import('../components/daily-month.tsx');
const { beijingDate } = await import('../lib/daily-problem.ts');

const today = beijingDate(Date.now());
const month = today.slice(0, 7);
const [y, m] = month.split('-').map(Number);
const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
const previous = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);

async function mount(reply, english = false) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), '/api/oj/points/daily');
    return reply();
  };
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(DailyMonth, { english })));
  await act(async () => new Promise((r) => setTimeout(r, 5)));
  globalThis.fetch = original;
  return { host, unmount: () => act(async () => root.unmount()) };
}

test('done days are ticked, today is marked, and the count is this month’s', async () => {
  const days = [`${month}-01`, today, `${previous}-03`];
  const { host, unmount } = await mount(() => Response.json({ days }));
  const done = new Set([`${month}-01`, today]).size;
  assert.equal(host.querySelector('h3').textContent, `${y} 年 ${m} 月 · 本月 ${done}/${total}`);
  const cells = [...host.querySelectorAll('.daily-month-grid li:not([aria-hidden])')];
  assert.equal(cells.length, total);
  assert.ok(cells[0].hasAttribute('data-done'));
  const now = cells[Number(today.slice(8)) - 1];
  assert.ok(now.hasAttribute('data-today') && now.hasAttribute('data-done'));
  assert.match(now.querySelector('.sr-only').textContent, /今天，已完成$/);
  // Monday first: the blanks before the 1st match its weekday.
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  assert.equal(host.querySelectorAll('.daily-month-grid li[aria-hidden]:not(.daily-month-weekday)').length, lead);
  // Back a month: last month's day, no "this month" and no today.
  const [prev, next] = host.querySelectorAll('.daily-month-head button');
  assert.equal(next.disabled, true);
  await act(async () => prev.click());
  assert.match(host.querySelector('h3').textContent, / · 1\/\d+$/);
  assert.equal(host.querySelector('[data-today]'), null);
  // Twelve months in all.
  for (let i = 0; i < 15; i++) await act(async () => prev.click());
  assert.equal(prev.disabled, true);
  await unmount();
});

test('a guest (401) sees nothing; English names the month', async () => {
  const guest = await mount(() => Response.json({ error: 'Please sign in first' }, { status: 401 }));
  assert.equal(guest.host.innerHTML, '');
  await guest.unmount();
  const { host, unmount } = await mount(() => Response.json({ days: [] }), true);
  assert.match(host.querySelector('h3').textContent, new RegExp(`^\\w+ ${y} · 0/${total} this month$`));
  await unmount();
});
