// The offer calculator's arithmetic (lib/offer-math.ts): vesting schedules, sign-on split, refreshers,
// growth, cliffs, the custom schedule's 100% rule, saved-offer cleanup and the tracker import; internship
// totals, cost-of-living adjustment, the decision matrix, the share payload and the BEA price parities.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import rpp from '../lib/content/rpp.json';
import {
  blankOffer,
  costAdjusted,
  decisionScore,
  DEFAULT_FACTORS,
  firstYearCash,
  FACTORS_MAX,
  fourYear,
  importOffers,
  internTotals,
  moneyScores,
  OFFERS_MAX,
  readDecision,
  readOffers,
  shareOffers,
  yearly,
  type Offer,
} from '../lib/offer-math';

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
    kind: 'fulltime',
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
    { company: ' acme ', role: 'swe', deadline: '2099-02-01' },
    { company: 'Beta', role: 'New grad', deadline: '2099-01-05' },
    { company: 'Gamma', role: '' },
    { company: 'Delta', role: 'SDE' },
    { company: 'Eps', role: 'SDE' },
  ]);
  assert.deepEqual(
    offers.map((o) => o.company),
    ['Acme', 'Beta', 'Gamma', 'Delta'],
  );
  assert.equal(offers[1].id, 'y');
  // A deadline goes only into a card the import fills, never over one already there.
  assert.deepEqual(
    offers.map((o) => o.deadline),
    ['', '2099-01-05', '', ''],
  );
  assert.deepEqual([added, skipped], [3, 1]);
  assert.equal(start[1].company, '');
});

test('the tracker import marks intern roles as internships, by the tracker rule', () => {
  const { offers } = importOffers(
    [],
    ['SWE Intern', 'Software Engineering Internship', '后端实习生', 'Internal Tools Engineer'].map((role) => ({ company: role, role })),
  );
  assert.deepEqual(
    offers.map((o) => o.kind),
    ['intern', 'intern', 'intern', 'fulltime'],
  );
});

test('internship pay: hourly × hours (blank = 40) × weeks, or monthly × 12/52 × weeks; extras on top; nothing without weeks', () => {
  const hourly = offer({ kind: 'intern', hourly: 50, weeks: 12, housing: 3000, housingMonthly: 1300, relocation: 1000, travel: 500 });
  assert.deepEqual(internTotals(hourly), { pay: 24000, gross: 32100, weekly: 2675, annualized: 104000 });
  assert.equal(internTotals({ ...hourly, hoursPerWeek: 35 }).pay, 21000);
  // The hourly rate wins over a monthly figure; a monthly one is used only without it.
  assert.equal(internTotals({ ...hourly, monthly: 99999 }).pay, 24000);
  assert.deepEqual(internTotals(offer({ kind: 'intern', monthly: 9100, weeks: 13 })), { pay: 27300, gross: 27300, weekly: 2100, annualized: 109200 });
  for (const weeks of [0, undefined, -4])
    assert.deepEqual(internTotals({ ...hourly, weeks }), { pay: 0, gross: 0, weekly: 0, annualized: 0 });
});

test('cost of living: divide by the price parity over 100; no parity leaves the figure alone', () => {
  assert.equal(Math.round(costAdjusted(118200, 118.2)), 100000);
  assert.equal(Math.round(costAdjusted(94400, 94.4)), 100000);
  assert.equal(costAdjusted(123, 0), 123);
});

test('saved internship fields are kept when well formed; old offers read as full-time', () => {
  const [intern, junk, old] = readOffers([
    { id: 'i', kind: 'intern', city: 'san-francisco', hourly: 55, hoursPerWeek: 40, weeks: 12, housingMonthly: 2000, travel: 400, housingProvided: true, returnOffer: 'likely' },
    { id: 'j', kind: 'boss', city: 'San Francisco!', hourly: '55', housingProvided: 'yes', returnOffer: 'maybe' },
    { id: 'o', company: 'Old', base: 1 },
  ]);
  assert.deepEqual(intern, {
    ...blankOffer('i'),
    kind: 'intern',
    city: 'san-francisco',
    hourly: 55,
    hoursPerWeek: 40,
    weeks: 12,
    housingMonthly: 2000,
    travel: 400,
    housingProvided: true,
    returnOffer: 'likely',
  });
  assert.deepEqual(junk, blankOffer('j'));
  assert.equal(old.kind, 'fulltime');
  assert.equal(readOffers([{ city: 'x'.repeat(41) }])[0].city, undefined);
});

test('the decision matrix: weighted mean of the factors scored, saved data cleaned up', () => {
  const factors = [
    { id: 'a', name: 'A', weight: 3 },
    { id: 'b', name: 'B', weight: 1 },
  ];
  assert.equal(decisionScore(factors, { a: 5, b: 1 }), 4);
  assert.equal(decisionScore(factors, { a: 2, b: 7 }), 2);
  assert.equal(decisionScore(factors, {}), null);
  assert.equal(decisionScore(factors, undefined), null);

  const fresh = readDecision(null);
  assert.deepEqual(
    fresh.factors.map((f) => [f.id, f.weight]),
    DEFAULT_FACTORS.map((id) => [id, 3]),
  );
  assert.deepEqual([fresh.scores, fresh.moneyWeight], [{}, 3]);
  const saved = readDecision({
    factors: [{ id: 'a', name: 'x'.repeat(50), weight: 9 }, { id: 'a', name: 'dup', weight: 1 }, null, { name: 'no id' }, ...Array.from({ length: 20 }, (_, i) => ({ id: `f${i}`, name: '', weight: 2 }))],
    scores: { o1: { a: 4, f0: 1.5, gone: 5 }, o2: { f1: 0 }, ['z'.repeat(41)]: { a: 3 } },
    moneyWeight: 5,
  });
  assert.equal(saved.factors.length, FACTORS_MAX);
  assert.deepEqual(saved.factors[0], { id: 'a', name: 'x'.repeat(40), weight: 3 });
  assert.deepEqual(saved.scores, { o1: { a: 4 } });
  assert.equal(saved.moneyWeight, 5);
  assert.deepEqual(readDecision({ factors: [] }).factors, []);
});

test('money scores map onto 1–5 within each kind; equal values are 3; alone or blank is null', () => {
  assert.deepEqual(
    moneyScores([
      { kind: 'fulltime', value: 100 },
      { kind: 'fulltime', value: 200 },
      { kind: 'fulltime', value: 150 },
      { kind: 'intern', value: 10 },
      { kind: 'intern', value: null },
      { kind: 'fulltime', value: null },
    ]),
    [1, 5, 3, null, null, null],
  );
  assert.deepEqual(
    moneyScores([
      { kind: 'intern', value: 7 },
      { kind: 'intern', value: 7 },
    ]),
    [3, 3],
  );
});

test('the share payload drops id, deadline and clawback, rounds money and can leave out the company', () => {
  const offers = [
    offer({ id: 'secret', company: 'Acme', role: 'SWE', deadline: '2099-01-01', clawbackNote: 'repay', base: 152500, grant: 401000, bonusPct: 12.5, relocation: 7400, city: 'seattle' }),
    offer({ id: 'x', kind: 'intern', company: 'Beta', hourly: 52.4, monthly: 8740, housingMonthly: 1260, relocation: 1200, weeks: 12 }),
  ];
  const [full, intern] = shareOffers(offers, { anon: false });
  assert.deepEqual(full, {
    kind: 'fulltime',
    company: 'Acme',
    role: 'SWE',
    schedule: 'even',
    base: 155000,
    grant: 400000,
    bonusPct: 12.5,
    relocation: 5000,
    city: 'seattle',
  });
  assert.deepEqual([intern.hourly, intern.monthly, intern.housingMonthly, intern.relocation, intern.weeks], [52, 8500, 1500, 1000, 12]);
  assert.deepEqual(
    shareOffers(offers, { anon: true }).map((o) => o.company),
    ['', ''],
  );
  assert.equal(offers[0].base, 152500);
  // A shared link reads back through the same cleanup, with fresh ids and no deadline.
  const back = readOffers(JSON.parse(JSON.stringify(shareOffers(offers, { anon: true }))));
  assert.deepEqual(
    back.map((o) => [o.kind, o.company, o.deadline, o.id === 'secret']),
    [
      ['fulltime', '', '', false],
      ['intern', '', '', false],
    ],
  );
});

test('the price parities are BEA metro table 4, as printed', () => {
  assert.equal(new URL(rpp.sourceUrl).hostname, 'www.bea.gov');
  assert.ok(Number.isInteger(rpp.year) && rpp.year >= 2020);
  const entries = Object.entries(rpp.values);
  assert.ok(entries.length >= 25);
  for (const [key, v] of entries) {
    assert.match(key, /^[a-z0-9-]{1,40}$/);
    assert.notEqual(key, 'remote');
    assert.ok(v.name_zh && v.name_en, key);
    assert.ok(v.rpp >= 70 && v.rpp <= 150, key);
    // One decimal, as the release prints it.
    assert.equal(Math.round(v.rpp * 10) / 10, v.rpp, key);
  }
  // Spot checks against table 4 of BEA 24-59 (2023).
  assert.equal(rpp.values['san-francisco'].rpp, 118.2);
  assert.equal(rpp.values['austin'].rpp, 97.6);
});
