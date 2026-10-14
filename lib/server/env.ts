import { queries } from '@/db/sqlite';
import {
  companyAliases,
  employerSlug,
  libraryCompanyAliases,
} from '@/lib/oa-company-brands';
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
  const hidden = new Set(
    setting('HIDDEN_COMPANIES')
      .split(',')
      .map((slug) => slug.trim().toLowerCase())
      .filter((slug) => /^[a-z0-9-]{1,80}$/.test(slug)),
  );
  // Hiding a company hides the catalog and library slugs merged into it (lib/oa-company-brands.ts).
  for (const [alias, slug] of Object.entries(companyAliases))
    if (hidden.has(slug)) hidden.add(alias);
  for (const alias of Object.keys(libraryCompanyAliases))
    if (hidden.has(employerSlug(alias))) hidden.add(alias);
  return hidden;
}
/** ` AND <column> NOT LIKE 'oa-<slug>-%'` for every hidden company (slugs are validated above). */
export const shownOaSql = (column: string) =>
  [...hiddenCompanies()].map((slug) => ` AND ${column} NOT LIKE 'oa-${slug}-%'`).join('');
export function origin(): string {
  return setting('APP_URL') || 'http://localhost:4317';
}
