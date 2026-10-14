import lists from './content/classic-lists.json';

/**
 * A public problem list mapped onto this bank by LeetCode number. Only facts are
 * stored (numbers and their grouping); the list's name belongs to its publisher,
 * so pages call it a mapping and never claim it is official. Client-safe.
 */
export type ClassicList = {
  slug: string;
  nameZh: string;
  nameEn: string;
  /** Where the list is published; shown as the source. */
  source: string;
  groups: { nameZh: string; nameEn: string; numbers: number[] }[];
};
export const classicLists = lists as ClassicList[];
export const classicList = (slug: string | null | undefined) =>
  classicLists.find((list) => list.slug === slug);

/** A problem judged elsewhere: leetcode.cn for Chinese readers, leetcode.com for English. */
export function leetcodeUrl(number: number, slug: string, english: boolean) {
  const origin = english ? 'https://leetcode.com' : 'https://leetcode.cn';
  // Numbers missing from the bank have no known slug; search by number instead.
  return /^[a-z0-9-]+$/.test(slug)
    ? `${origin}/problems/${slug}/`
    : `${origin}/problemset/?search=${number}`;
}

/** Workspace URLs, for the public pages that link into the app. */
export const classicListAppHref = (slug: string) =>
  `/?${new URLSearchParams({ view: 'problems', library: slug })}`;
export const problemAppHref = (judgeProblemId: string) =>
  `/?${new URLSearchParams({ view: 'problem', problem: judgeProblemId })}`;

const LEVELS: [key: string, zh: string, en: string][] = [
  ['easy', '简单', 'Easy'],
  ['medium', '中等', 'Medium'],
  ['hard', '困难', 'Hard'],
];
/** The stored difficulty in any spelling (简单 / Easy / easy), as [key, 中文, English]. */
export const levelOf = (value: string) =>
  LEVELS.find((level) =>
    level.some((name) => name.toLowerCase() === value.toLowerCase()),
  );

/** A row title in the reader's language; numbers missing from the bank get a plain label. */
export const problemTitle = (
  item: { number: number; titleZh: string; titleEn: string },
  english: boolean,
) =>
  (english ? item.titleEn : item.titleZh) ||
  item.titleEn ||
  item.titleZh ||
  `LeetCode ${item.number}`;
