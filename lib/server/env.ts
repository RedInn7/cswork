import { queries } from '@/db/sqlite';
import { hiddenCompanySlugs } from '@/lib/oa-company-brands';
export function setting(key: string): string {
  return process.env[key] || '';
}
export function database() {
  return queries;
}
/**
 * Companies taken down for now: HIDDEN_COMPANIES lists OA company slugs (e.g. "google").
 * Their OA problems leave the library, the judge and the status feed; nothing is deleted,
 * so clearing the setting (and restarting) brings them back.
 */
export function hiddenCompanies(): Set<string> {
  // Hiding a company hides the catalog and library slugs merged into it (lib/oa-company-brands.ts).
  return hiddenCompanySlugs(setting('HIDDEN_COMPANIES'));
}
/** ` AND <column> NOT LIKE 'oa-<slug>-%'` for every hidden company (hiddenCompanySlugs validates them). */
export const shownOaSql = (column: string) =>
  [...hiddenCompanies()].map((slug) => ` AND ${column} NOT LIKE 'oa-${slug}-%'`).join('');
export function origin(): string {
  return setting('APP_URL') || 'http://localhost:4317';
}
