import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { OjProblemPackage } from '../lib/oj-types';
import { parseSqlDataset } from '../lib/sql-dataset';

const packages = ['content/sql-track/packages.json', 'content/sql-track/pandas-packages.json'].flatMap(
  (file) => JSON.parse(readFileSync(file, 'utf8')) as OjProblemPackage[],
);

test('every SQL and pandas dataset parses to what SQLite holds after running it', () => {
  let cases = 0;
  for (const pkg of packages)
    for (const c of pkg.cases) {
      const label = `${pkg.problem.id} ${c.name}`;
      const parsed = parseSqlDataset(c.input);
      assert.ok(parsed, label);
      assert.equal(parsed.ordered, c.input.startsWith('-- cswork:ordered\n'), label);
      const db = new Database(':memory:');
      try {
        db.exec(c.input);
        const names = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY rowid")
          .pluck()
          .all() as string[];
        assert.deepEqual(parsed.tables.map((t) => t.name), names, label);
        for (const table of parsed.tables) {
          const info = db.prepare(`PRAGMA table_info("${table.name}")`).all() as {
            name: string;
            type: string;
            notnull: number;
            pk: number;
          }[];
          assert.deepEqual(
            table.columns.map(({ name, type, pk, notNull }) => ({ name, type, pk, notNull })),
            info.map((col) => ({ name: col.name, type: col.type, pk: col.pk > 0, notNull: col.notnull === 1 })),
            label,
          );
          assert.deepEqual(table.rows, db.prepare(`SELECT * FROM "${table.name}"`).raw().all(), label);
        }
      } finally {
        db.close();
      }
      cases++;
    }
  assert.equal(cases, 502);
  // Column notes are the schema's trailing comments.
  const employees = parseSqlDataset(packages[0].cases[0].input)!.tables.find((t) => t.name === 'employees')!;
  assert.equal(employees.columns.find((c) => c.name === 'manager_id')?.note, 'NULL: no manager');
  assert.equal(employees.columns.find((c) => c.name === 'name')?.note, undefined);
});

test('column lists, quotes, table keys and later markers parse; any other writing is null', () => {
  const create = 'CREATE TABLE t (\n  a INTEGER NOT NULL,\n  b TEXT, -- note, with comma\n  PRIMARY KEY (a, b)\n);\n';
  const parsed = parseSqlDataset(`-- cswork:index\n${create}INSERT INTO t (b, a) VALUES\n  ('it''s; (x), y', -2.5),\n  (NULL, 3);\n`);
  assert.deepEqual(parsed, {
    ordered: false,
    tables: [
      {
        name: 't',
        columns: [
          { name: 'a', type: 'INTEGER', pk: true, notNull: true },
          { name: 'b', type: 'TEXT', pk: true, notNull: false, note: 'note, with comma' },
        ],
        rows: [
          [-2.5, "it's; (x), y"],
          [3, null],
        ],
      },
    ],
  });
  assert.equal(parseSqlDataset(`-- cswork:ordered\n${create}`)?.ordered, true);
  for (const bad of [
    '',
    'SELECT 1;',
    'CREATE TABLE t (a INTEGER);',
    `${create}INSERT INTO u VALUES (1, 2);`,
    `${create}INSERT INTO t VALUES (1);`,
    `${create}INSERT INTO t (a) VALUES (1);`,
    `${create}INSERT INTO t VALUES (1, 'open`,
    `${create}INSERT INTO t VALUES (1, x'00');`,
    `${create}INSERT INTO t VALUES (9007199254740993, 'big');`,
    `${create}INSERT INTO t VALUES (1, 2)`,
    'CREATE TABLE t (\n  a INTEGER DEFAULT \'x\'\n);\n',
    `${create}${create}`,
  ])
    assert.equal(parseSqlDataset(bad), null, bad);
});
