import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  addMonths,
  nextDeadline,
  validDate,
  VISA_RULES,
  visaTimeline,
  type VisaEvent,
} from '../lib/visa-timeline';

const on = (events: VisaEvent[], kind: string) => events.filter((e) => e.kind === kind).map((e) => e.date);

void test('the OPT window is 90 days before to 60 days after the program end, leap days counted', () => {
  // 2028 is a leap year: 90 days back from May 15 crosses Feb 29.
  const leap = visaTimeline({ programEnd: '2028-05-15' }, '2028-01-01');
  assert.deepEqual(on(leap, 'opt-open'), ['2028-02-15']);
  assert.deepEqual(on(leap, 'opt-close'), ['2028-07-14']);
  const plain = visaTimeline({ programEnd: '2027-05-15' }, '2027-01-01');
  assert.deepEqual(on(plain, 'opt-open'), ['2027-02-14']);
  // A December end runs the 60 days into the next year.
  assert.deepEqual(on(visaTimeline({ programEnd: '2026-12-20' }, '2026-10-14'), 'opt-close'), ['2027-02-18']);
  assert.equal(leap.find((e) => e.kind === 'opt-close')?.severity, 'deadline');
});

void test('date helpers reject impossible dates and never run past a month end', () => {
  assert.equal(validDate('2027-02-29'), undefined);
  assert.equal(validDate('2028-02-29'), '2028-02-29');
  assert.equal(validDate('2028-2-9'), undefined);
  assert.equal(validDate(20280101), undefined);
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addMonths('2028-02-29', 24), '2030-02-28');
  assert.equal(addMonths('2027-08-31', 6), '2028-02-29');
  // Garbage from storage is ignored rather than thrown on.
  assert.deepEqual(visaTimeline({ programEnd: 'soon', optStart: '2027-13-01' }, '2026-10-14').filter((e) => e.rule === 'opt'), []);
});

void test('unemployment counts the EAD start as day 1, and STEM OPT files 90 days before the EAD ends', () => {
  const events = visaTimeline({ stem: true, optStart: '2027-07-01', optEnd: '2028-06-30' }, '2027-06-01');
  assert.deepEqual(on(events, 'unemployment'), ['2027-09-28']);
  assert.deepEqual(on(events, 'stem-open'), ['2028-04-01']);
  const end = events.find((e) => e.kind === 'opt-end')!;
  assert.equal(end.rule, 'stem');
  assert.equal(end.severity, 'deadline');
  // Filed: no window any more, the 180-day automatic extension instead, and 150 days named.
  const filed = visaTimeline({ stem: true, stemFiled: true, optStart: '2027-07-01', optEnd: '2028-06-30' }, '2027-06-01');
  assert.deepEqual(on(filed, 'stem-open'), []);
  assert.deepEqual(on(filed, 'stem-pending'), ['2028-12-27']);
  assert.match(filed.find((e) => e.kind === 'unemployment')!.zh, /150/);
});

void test('H-1B registrations inside the work authorization, October starts and the cap-gap', () => {
  // Non-STEM OPT from July 2027 to June 2028: one March inside it, and June falls in the gap.
  const opt = visaTimeline({ optStart: '2027-07-01', optEnd: '2028-06-30' }, '2027-06-01');
  assert.deepEqual(on(opt, 'h1b-registration'), ['2028-03-01']);
  assert.deepEqual(on(opt, 'h1b-start'), ['2028-10-01']);
  assert.deepEqual(on(opt, 'cap-gap'), ['2028-06-30']);
  assert.match(opt.find((e) => e.kind === 'cap-gap')!.en, /FY2029.*2029-04-01/);
  // STEM adds 24 months: three registrations, and the extended end (June 2030) is in a gap again.
  const stem = visaTimeline({ stem: true, optStart: '2027-07-01', optEnd: '2028-06-30' }, '2027-06-01');
  assert.deepEqual(on(stem, 'h1b-registration'), ['2028-03-01', '2029-03-01', '2030-03-01']);
  assert.deepEqual(on(stem, 'cap-gap'), ['2030-06-30']);
  // A filed or approved extension counts as STEM even with the degree box left unticked.
  const filed = visaTimeline({ stemFiled: true, optStart: '2027-07-01', optEnd: '2028-06-30' }, '2027-06-01');
  assert.deepEqual(on(filed, 'h1b-registration'), on(stem, 'h1b-registration'));
  assert.deepEqual(on(filed, 'cap-gap'), ['2030-06-30']);
  // Selected in 2029: filing from April 1, and no later registrations.
  const picked = visaTimeline({ stem: true, optStart: '2027-07-01', optEnd: '2028-06-30', h1bSelected: 2029 }, '2027-06-01');
  assert.deepEqual(on(picked, 'h1b-registration'), ['2028-03-01']);
  assert.deepEqual(on(picked, 'h1b-file'), ['2029-04-01']);
  assert.deepEqual(on(picked, 'h1b-start'), ['2028-10-01', '2029-10-01']);
  // A year still being typed ("2", "202") is no year: the registrations stay as without one.
  for (const h1bSelected of [2, 202])
    assert.deepEqual(visaTimeline({ stem: true, optStart: '2027-07-01', optEnd: '2028-06-30', h1bSelected }, '2027-06-01'), stem);
});

void test('green card stages count the days passed; the next deadline skips the past', () => {
  const events = visaTimeline({ permFiled: '2026-01-14', priorityDate: '2026-01-14', i485Filed: '2027-01-01' }, '2026-10-14');
  const perm = events.find((e) => e.kind === 'perm-filed')!;
  assert.equal(perm.days, 273);
  assert.equal(perm.severity, 'past');
  // A date still ahead counts as 0 days, not negative.
  assert.equal(events.find((e) => e.kind === 'i485-filed')?.days, 0);

  const plan = visaTimeline({ programEnd: '2027-05-15' }, '2026-10-14');
  assert.deepEqual(nextDeadline(plan, '2026-10-14'), { event: plan.find((e) => e.kind === 'opt-close'), days: 273 });
  assert.equal(nextDeadline(plan, '2027-07-15')?.event.date, '2028-03-01');
  assert.equal(nextDeadline(events, '2026-10-14'), null);
});

void test('every rule names an official https source and the day it was checked', () => {
  for (const [id, rule] of Object.entries(VISA_RULES)) {
    assert.match(rule.source, /^https:\/\/www\.uscis\.gov\//, id);
    assert.ok(validDate(rule.verifiedOn), id);
    assert.ok(rule.zh && rule.en, id);
  }
});
