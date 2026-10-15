// /career/tracker (components/application-tracker.tsx): the funnel, one column per stage with the
// OA countdown and the company's OA and mock links, adding and moving cards through the API, and
// the CSV and calendar exports built in the browser.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createElement, act } from 'react';

const HOUR = 3600000;
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'https://cswork.test/career/tracker',
  virtualConsole: new VirtualConsole(), // jsdom cannot follow a download link; keep that quiet
});
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage', 'navigator', 'location'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ApplicationTracker } = await import('../components/application-tracker.tsx');

const now = Date.now();
const card = (patch) => ({
  id: 'a', companySlug: '', company: 'Acme', role: '', stage: 'applied', appliedAt: null, oaDeadline: null, interviewAt: null,
  referral: '', link: '', notes: '', createdAt: 1, updatedAt: 1, links: null, ...patch,
});
const items = [
  card({ id: 'amz', companySlug: 'amazon', company: 'Amazon', role: 'SDE Intern', stage: 'oa', oaDeadline: now + 30 * HOUR, links: { oa: '/oa/amazon', mock: '/mock-oa/amazon' } }),
  card({ id: 'evil', company: '=HYPERLINK("http://x")', stage: 'applied' }),
  card({ id: 'off', company: 'Offerco', stage: 'offer', interviewAt: now - 100 * HOUR }),
  card({ id: 'wish', company: 'Someday', stage: 'saved' }),
];
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const key = `${init.method ?? 'GET'} ${String(url)}`;
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push([key, body]);
  if (key === 'GET /api/oj/applications') return Response.json({ items, max: 300 });
  if (key === 'GET /api/oj/reports/companies') return Response.json({ items: [{ slug: 'google', name: 'Google' }] });
  if (key === 'POST /api/oj/applications') return Response.json({ item: card({ id: 'new', ...body }) });
  if (key === 'POST /api/oj/applications/amz') return Response.json({ item: { ...items[0], ...body } });
  return Response.json({ error: 'no route' }, { status: 404 });
};
const blobs = [];
URL.createObjectURL = (blob) => (blobs.push(blob), 'blob:test');
URL.revokeObjectURL = () => {};

const root = createRoot(document.getElementById('root'));
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const column = (stage) => document.querySelector(`.tracker-column[data-stage="${stage}"]`);
const setValue = async (field, value, type = 'input') => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value').set;
  await act(async () => {
    setter.call(field, value);
    field.dispatchEvent(new window.Event(type, { bubbles: true }));
  });
};

test('the board shows the funnel, a column per stage, the countdown and the company links', async () => {
  await act(async () => root.render(createElement(ApplicationTracker, { zh: true })));
  const summary = [...document.querySelectorAll('.tracker-summary dd')].map((d) => d.textContent);
  // 3 sent (the saved one is not); Amazon and the offer got an OA, the offer an interview.
  assert.deepEqual(summary, ['3', '67%', '33%', '1']);
  assert.equal(document.querySelectorAll('.tracker-column').length, 8);
  assert.equal(column('phone').getAttribute('data-empty'), '');
  const amazon = column('oa').querySelector('.tracker-card');
  assert.equal(amazon.getAttribute('data-due'), 'soon');
  assert.match(amazon.querySelector('.tracker-due').textContent, /^OA 还剩 1 天 [56] 小时$/);
  assert.deepEqual(
    [...amazon.querySelectorAll('.tracker-links a')].map((a) => [a.textContent, a.getAttribute('href')]),
    [['这家的 OA 真题', '/oa/amazon'], ['模拟 OA', '/mock-oa/amazon']],
  );
  assert.equal(amazon.querySelector('select').getAttribute('aria-label'), 'Amazon 的阶段');
});

test('adding a card posts the form; moving one posts only its stage', async () => {
  await act(async () => button('添加投递').click());
  const form = document.querySelector('form.resume-form');
  // Names come from the company pages.
  assert.ok(form.querySelector('#tracker-companies option[value="Google"]'));
  await setValue(form.querySelector('input[list="tracker-companies"]'), 'Google');
  await setValue(form.querySelector('input[type="date"]'), '2099-03-04');
  await act(async () => form.querySelector('button[type="submit"]').click());
  const [, sent] = calls.find(([k]) => k === 'POST /api/oj/applications');
  assert.equal(sent.company, 'Google');
  assert.equal(sent.stage, 'applied');
  assert.equal(sent.appliedAt, new Date(2099, 2, 4).getTime(), 'a date is local midnight');
  assert.equal(sent.oaDeadline, null);
  assert.equal(document.querySelector('form.resume-form'), null);
  assert.ok([...column('applied').querySelectorAll('.tracker-company')].some((p) => p.textContent === 'Google'));

  await setValue(column('oa').querySelector('select'), 'phone', 'change');
  assert.deepEqual(calls.at(-1), ['POST /api/oj/applications/amz', { stage: 'phone' }]);
  assert.match(column('phone').textContent, /Amazon/);
});

test('a job link must be https before anything is sent', async () => {
  const before = calls.length;
  await act(async () => button('添加投递').click());
  const form = document.querySelector('form.resume-form');
  await setValue(form.querySelector('input[list="tracker-companies"]'), 'Meta');
  await setValue(form.querySelector('input[type="url"]'), 'http://jobs.example.com');
  await act(async () => form.querySelector('button[type="submit"]').click());
  assert.equal(calls.length, before);
  assert.match(document.querySelector('.resume-error').textContent, /https:\/\//);
  await act(async () => button('取消').click());
});

test('the exports: CSV with formulas defused, a calendar with the open deadlines', async () => {
  await act(async () => button('导出 CSV').click());
  const csv = await blobs.at(-1).text();
  assert.match(csv, /"'=HYPERLINK\(""http:\/\/x""\)"/);
  await act(async () => button('导出 OA 截止日历').click());
  const ics = await blobs.at(-1).text();
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert.match(ics, /SUMMARY:OA 截止：Amazon · SDE Intern/);
  assert.match(ics, /TRIGGER:-P1D[\s\S]*TRIGGER:-PT2H/);
  await act(async () => root.unmount());
});
