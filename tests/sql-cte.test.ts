import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { ctePreview, explainQuery, parsePlan, planKind, SQL_NAMES, withClause, type PlanNode } from '../lib/sql-cte';
import { parseSqlResult } from '../lib/sql-result';
import { sqlRunner } from '../scripts/sql-track/build';

const runner = sqlRunner();
after(() => runner.close());

test('the leading WITH splits into its CTEs past strings, quoted names, comments and nesting', () => {
  const sql = `-- totals first
with "a b"(x, y) as (select ')', ',' /* ) , */), -- not here: )
  b AS MATERIALIZED (SELECT * FROM (WITH inner_ AS (SELECT 1) SELECT * FROM inner_)),
  [c] as not materialized (select 'it''s )' as s)
select * from b`;
  assert.deepEqual(withClause(sql), {
    head: 'WITH',
    ctes: [
      { name: 'a b', text: `"a b"(x, y) as (select ')', ',' /* ) , */)` },
      { name: 'b', text: 'b AS MATERIALIZED (SELECT * FROM (WITH inner_ AS (SELECT 1) SELECT * FROM inner_))' },
      { name: 'c', text: "[c] as not materialized (select 'it''s )' as s)" },
    ],
  });
  assert.equal(withClause('WITH RECURSIVE r(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM r) SELECT n FROM r')?.head, 'WITH RECURSIVE');
  for (const none of [
    'SELECT 1',
    'SELECT * FROM (WITH a AS (SELECT 1) SELECT * FROM a)',
    'WITH a AS (SELECT 1',
    'WITH a AS (SELECT 1)',
    'WITH a (SELECT 1) SELECT 1',
    "WITH a AS (SELECT ')') ",
  ])
    assert.equal(withClause(none), null, none);
});

const data = `CREATE TABLE emp (id INTEGER PRIMARY KEY, dept INTEGER, pay INTEGER);
CREATE INDEX emp_dept ON emp(dept);
INSERT INTO emp VALUES (1, 1, 10), (2, 1, 20), (3, 2, 30), (4, 2, 5);
`;

test('a CTE preview runs with every CTE defined and names its columns', () => {
  // `top` reads `totals`, defined after it would be fine too: all CTEs come along.
  const sql = `WITH totals AS (SELECT dept, SUM(pay) AS total FROM emp GROUP BY dept),
top(dept_id, best) AS (SELECT dept, total FROM totals WHERE total > 30)
SELECT * FROM top;`;
  const preview = ctePreview(sql, 'top')!;
  assert.ok(preview.startsWith(`${SQL_NAMES}\nWITH totals AS`));
  const result = runner.run(preview, data);
  assert.equal(result.ok, true, result.stderr);
  assert.equal(result.stdout, 'columns: 2\n[2, 35]\n');
  assert.equal(result.stderr, '["dept_id", "best"]\n');
  assert.equal(runner.run(ctePreview(sql, 'totals')!, data).stdout, 'columns: 2\n[1, 30]\n[2, 35]\n');
  assert.equal(ctePreview(sql, 'missing'), null);
  // A recursive CTE stops at the preview's row limit, its rows in the query's order, not the judge's text sort.
  const counted = runner.run(ctePreview('WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT 1', 'n')!, '');
  assert.deepEqual(parseSqlResult(counted.stdout)?.rows, Array.from({ length: 50 }, (_, i) => [i + 1]));
  const ranked = 'WITH r AS (SELECT id, ROW_NUMBER() OVER (ORDER BY pay DESC) AS rank FROM emp ORDER BY rank) SELECT * FROM r';
  assert.equal(runner.run(ctePreview(ranked, 'r')!, data).stdout, 'columns: 2\n[3, 1]\n[2, 2]\n[1, 3]\n[4, 4]\n');
  // A judged query is still sorted.
  assert.equal(runner.run(ranked, data).stdout, 'columns: 2\n[1, 3]\n[2, 2]\n[3, 1]\n[4, 4]\n');
});

const shape = (nodes: PlanNode[]): unknown[] =>
  nodes.map((node) => (node.children.length ? [node.detail, shape(node.children)] : node.detail));

test('EXPLAIN QUERY PLAN runs through the harness and parses into a SCAN / SEARCH tree', () => {
  const scan = runner.run(explainQuery('SELECT * FROM emp WHERE pay > 10'), data);
  assert.equal(scan.ok, true, scan.stderr);
  assert.deepEqual(shape(parsePlan(parseSqlResult(scan.stdout))!), ['SCAN emp']);
  const search = parsePlan(parseSqlResult(runner.run(explainQuery('-- by dept\nselect pay from emp where dept = 2;'), data).stdout));
  assert.match(String(shape(search!)), /^SEARCH emp USING INDEX emp_dept \(dept=\?\)$/);
  // Nested steps hang under their parent; the judge's text sort of the rows is undone.
  const nested = runner.run(
    explainQuery(
      'WITH m AS MATERIALIZED (SELECT dept, MAX(pay) AS top FROM emp GROUP BY dept) SELECT * FROM m ORDER BY top',
    ),
    data,
  );
  const tree = parsePlan(parseSqlResult(nested.stdout))!;
  const flat = (nodes: PlanNode[]): string[] => nodes.flatMap((node) => [node.detail, ...flat(node.children)]);
  assert.ok(tree.some((node) => /^MATERIALIZE m/.test(node.detail) && node.children.length > 0), JSON.stringify(tree));
  assert.ok(flat(tree).some((detail) => detail.startsWith('USE TEMP B-TREE FOR ORDER BY')));
  // Ids sort as numbers, not as the judge's JSON text.
  assert.deepEqual(
    shape(parsePlan({ columns: 4, rows: [[10, 2, 0, 'child'], [2, 0, 0, 'root'], [9, 0, 0, 'second']] })!),
    [['root', ['child']], 'second'],
  );
  // A self-join on a column without an index: SQLite builds an automatic index on every run, a warning.
  const joined = parsePlan(
    parseSqlResult(runner.run(explainQuery('SELECT a.id, b.id FROM emp a JOIN emp b ON a.pay = b.pay'), data).stdout),
  )!;
  const kinds = flat(joined).map((detail) => [detail, planKind(detail)]);
  assert.ok(kinds.some(([detail, kind]) => /^SEARCH b USING AUTOMATIC (?:PARTIAL )?COVERING INDEX/.test(detail!) && kind === 'warn'), JSON.stringify(kinds));
  assert.equal(planKind('SEARCH emp USING INDEX emp_dept (dept=?)'), 'ok');
  assert.equal(planKind('SEARCH emp USING INTEGER PRIMARY KEY (rowid=?)'), 'ok');
  assert.equal(planKind('SCAN emp'), 'warn');
  assert.equal(planKind('SCAN CONSTANT ROW'), undefined);
  assert.equal(planKind('USE TEMP B-TREE FOR ORDER BY'), 'warn');
  for (const bad of [
    null,
    { columns: 3, rows: [] },
    { columns: 4, rows: [['1', 0, 0, 'x']] },
    { columns: 4, rows: [[2, 1, 0, 'orphan']] },
  ])
    assert.equal(parsePlan(bad), null);
});
