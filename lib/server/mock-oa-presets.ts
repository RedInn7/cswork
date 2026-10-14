import presetsFile from '@/lib/content/mock-oa-presets.json';
import type { Scoring, Slot } from '@/lib/mock-oa';
import { hiddenCompanies } from './env';

export type MockPreset = Omit<
  (typeof presetsFile)['companies'][number],
  'slots' | 'scoring'
> & { slots: Slot[]; scoring: Scoring };
export const MOCK_PRESETS_UPDATED = presetsFile.updated;
const presets = presetsFile.companies as MockPreset[];

/** Hidden companies (HIDDEN_COMPANIES) never appear, as presets or as aliases. */
export function shownMockPresets(hidden = hiddenCompanies()): MockPreset[] {
  return presets
    .filter((c) => !hidden.has(c.slug))
    .map((c) => ({ ...c, aliases: c.aliases.filter((a) => !hidden.has(a)) }))
    .filter((c) => c.aliases.length);
}

/** Public mock OA pages for the sitemap. */
export function mockOaPaths() {
  return [
    { path: '/mock-oa' },
    ...shownMockPresets().map((c) => ({ path: `/mock-oa/${c.slug}` })),
  ];
}
