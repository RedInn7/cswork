import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSqlResults, parseSqlResult, sqlCellText, SQL_DIFF_MAX_ROWS } from '../lib/sql-result';

const table = (columns: number, ...rows: unknown[][]) =>
  `columns: ${columns}\n${rows.map((row) => JSON.stringify(row) + '\n').join('')}`;

void test('the judge output parses back into a table; anything else is not a result', () => {
  assert.deepEqual(parseSqlResult(table(2, ['a', 1], ['b', null])), {
    columns: 2,
    rows: [
      ['a', 1],
      ['b', null],
    ],
  });
  assert.deepEqual(parseSqlResult('columns: 3\n'), { columns: 3, rows: [] });
  // A runtime error, a cut-off output, a ragged row.
  assert.equal(parseSqlResult('SQL 错误 / SQL error: no such column'), null);
  assert.equal(parseSqlResult('columns: 2\n["a", 1]\n["b", '), null);
  assert.equal(parseSqlResult('columns: 2\n["a"]\n'), null);
  assert.equal(parseSqlResult(''), null);
});

void test('rows diff as same, missing, extra and changed; changed rows name their columns', () => {
  const kinds = (expected: string, actual: string) =>
    diffSqlResults(parseSqlResult(expected)!, parseSqlResult(actual)!)!.map((row) =>
      row.kind === 'changed' ? `changed:${row.columns.join(',')}` : row.kind,
    );
  // Identical results.
  assert.deepEqual(kinds(table(1, [1], [2]), table(1, [1], [2])), ['same', 'same']);
  // One row missing, one extra, one changed in its second column.
  assert.deepEqual(
    kinds(table(2, ['a', 1], ['b', 2], ['c', 3]), table(2, ['a', 1], ['b', 5], ['c', 3], ['d', 4])),
    ['same', 'changed:1', 'same', 'extra'],
  );
  assert.deepEqual(kinds(table(1, [1], [2], [3]), table(1, [1], [3])), ['same', 'missing', 'same']);
  // Text '3' is not the number 3: a changed cell.
  assert.deepEqual(kinds(table(1, [3]), table(1, ['3'])), ['changed:0']);
  // Different widths never pair up as changed rows.
  assert.deepEqual(kinds(table(1, [1]), table(2, [1, 2])), ['missing', 'extra']);
  // Too many rows: no diff, the raw text is shown instead.
  const big = table(1, ...Array.from({ length: SQL_DIFF_MAX_ROWS + 1 }, (_, k) => [k]));
  assert.equal(diffSqlResults(parseSqlResult(big)!, parseSqlResult(table(1, [1]))!), null);
});

void test('cells read like the result: NULL, numbers, text quoted only when asked', () => {
  assert.equal(sqlCellText(null), 'NULL');
  assert.equal(sqlCellText(1.5), '1.5');
  assert.equal(sqlCellText('3'), '3');
  assert.equal(sqlCellText('3', true), '"3"');
  assert.equal(sqlCellText({ blob: '00ff' }), "x'00ff'");
  assert.equal(sqlCellText({ float: 'inf' }), 'inf');
});
