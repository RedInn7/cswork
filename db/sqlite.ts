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
