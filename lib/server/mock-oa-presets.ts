import presetsFile from '@/lib/content/mock-oa-presets.json';
import type { McqConfig, Scoring, Slot } from '@/lib/mock-oa';
import { hiddenCompanies } from './env';

export type MockPreset = Omit<
  (typeof presetsFile)['companies'][number],
  'slots' | 'scoring' | 'mcq'
> & { slots: Slot[]; scoring: Scoring; mcq?: McqConfig };
export const MOCK_PRESETS_UPDATED = presetsFile.updated;
const presets = presetsFile.companies as MockPreset[];

/** Hidden companies (HIDDEN_COMPANIES) never appear, as presets or as aliases. */
export function shownMockPresets(hidden = hiddenCompanies()): MockPreset[] {
  return presets
    .filter((c) => !hidden.has(c.slug))
    .map((c) => ({ ...c, aliases: c.aliases.filter((a) => !hidden.has(a)) }))
    .filter((c) => c.aliases.length);
}

/** The shown preset a company (or one of its aliases) is mocked under, if any. */
export const mockPresetFor = (slug: string) =>
  shownMockPresets().find((c) => c.slug === slug || c.aliases.includes(slug));

/** Public mock OA pages for the sitemap. */
export function mockOaPaths() {
  return [
    { path: '/mock-oa' },
    ...shownMockPresets().map((c) => ({ path: `/mock-oa/${c.slug}` })),
  ];
}
