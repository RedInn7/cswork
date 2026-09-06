import entries from "./content/ling-curated-500.json";

export type CuratedEntry = {
  number: number;
  sectionSlug: string;
  sectionTitle: string;
  sectionTitleEn: string;
  stage: "基础" | "核心" | "进阶";
  stageEn: "Foundation" | "Core" | "Advanced";
  reason: string;
  reasonEn: string;
};
export const LING_CURATED_ID = "ling-selected-500";
export const LING_CURATED_TITLE = "灵神题单精选";
export const curatedEntries = entries as CuratedEntry[];
export const curatedByNumber = new Map(
  curatedEntries.map((entry, index) => [
    entry.number,
    { ...entry, order: index + 1 },
  ]),
);
export const curatedSections = Array.from(
  new Map(
    curatedEntries.map((entry) => [
      entry.sectionSlug,
      {
        slug: entry.sectionSlug,
        title: entry.sectionTitle,
        titleEn: entry.sectionTitleEn,
      },
    ]),
  ).values(),
);
