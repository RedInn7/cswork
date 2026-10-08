/** Constructed histories with algebraic expectations, not a payment simulator. */
import assert from 'node:assert/strict';

export const CAPACITY = 200000;
export const MAX_I64 = 9223372036854775807n;
export const MIN_I64 = -9223372036854775808n;
export const capacityCaseNames = Object.freeze([
  'merchant-sort',
  'intent-retention',
  'duplicate-success-refund',
  'failure-retry-update',
  'refund-inclusive',
  'refund-expired',
  'refund-policies',
  'wide-integer-credit',
  'negative-start-refunded',
]);

export function makeCapacityCase(name, q = CAPACITY) {
  assert(capacityCaseNames.includes(name));
  assert(Number.isInteger(q) && q >= 32 && q <= CAPACITY);
  const commands = [];
  const balances = new Map();
  function add(command) {
    commands.push(`${commands.length + 1} ${command}`);
  }
  function init(id, value, limit = '') {
    add(`INIT ${id} ${value}${limit === '' ? '' : ` ${limit}`}`);
  }
  let rounds = 0;
  if (name === 'merchant-sort') {
    // Descending creation order; lexical order differs from numeric order.
    for (let i = q; i >= 1; i--) {
      init(`m${i}`, -i);
      balances.set(`m${i}`, BigInt(-i));
    }
  } else if (name === 'intent-retention') {
    init('m', -19);
    for (let i = 1; i < q; i++) add(`CREATE p${i} m ${i}`);
    balances.set('m', -19n);
  } else if (name === 'refund-policies') {
    init('zero', -3, 0);
    init('negative', -5, -1);
    init('missing', -7);
    rounds = Math.floor((q - 3) / 12);
    for (let i = 0; i < rounds; i++) {
      for (const merchant of ['zero', 'negative', 'missing']) {
        const p = `${merchant}${i}`;
        add(`CREATE ${p} ${merchant} 11`);
        add(`ATTEMPT ${p}`);
        add(`SUCCEED ${p}`);
        add(`REFUND ${p}`);
      }
    }
    balances.set('zero', -3n + 11n * BigInt(rounds));
    balances.set('negative', -5n);
    balances.set('missing', -7n);
  } else {
    const negative = name === 'negative-start-refunded';
    const wide = name === 'wide-integer-credit';
    const initial = negative ? MIN_I64 : wide ? MAX_I64 : -17n;
    const limit =
      name === 'refund-inclusive' || name === 'refund-expired' ? 2 : '';
    init('m', initial, limit);
    const widths = {
      'duplicate-success-refund': 6,
      'failure-retry-update': 8,
      'refund-inclusive': 5,
      'refund-expired': 6,
      'wide-integer-credit': 3,
      'negative-start-refunded': 4,
    };
    rounds = Math.floor((q - 1) / widths[name]);
    for (let i = 0; i < rounds; i++) {
      const p = `p${i}`;
      add(`CREATE ${p} m ${wide || negative ? MAX_I64 : 7}`);
      add(`ATTEMPT ${p}`);
      if (name === 'failure-retry-update') {
        add(`UPDATE ${p} 999`); // processing: ignored
        add(`FAIL ${p}`);
        add(`UPDATE ${p} 13`);
        add(`UPDATE ${p} -1`);
        add(`ATTEMPT ${p}`);
        add(`SUCCEED ${p}`);
      } else {
        add(`SUCCEED ${p}`);
        if (name === 'duplicate-success-refund') {
          add(`SUCCEED ${p}`);
          add(`REFUND ${p}`);
          add(`REFUND ${p}`);
        } else if (name === 'refund-inclusive' || name === 'refund-expired') {
          add('ATTEMPT absent');
          if (name === 'refund-expired') add('ATTEMPT absent');
          add(`REFUND ${p}`); // success+2 vs success+3
        } else if (negative) add(`REFUND ${p}`);
      }
    }
    const credit = wide
      ? MAX_I64
      : name === 'failure-retry-update'
        ? 13n
        : name === 'refund-expired'
          ? 7n
          : 0n;
    balances.set('m', initial + credit * BigInt(rounds));
  }
  while (commands.length < q) add('ATTEMPT absent');
  assert.equal(commands.length, q);
  const expectedOutput = `${balances.size}\n${[...balances.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => `${id} ${balances.get(id)}`)
    .join('\n')}\n`;
  return {
    name,
    q,
    rounds,
    input: `${q}\n${commands.join('\n')}\n`,
    expectedOutput,
  };
}

/** Holds only the current history: consumers must not collect this iterator. */
export function* capacityCases(q = CAPACITY) {
  for (const name of capacityCaseNames) yield makeCapacityCase(name, q);
}
