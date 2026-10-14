import lcMapFile from '@/lib/content/company-lc-map.json';
import presetsFile from '@/lib/content/mock-oa-presets.json';

/** A company that reported asking a problem, with the rounds it came up in. */
export type CompanyTag = {
  slug: string;
  name: string;
  rounds: string[];
  /** Reported in an Online Assessment. */
  oa: boolean;
};
type MapEntry = { id: string; round: string; source: string };
type Preset = { slug: string; name: string; aliases: string[] };

const OA_ROUND = 'Online Assessment';
const byRank = (a: CompanyTag, b: CompanyTag) =>
  Number(b.oa) - Number(a.oa) ||
  b.rounds.length - a.rounds.length ||
  a.name.localeCompare(b.name, 'en');

/**
 * lc id → companies that asked it (lib/content/company-lc-map.json). Aliases merge
 * under their preset (tiktok + bytedance → one "TikTok / ByteDance"); hidden
 * companies are left out. Sorted OA first, then by rounds, then by name.
 */
export function companyTagIndex(
  hidden: ReadonlySet<string> = new Set(),
  map: Readonly<Record<string, readonly MapEntry[]>> = lcMapFile.companies,
  presets: readonly Preset[] = presetsFile.companies,
) {
  const owner = new Map<string, Preset>();
  for (const p of presets) for (const a of [p.slug, ...p.aliases]) owner.set(a, p);
  const index = new Map<string, Map<string, CompanyTag>>();
  for (const [slug, entries] of Object.entries(map)) {
    const company = owner.get(slug) ?? { slug, name: slug };
    if (hidden.has(slug) || hidden.has(company.slug)) continue;
    for (const { id, round } of entries) {
      if (!/^lc-\d{1,6}$/.test(id)) continue;
      const tags = index.get(id) ?? new Map<string, CompanyTag>();
      index.set(id, tags);
      const tag = tags.get(company.slug) ?? { slug: company.slug, name: company.name, rounds: [], oa: false };
      tags.set(company.slug, tag);
      if (!tag.rounds.includes(round)) tag.rounds.push(round);
      tag.oa ||= round === OA_ROUND;
    }
  }
  return new Map([...index].map(([id, tags]) => [id, [...tags.values()].sort(byRank)]));
}

/** Content coding question slug → the judgeable lc id it maps to. */
export const lcIdBySource = new Map(
  Object.values(lcMapFile.companies as Record<string, MapEntry[]>).flatMap((entries) =>
    entries.flatMap((e) => (/^lc-\d{1,6}$/.test(e.id) ? [[e.source, e.id] as const] : [])),
  ),
);
