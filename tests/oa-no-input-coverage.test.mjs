import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFormalCoverage,
  assertOracleCoverage,
} from '../scripts/oa-judge/oracle-coverage.mjs';

const fixture = () => ({
  entry: {
    id: 'oa-pure-storage-8',
    oracleCoverage: { mode: 'exhaustive', inputs: [''] },
  },
  pkg: {
    problem: { id: 'oa-pure-storage-8', checker: 'oa-binary-search-witness' },
    cases: [{ input: '', hidden: false }],
  },
});

test('source-defined empty input is exhaustively covered once', () => {
  const { entry, pkg } = fixture();
  assert.equal(assertFormalCoverage(entry, pkg), 'singleton');
  assert.equal(assertOracleCoverage(entry, [{ input: '' }]), 'exhaustive');
});

test('singleton exemption is bound to identity, checker and exact domain', () => {
  for (const mutate of [
    (f) => {
      f.entry.id = 'oa-google-1';
    },
    (f) => {
      f.pkg.problem.id = 'oa-google-1';
    },
    (f) => {
      f.pkg.problem.checker = 'tokens';
    },
    (f) => {
      delete f.entry.oracleCoverage;
    },
    (f) => {
      f.entry.oracleCoverage.inputs = ['x'];
    },
    (f) => {
      f.pkg.cases[0].input = 'x';
    },
    (f) => {
      f.pkg.cases[0].hidden = true;
    },
    (f) => {
      f.pkg.cases.push({ input: '', hidden: true });
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => assertFormalCoverage(f.entry, f.pkg));
  }
});

test('ordinary problems still require a public case and 20 hidden cases', () => {
  const entry = { id: 'oa-google-1' };
  const pkg = {
    cases: [
      { input: '', hidden: false },
      ...Array.from({ length: 20 }, () => ({ hidden: true })),
    ],
  };
  assert.equal(assertFormalCoverage(entry, pkg), 'sampled');
  pkg.cases.pop();
  assert.throws(() => assertFormalCoverage(entry, pkg));
  pkg.cases[0].hidden = true;
  assert.throws(() => assertFormalCoverage(entry, pkg));
});

test('empty-domain oracle cannot be omitted or duplicated', () => {
  const { entry } = fixture();
  assert.throws(() => assertOracleCoverage(entry, []));
  assert.throws(() =>
    assertOracleCoverage(entry, [{ input: '' }, { input: '' }]),
  );
  assert.throws(() => assertOracleCoverage(entry, [{ input: ' ' }]));
  assert.throws(() =>
    assertOracleCoverage(
      entry,
      Array.from({ length: 120 }, () => ({ input: '' })),
    ),
  );
});
