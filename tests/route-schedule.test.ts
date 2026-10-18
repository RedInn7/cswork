// Route schedules on /roadmap (lib/route-schedule.ts): steps laid into Monday-to-Sunday weeks at the
// learner's weekly hours, what counts as nothing left, the hours a target date needs, falling behind
// a saved schedule, and the .ics export.
import test from 'node:test';
import assert from 'node:assert/strict';
import { overdue, remainingMinutes, routeIcs, scheduleRoute } from '../lib/route-schedule';

// A Wednesday: its week has five days left.
const today = '2026-10-14';

test('the first week holds only its days left, and a step runs on into the next week', () => {
  const plan = scheduleRoute({
    steps: [
      { id: 'a', minutes: 240 },
      { id: 'b', minutes: 120 },
    ],
    today,
    weeklyHours: 7,
  });
  assert.deepEqual(plan.weeks, [
    { start: '2026-10-12', end: '2026-10-18', items: [{ id: 'a', minutes: 240 }, { id: 'b', minutes: 60 }] },
    { start: '2026-10-19', end: '2026-10-25', items: [{ id: 'b', minutes: 60 }] },
  ]);
  assert.deepEqual(plan.finish, { a: '2026-10-17', b: '2026-10-19' });
  assert.equal(plan.end, '2026-10-19');
  // 5 hours a week is 300/7 minutes a day: 100 minutes take 2⅓ days, so the third day.
  assert.deepEqual(scheduleRoute({ steps: [{ id: 'x', minutes: 100 }], today, weeklyHours: 5 }).finish, { x: '2026-10-16' });
  // On a Sunday the first week is one day long.
  const sunday = scheduleRoute({ steps: [{ id: 'x', minutes: 90 }], today: '2026-10-18', weeklyHours: 7 });
  assert.deepEqual(sunday.weeks.map((w) => [w.start, w.items[0].minutes]), [['2026-10-12', 60], ['2026-10-19', 30]]);
});

test('done, skipped, optional and unavailable steps take nothing; entries count their units left', () => {
  assert.equal(remainingMinutes({ id: 'a', minutes: 100 }, 0.8, false), 0, 'STEP_DONE');
  assert.equal(remainingMinutes({ id: 'a', minutes: 100 }, 0.5, false), 50);
  assert.equal(remainingMinutes({ id: 'a', minutes: 100 }, 0, true), 0);
  assert.equal(remainingMinutes({ id: 'a', minutes: 100, optional: true }, 0, false), 0);
  assert.equal(remainingMinutes({ id: 'a', minutes: 0, unavailable: true }, 0, false), 0);
  const ext = { kind: 'ext', id: 'ext-abc123', title: 'CS61B 1–12', units: 12, done: 4, unitMinutes: 60 } as const;
  assert.equal(remainingMinutes(ext, 1, false), 480, 'an entry ignores progress shares');
  assert.equal(remainingMinutes(ext, 0, true), 0);
  const plan = scheduleRoute({
    steps: [{ id: 'done', minutes: 600 }, { id: 'skip', minutes: 600 }, { id: 'opt', minutes: 600, optional: true }, ext],
    doneShare: { done: 0.9 },
    state: { skip: 'skip', 'ext-abc123': 'doing' },
    today,
    weeklyHours: 7,
  });
  assert.deepEqual(Object.keys(plan.finish), ['ext-abc123']);
  assert.equal(plan.finish['ext-abc123'], '2026-10-21');
  const empty = scheduleRoute({ steps: [{ id: 'skip', minutes: 60 }], state: { skip: 'skip' }, today, weeklyHours: 7 });
  assert.deepEqual([empty.weeks, empty.end], [[], '']);
});

test('needHours: what a week must hold to finish by the target date', () => {
  const steps = [{ id: 'a', minutes: 360 }];
  // 360 minutes over the 10 days through Oct 23: 36 a day, 4.2 hours a week.
  assert.equal(scheduleRoute({ steps, today, weeklyHours: 7, targetDate: '2026-10-23' }).needHours, 4.2);
  assert.equal(scheduleRoute({ steps, today, weeklyHours: 7, targetDate: today }).needHours, 42);
  // Rounded up to a tenth: 100 minutes over 3 days is 3.888… hours a week.
  assert.equal(scheduleRoute({ steps: [{ id: 'a', minutes: 100 }], today, weeklyHours: 7, targetDate: '2026-10-16' }).needHours, 3.9);
  assert.equal(scheduleRoute({ steps, today, weeklyHours: 7 }).needHours, null);
  assert.equal(scheduleRoute({ steps, today, weeklyHours: 7, targetDate: '2026-10-13' }).needHours, null, 'passed');
  assert.equal(scheduleRoute({ steps: [], today, weeklyHours: 7, targetDate: '2026-10-23' }).needHours, 0);
});

test('overdue: a saved finish day already past while work is left', () => {
  const planned = { a: '2026-10-13', b: '2026-10-20', c: '2026-10-01', d: today };
  const finish = { a: '2026-10-17', b: '2026-10-19', d: '2026-10-15', e: '2026-10-30' };
  assert.deepEqual(overdue(planned, finish, today), ['a'], 'c is finished; d is due today; e was never saved');
});

test('the .ics holds an all-day event per finish day and one on the target date, folded', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  const ics = routeIcs({
    routeId: 'role-backend',
    name: 'Backend engineer',
    steps: [
      { id: 'line-stops:array-foundations,hash-counting', title: 'Line 500: 2 stops, 30 problems', href: '/?view=problems&section=array-foundations' },
      { id: 'ext-abc123', title: 'Designing Data-Intensive Applications, chapters 1 to 12, with notes on every chapter' },
      { id: 'skipped', title: 'Skipped' },
    ],
    finish: { 'line-stops:array-foundations,hash-counting': '2026-10-17', 'ext-abc123': '2026-12-31' },
    targetDate: '2027-01-15',
    now,
    origin: 'https://cswork.org',
    english: true,
  });
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 3, 'nothing for a step without a finish day');
  const flat = ics.replace(/\r\n /g, '');
  assert.match(flat, /UID:cswork-route-role-backend-line-stops_array-foundations_hash-counting@cswork\.org\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261017\r\nDTEND;VALUE=DATE:20261018\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n/, 'across the year');
  assert.match(ics, /DTSTART;VALUE=DATE:20270115\r\nDTEND;VALUE=DATE:20270116\r\nSUMMARY:Target date: Backend engineer/);
  assert.match(ics, /URL:https:\/\/cswork\.org\/\?view=problems&section=array-foundations/);
  assert.match(ics, /SUMMARY:Finish: Line 500: 2 stops\\, 30 problems/, 'commas escaped');
  // The long entry title folds at 75 octets.
  assert.ok(ics.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75));
  assert.match(ics, /SUMMARY:Finish: Designing Data-Intensive[^\r]+\r\n [^\r]*every chapter\r\n/);
  assert.match(flat, /SUMMARY:Finish: Designing Data-Intensive Applications\\, chapters 1 to 12\\, with notes on every chapter\r\n/);
  const zh = routeIcs({ routeId: 'r-x', name: '我的路线', steps: [{ id: 'a', title: '一'.repeat(40) }], finish: { a: today }, targetDate: '', now, origin: '' });
  assert.equal(zh.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.ok(zh.includes('SUMMARY:完成：') && zh.includes('\r\n '), 'multi-byte titles fold too');
});
