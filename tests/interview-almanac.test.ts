// The interview almanac (/career/almanac): US holidays on their observed weekdays, the grade each
// kind of interview gets from a day's almanac entry, and the days it offers to book.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as lunar from 'lunar-typescript';
import {
  almanacDay,
  bestDays,
  interviewZone,
  rateDay,
  rateTrack,
  todayIn,
  TRACKS,
  usHolidays,
} from '../lib/interview-almanac';

const [phone, onsite, offer] = TRACKS;
const plain = {
  yi: [] as string[],
  ji: [] as string[],
  type: '黑道',
  zhiXing: '平',
  xiuLuck: '平',
};

test('holidays fall on the observed weekday, and only the ones companies close for are days off', () => {
  const h = usHolidays(2026);
  // July 4, 2026 is a Saturday: observed on Friday.
  assert.equal(h.get('7-3')?.en, 'Independence Day');
  assert.equal(h.get('7-4'), undefined);
  assert.equal(h.get('1-19')?.en, 'MLK Day');
  assert.equal(h.get('5-25')?.en, 'Memorial Day');
  assert.equal(h.get('11-26')?.en, 'Thanksgiving');
  assert.equal(h.get('11-27')?.zh, '感恩节次日');
  assert.equal(h.get('12-31'), undefined);
  // January 1, 2022 was a Saturday: observed on the last day of 2021.
  assert.equal(usHolidays(2021).get('12-31')?.en, "New Year's Day (observed)");
  assert.equal(almanacDay(lunar, 2026, 11, 26).dayOff, true);
  // Veterans Day is a federal holiday tech companies work through: labeled, still a working day.
  const veterans = almanacDay(lunar, 2026, 11, 11);
  assert.equal(veterans.holiday?.worked, true);
  assert.equal(veterans.dayOff, false);
  assert.equal(almanacDay(lunar, 2026, 11, 21).dayOff, true);
});

test('a track starts at 2 and moves with its own items and the day', () => {
  assert.deepEqual(rateTrack(plain, onsite), {
    score: 1.5,
    grade: '慎',
    reasons: [['黑道日', -0.5]],
  });
  const good = {
    yi: ['赴任', '出行', '订盟', '立券', '交易'],
    ji: ['会亲友'],
    type: '黄道',
    zhiXing: '成',
    xiuLuck: '吉',
  };
  // 2 + 赴任 1.5 + 出行 1 + 黄道 0.5 + 成 0.5 + 星宿 0.25, capped at 5.
  assert.equal(rateTrack(good, onsite).score, 5);
  // 立券 and 交易 are one group: counted once.
  assert.equal(
    rateTrack({ ...good, yi: ['立券', '交易'] }, offer).score,
    2 + 1 + 0.5 + 0.5 + 0.25,
  );
  assert.equal(rateTrack(good, phone).score, 2 - 1 + 0.5 + 0.5 + 0.25);
  const day = rateDay(good);
  assert.equal(day.best, 'onsite');
  assert.equal(day.grade, '大吉');
  assert.equal(rateDay({ ...good, yi: ['诸事不宜'] }).score, 0.5);
});

test('a real day reads from the lunar calendar', () => {
  const day = almanacDay(lunar, 2026, 11, 20);
  assert.equal(day.week, 5);
  assert.equal(`${day.lunarMonth}月${day.lunarDay}`, '十月十二');
  assert.deepEqual(day.lunarNum, [10, 12]);
  assert.equal(day.type, '黄道');
  assert.deepEqual(day.times, ['07–09', '09–11', '15–17', '17–19']);
  // 闭日 and an unlucky lodge outweigh the 黄道 day.
  assert.equal(rateDay(day).grade, '慎');
});

test('the days offered are working days graded 吉 or better, in date order', () => {
  const days = bestDays(lunar, { y: 2026, m: 11, d: 20 });
  assert.ok(days.length > 0 && days.length <= 6);
  for (const { day, rating } of days)
    assert.ok(!day.dayOff && rating.score >= 3);
  const stamps = days.map(
    ({ day }) => day.m * 100 + day.d + (day.y - 2026) * 10000,
  );
  assert.deepEqual(
    stamps,
    [...stamps].sort((a, b) => a - b),
  );
});

test('a US reader keeps their own zone and everyone else gets Pacific time', () => {
  assert.equal(interviewZone('America/New_York').en, 'Eastern');
  assert.equal(interviewZone('Asia/Shanghai').tz, 'America/Los_Angeles');
  assert.equal(interviewZone('America/Sao_Paulo').tz, 'America/Los_Angeles');
  assert.deepEqual(
    todayIn('America/Los_Angeles', new Date('2026-11-21T03:00:00Z')),
    { y: 2026, m: 11, d: 20 },
  );
});
