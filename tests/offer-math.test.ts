// The offer calculator's arithmetic (lib/offer-math.ts): vesting schedules, sign-on split, refreshers,
// growth, cliffs, the custom schedule's 100% rule, saved-offer cleanup and the tracker import.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankOffer, firstYearCash, fourYear, importOffers, OFFERS_MAX, readOffers, yearly, type Offer } from '../lib/offer-math.ts';

const offer = (fields: Partial<Offer>): Offer => ({ ...blankOffer('t'), ...fields });
const stock = (o: Offer) => yearly(o).map((y) => Math.round(y.stock * 100) / 100);
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

test('the same grant, vested evenly or 5/15/40/40, differs by year but not over four years', () => {
  const even = offer({ grant: 400000 }),
    back = offer({ grant: 400000, schedule: '5-15-40-40' }),
    front = offer({ grant: 400000, schedule: 'front-40-30-20-10' });
  assert.deepEqual(stock(even), [100000, 100000, 100000, 100000]);
  assert.deepEqual(stock(back), [20000, 60000, 160000, 160000]);
  assert.deepEqual(stock(front), [160000, 120000, 80000, 40000]);
  assert.deepEqual(
    stock(back).map((s, i) => s - stock(even)[i]),
    [-80000, -40000, 60000, 60000],
  );
  assert.equal(fourYear(even), fourYear(back));
  assert.equal(fourYear(front), fourYear(back));
});

test('the sign-on bonus is paid in years 1 and 2 only', () => {
  assert.deepEqual(
    yearly(offer({ signOn1: 50000, signOn2: 25000 })).map((y) => y.signOn),
    [50000, 25000, 0, 0],
  );
});

test('refreshers stack from year 2, a quarter a year, counting only what vests by year 4', () => {
  assert.deepEqual(stock(offer({ grant: 400000, refresherPct: 25 })), [100000, 125000, 150000, 175000]);
  // Each refresher grows from the year it is granted: year 4 holds three of them.
  assert.deepEqual(stock(offer({ refresherPct: 25, grant: 400000, schedule: 'custom', custom: [100, 0, 0, 0], growthPct: 10 })), [
    400000, 25000, 52500, 82750,
  ]);
});

test('with no growth four years of stock add up to the grant; growth compounds from the grant price', () => {
  for (const schedule of ['even', '5-15-40-40', 'front-40-30-20-10'] as const)
    for (const cliffMonths of [0, 12, 13, 24]) assert.equal(sum(stock(offer({ grant: 123456, schedule, cliffMonths }))), 123456);
  assert.deepEqual(stock(offer({ grant: 400000, growthPct: 20 })), [100000, 120000, 144000, 172800]);
  assert.deepEqual(stock(offer({ grant: 400000, growthPct: -100 })), [100000, 0, 0, 0]);
});

test('a cliff of 12 months still vests in year 1; 13 months moves year 1 into year 2', () => {
  assert.deepEqual(stock(offer({ grant: 400000, cliffMonths: 12 })), [100000, 100000, 100000, 100000]);
  assert.deepEqual(stock(offer({ grant: 400000, cliffMonths: 13 })), [0, 200000, 100000, 100000]);
  assert.deepEqual(stock(offer({ grant: 400000, cliffMonths: 13, growthPct: 10 })), [0, 220000, 121000, 133100]);
  assert.deepEqual(stock(offer({ grant: 400000, cliffMonths: 0, schedule: '5-15-40-40' })), [20000, 60000, 160000, 160000]);
});

test('a custom schedule must be four non-negative percentages adding up to 100', () => {
  assert.deepEqual(stock(offer({ grant: 1000, schedule: 'custom', custom: [10, 20, 30, 40] })), [100, 200, 300, 400]);
  for (const custom of [[10, 20, 30, 30], [-10, 40, 30, 40], [50], []])
    assert.throws(() => yearly(offer({ grant: 1000, schedule: 'custom', custom })), RangeError);
  assert.throws(() => fourYear(offer({ schedule: 'custom' })), /adds up to 0%/);
});

test('bonus, yearly extras and relocation; first-year cash leaves stock out', () => {
  const o = offer({ base: 150000, bonusPct: 10, signOn1: 30000, relocation: 5000, match401k: 6000, otherAnnual: 1000, grant: 200000 });
  const years = yearly(o);
  assert.deepEqual(
    years.map((y) => [y.bonus, y.other]),
    [
      [15000, 12000],
      [15000, 7000],
      [15000, 7000],
      [15000, 7000],
    ],
  );
  assert.equal(years[0].total, 150000 + 15000 + 50000 + 30000 + 12000);
  assert.equal(firstYearCash(o), 200000);
  assert.equal(fourYear(o), 4 * 165000 + 200000 + 30000 + 5000 + 4 * 7000);
  // A blank offer is all zeros, not NaN.
  assert.deepEqual(yearly(blankOffer())[0], { base: 0, bonus: 0, stock: 0, signOn: 0, other: 0, total: 0 });
});

test('saved offers are cleaned up: junk dropped, fields typed, at most four', () => {
  assert.deepEqual(readOffers('nope'), []);
  const [first, ...rest] = readOffers([
    { id: 'a', company: 'Acme', base: 100, grant: '9', schedule: 'weird', custom: [1, 'x'], deadline: '2026-11-01T00', growthPct: null },
    null,
    [1],
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 'e' },
  ]);
  assert.deepEqual(first, {
    id: 'a',
    company: 'Acme',
    role: '',
    deadline: '',
    clawbackNote: '',
    schedule: 'even',
    custom: [1, undefined, undefined, undefined],
    base: 100,
  });
  assert.equal(rest.length, OFFERS_MAX - 1);
});

test('the tracker import fills empty cards, then new ones up to four, and skips names already there', () => {
  const start = [offer({ id: 'x', company: 'Acme', role: 'SWE' }), offer({ id: 'y' })];
  const { offers, added, skipped } = importOffers(start, [
    { company: ' acme ', role: 'swe' },
    { company: 'Beta', role: 'New grad' },
    { company: 'Gamma', role: '' },
    { company: 'Delta', role: 'SDE' },
    { company: 'Eps', role: 'SDE' },
  ]);
  assert.deepEqual(
    offers.map((o) => o.company),
    ['Acme', 'Beta', 'Gamma', 'Delta'],
  );
  assert.equal(offers[1].id, 'y');
  assert.deepEqual([added, skipped], [3, 1]);
  assert.equal(start[1].company, '');
});
