import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const shared = globalThis as typeof globalThis & {
  __csworkSqlite?: Database.Database;
};
export function sqlite() {
  if (!shared.__csworkSqlite) {
    const path = resolve(process.env.DATABASE_PATH || 'data/cswork.sqlite');
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const connection = new Database(path);
    connection.pragma('journal_mode = WAL');
    // SQLite's auto-checkpoint runs inside whichever commit crosses it, blocking that event loop for
    // seconds on this 8GB database. The OJ worker checkpoints from its own thread
    // (lib/server/oj-checkpointer.ts); this higher bound (80MB of WAL) is only the fallback.
    connection.pragma('wal_autocheckpoint = 20000');
    connection.pragma('foreign_keys = ON');
    connection.pragma('busy_timeout = 5000');
    shared.__csworkSqlite = connection;
  }
  return shared.__csworkSqlite;
}
type Value = string | number | null;
class Statement {
  constructor(
    private readonly sql: string,
    private readonly values: Value[] = [],
  ) {}
  bind(...values: Value[]) {
    return new Statement(this.sql, values);
  }
  first<T>() {
    return (
      (sqlite()
        .prepare(this.sql)
        .get(...this.values) as T | undefined) ?? null
    );
  }
  all<T>() {
    return {
      results: sqlite()
        .prepare(this.sql)
        .all(...this.values) as T[],
    };
  }
  run() {
    const statement = sqlite().prepare(this.sql);
    return statement.reader
      ? statement.all(...this.values)
      : statement.run(...this.values);
  }
}
export const queries = {
  prepare(sql: string) {
    return new Statement(sql);
  },
  batch(statements: Statement[]) {
    // All statements commit together or all roll back; never await inside this transaction.
    return sqlite().transaction(() =>
      statements.map((statement) => statement.run()),
    )();
  },
};
