// The review self-grade in the Accepted dialog (components/review-grade.tsx) and the 30-day
// forecast with its load settings on My progress (components/review-forecast.tsx).
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
const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/?view=progress' });
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator'])
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { ReviewGrade } = await import('../components/review-grade.tsx');
const { ReviewForecast } = await import('../components/review-forecast.tsx');
const { scheduleReviews } = await import('../lib/practice-review.ts');

const DAY = 86400000;
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));
const button = (label) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
const calls = [];
let reply = () => Response.json({ recorded: true });
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url: String(url), method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : null });
  return reply();
};
const root = createRoot(document.getElementById('root'));
const render = (element) => act(async () => root.render(element));

test('the self-grade shows on a review AC only, suggests Hard after a failure today, saves and changes', async () => {
  const now = new Date(2026, 9, 17, 15).getTime();
  const submission = { id: '6f1c1c38-2c40-4a59-9d55-1d0c6c9a2a11', created_at: now };
  const props = { problemId: 'lc-1', submission, english: true };
  // An earlier AC on the same local day is no review.
  await render(createElement(ReviewGrade, { ...props, history: [{ mode: 'judge', status: 'accepted', created_at: now - 3600000 }] }));
  assert.equal(document.querySelector('.cs-review-grade'), null);
  // Nor is another problem's AC on an earlier day.
  await render(createElement(ReviewGrade, { ...props, history: [], activity: [{ problem_id: 'lc-2', created_at: now - 5 * DAY }] }));
  assert.equal(document.querySelector('.cs-review-grade'), null);
  let progress = 0;
  window.addEventListener('cswork:practice-progress-changed', () => progress++);
  await render(
    createElement(ReviewGrade, {
      ...props,
      activity: [{ problem_id: 'lc-1', created_at: now - 5 * DAY }],
      history: [{ mode: 'judge', status: 'wrong_answer', created_at: now - 60000 }],
    }),
  );
  const group = document.querySelector('fieldset.cs-review-grade');
  assert.equal(group.querySelector('legend').textContent, 'A review. How did this one go?');
  assert.deepEqual([...group.querySelectorAll('button')].map((b) => b.textContent), ['Again', 'Hard', 'Good', 'Easy']);
  assert.match(group.querySelector('.cs-review-grade-note').textContent, /^It failed earlier today: Hard fits\./);
  assert.equal(group.querySelectorAll('[aria-pressed="true"]').length, 0, 'a suggestion is not a saved grade');
  assert.equal(calls.length, 0, 'nothing is saved before a press');
  await act(async () => button('Good').click());
  await settle();
  assert.deepEqual(calls.at(-1), {
    url: '/api/oj/problems/lc-1/aids',
    method: 'POST',
    body: { kind: 'grade', grade: 3, submissionId: submission.id },
  });
  assert.equal(button('Good').getAttribute('aria-pressed'), 'true');
  assert.equal(group.querySelector('.cs-review-grade-note').textContent, 'Saved as Good. You can change it.');
  assert.equal(progress, 1);
  await act(async () => button('Again').click());
  await settle();
  assert.equal(calls.at(-1).body.grade, 1);
  assert.equal(button('Again').getAttribute('aria-pressed'), 'true');
  assert.equal(button('Good').getAttribute('aria-pressed'), 'false');
  // A refusal (a contest running for this learner) says why and keeps the last grade.
  reply = () => Response.json({ error: 'This problem is in your running contest' }, { status: 403 });
  await act(async () => button('Easy').click());
  await settle();
  assert.equal(group.querySelector('.cs-review-grade-note').textContent, 'This problem is in your running contest');
  assert.equal(button('Again').getAttribute('aria-pressed'), 'true');
  reply = () => Response.json({ recorded: true });
});

test('the forecast: 30 bars with a text list, held-over reviews, and the cap and break saved as pref:review', async () => {
  const now = new Date(2026, 9, 17, 15).getTime();
  const item = (problemId, acAt) => ({ problemId, acAt, help: 'none' });
  // Three overdue (solved 4..6 days ago, due after 3), one due in 2 days.
  const history = [item('a', [now - 6 * DAY]), item('b', [now - 5 * DAY]), item('c', [now - 4 * DAY]), item('d', [now - DAY])];
  let prefs = { dailyCap: 2 };
  const changes = [];
  const show = () =>
    render(
      createElement(ReviewForecast, {
        schedule: scheduleReviews(history, now, prefs),
        prefs,
        now,
        english: true,
        onChange: (next) => {
          changes.push(next);
          prefs = next;
        },
      }),
    );
  await show();
  const section = document.querySelector('.review-forecast');
  assert.equal(section.querySelector('h2').textContent, 'Reviews over the next 30 days');
  assert.equal(section.querySelector('.review-forecast-summary').textContent, '2 today · 1 held over from today');
  assert.equal(section.querySelectorAll('.review-forecast-bars li').length, 30);
  const spoken = [...section.querySelectorAll('ul.sr-only li')].map((li) => li.textContent);
  assert.deepEqual(spoken.slice(0, 3), ['Oct 17: 2', 'Oct 18: 1', 'Oct 19: 1']);
  assert.equal(spoken.length, 30);
  // The cap: a select; "No cap" with no break left removes the note.
  calls.length = 0;
  const cap = section.querySelector('select');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(cap, '10');
    cap.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle();
  assert.deepEqual(calls.at(-1), {
    url: '/api/oj/notes?target=pref%3Areview',
    method: 'PUT',
    body: { body: '{"dailyCap":10}' },
  });
  assert.deepEqual(changes.at(-1), { dailyCap: 10 });
  await show();
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, 'value').set.call(cap, '');
    cap.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  await settle();
  assert.deepEqual(calls.at(-1).body, { body: '' });
  assert.deepEqual(changes.at(-1), {});
  await show();
  // A break (7 days by default) from today: nothing today, and ending it the same day clears it.
  await act(async () => button('Start today').click());
  await settle();
  assert.deepEqual(JSON.parse(calls.at(-1).body.body), { pausedFrom: '2026-10-17', pausedDays: 7 });
  await show();
  assert.equal(document.querySelector('.review-forecast-summary').textContent, 'On a break: reviews resume after 2026-10-23. · 3 held over from today');
  await act(async () => button('End the break now').click());
  await settle();
  assert.deepEqual(calls.at(-1).body, { body: '' });
  // Ended on its third day: the two days taken stay.
  prefs = { dailyCap: 5, pausedFrom: '2026-10-15', pausedDays: 14 };
  await show();
  await act(async () => button('End the break now').click());
  await settle();
  assert.deepEqual(JSON.parse(calls.at(-1).body.body), { dailyCap: 5, pausedFrom: '2026-10-15', pausedDays: 2 });
  // A failed save says so.
  reply = () => new Response(null, { status: 500 });
  await show();
  await act(async () => button('Start today').click());
  await settle();
  assert.equal(document.querySelector('.review-forecast-note').textContent, "Couldn't save the settings. Try again.");
  reply = () => Response.json({ recorded: true });
  await act(async () => root.unmount());
});
