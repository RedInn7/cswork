import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqlite } from './sqlite';
import * as schema from './schema';
export function getDb() {
  return drizzle(sqlite(), { schema });
}
