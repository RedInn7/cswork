import { env } from 'cloudflare:workers';
export function setting(key: string): string {
  const value =
    (env as unknown as Record<string, unknown>)[key] ?? process.env[key];
  return typeof value === 'string' ? value : '';
}
export function database(): D1Database {
  if (!env.DB) throw new Error('DB unavailable');
  return env.DB;
}
export function origin(): string {
  return setting('APP_URL') || 'http://localhost:4317';
}
