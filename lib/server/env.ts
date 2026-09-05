import { queries } from '@/db/sqlite';
export function setting(key: string): string {
  return process.env[key] || '';
}
export function database() {
  return queries;
}
export function origin(): string {
  return setting('APP_URL') || 'http://localhost:4317';
}
