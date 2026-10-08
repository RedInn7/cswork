import assert from 'node:assert/strict';

/** Only this source-defined no-input task has a singleton formal domain. */
export function assertFormalCoverage(entry, pkg) {
  if (entry.id === 'oa-pure-storage-8') {
    assert.equal(pkg.problem.id, entry.id);
    assert.equal(pkg.problem.checker, 'oa-binary-search-witness');
    assert.deepEqual(entry.oracleCoverage, {
      mode: 'exhaustive',
      inputs: [''],
    });
    assert.equal(
      pkg.cases.length,
      1,
      'No-input task must not inflate case counts',
    );
    assert.equal(pkg.cases[0].input, '');
    assert.equal(pkg.cases[0].hidden, false);
    return 'singleton';
  }
  assert(
    pkg.cases.some((c) => !c.hidden),
    'A public case is required',
  );
  assert(
    pkg.cases.filter((c) => c.hidden).length >= 20,
    'At least 20 hidden cases required',
  );
  return 'sampled';
}

/** Require broad oracle coverage, or an explicit exact finite-domain proof. */
export function assertOracleCoverage(entry, oracle, label = entry.id) {
  assert(Array.isArray(oracle), `${label}: oracle cases must be an array`);
  if (entry.id === 'oa-pure-storage-8')
    assert.deepEqual(entry.oracleCoverage, {
      mode: 'exhaustive',
      inputs: [''],
    });
  else if (oracle.length >= 120) return 'sampled';

  const exhaustive = entry.oracleCoverage;
  assert.equal(
    exhaustive?.mode,
    'exhaustive',
    `${label}: at least 120 oracle inputs or an exhaustive declaration is required`,
  );
  assert(
    Array.isArray(exhaustive.inputs) && exhaustive.inputs.length > 0,
    `${label}: exhaustive oracle inputs must be declared`,
  );
  assert(
    exhaustive.inputs.every((input) => typeof input === 'string'),
    `${label}: exhaustive oracle inputs must be strings`,
  );
  const expected = [...exhaustive.inputs].sort();
  assert.equal(
    new Set(expected).size,
    expected.length,
    `${label}: exhaustive input declaration contains duplicates`,
  );
  const actualInputs = oracle.map((item) => item.input).sort();
  assert(
    actualInputs.every((input) => typeof input === 'string'),
    `${label}: every oracle case must include an input string`,
  );
  assert.deepEqual(
    actualInputs,
    expected,
    `${label}: oracle cases must cover exactly the declared finite domain`,
  );
  return 'exhaustive';
}
