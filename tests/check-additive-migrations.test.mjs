import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../deploy/check-additive-migrations.sh', import.meta.url).pathname;

// A throwaway repo: one commit per case on top of a base with one migration.
function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-migrations-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
  const write = (path, text) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  git('init', '-q');
  git('config', 'user.email', 't@example.test');
  git('config', 'user.name', 't');
  write('drizzle/0000_base.sql', 'CREATE TABLE a (id text);\n');
  write('drizzle/meta/_journal.json', '{"entries":[0]}\n');
  write('db/schema.ts', 'export const a = 1;\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  const base = git('rev-parse', 'HEAD');
  const check = (files) => {
    git('checkout', '-q', base);
    git('checkout', '-q', '-B', `case-${Math.random().toString(36).slice(2)}`);
    for (const [path, text] of Object.entries(files)) write(path, text);
    git('add', '-A');
    git('commit', '-qm', 'case');
    return spawnSync('bash', [script, dir, base, git('rev-parse', 'HEAD')], { encoding: 'utf8' });
  };
  return { check, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('only new tables and indexes pass the release migration gate', () => {
  const { check, done } = repo();
  try {
    const ok = check({
      'drizzle/0001_lists.sql':
        'CREATE TABLE lists (id text, updated_at integer, deleted_at integer);\n--> statement-breakpoint\nCREATE INDEX lists_at ON lists (updated_at);\n',
      'drizzle/meta/0001_snapshot.json': '{}\n',
      'drizzle/meta/_journal.json': '{"entries":[0,1]}\n',
      'db/schema.ts': 'export const a = 1;\nexport const lists = 1;\n',
    });
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(ok.stdout.trim(), 'drizzle/0001_lists.sql');

    const drop = check({ 'drizzle/0001_x.sql': 'DROP TABLE a;\n', 'drizzle/meta/_journal.json': '{}\n' });
    assert.equal(drop.status, 1);
    assert.match(drop.stdout, /not additive/);

    const rename = check({ 'drizzle/0001_x.sql': 'ALTER TABLE a RENAME TO b;\n' });
    assert.equal(rename.status, 1);

    const edited = check({ 'drizzle/0000_base.sql': 'CREATE TABLE a (id text, x text);\n' });
    assert.equal(edited.status, 1);
    assert.match(edited.stdout, /existing migrations changed/);

    const sourceOnly = check({ 'db/schema.ts': 'export const a = 2;\n' });
    assert.equal(sourceOnly.status, 1);
    assert.match(sourceOnly.stdout, /without a new migration/);
  } finally {
    done();
  }
});
