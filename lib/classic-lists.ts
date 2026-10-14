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
  /** Where the list is published: a URL, then how it was read. */
  source: string;
  /** Book lists name each problem by its number in the book: 剑指 Offer 07, 面试题 01.02. */
  refLabel?: { zh: string; en: string };
  /**
   * A LeetCode list's groups hold problem numbers. A book list's groups hold its
   * own problems in book order instead: the book number, the main-site LeetCode
   * twin (null when there is none) and the slug of its page on leetcode.cn.
   */
  groups: {
    nameZh: string;
    nameEn: string;
    numbers?: number[];
    refs?: { ref: string; lc: number | null; slug: string }[];
  }[];
};
export const classicLists = lists as ClassicList[];
export const classicList = (slug: string | null | undefined) =>
  classicLists.find((list) => list.slug === slug);

/** One row: a LeetCode number, a book problem, or a book problem and its twin. */
export type ClassicEntry = { number: number | null; ref: string | null; refSlug: string | null };
export const groupEntries = (group: ClassicList['groups'][number]): ClassicEntry[] =>
  group.refs?.map(({ ref, lc, slug }) => ({ number: lc, ref, refSlug: slug })) ??
  (group.numbers ?? []).map((number) => ({ number, ref: null, refSlug: null }));

/**
 * Each LeetCode list's judgeable problems (`judgeable` says which lc-<n> ids this site judges) and
 * how many are in `solved`: the list badges. ponytail: book lists are left out while most of their
 * problems have no judge here; add them once book problems get ids of their own.
 */
export function classicListProgress(solved: ReadonlySet<string>, judgeable: (id: string) => boolean) {
  return classicLists.flatMap((list) => {
    if (list.refLabel) return [];
    const ids = [...new Set(list.groups.flatMap((g) => g.numbers ?? []))].map((n) => `lc-${n}`).filter(judgeable);
    return ids.length
      ? [{ slug: list.slug, zh: list.nameZh, en: list.nameEn, total: ids.length, solved: ids.filter((id) => solved.has(id)).length }]
      : [];
  });
}

/** The source's link: its first token (the rest says how the list was read). */
export const sourceUrl = (list: ClassicList) => list.source.split(/\s/, 1)[0];

/** A book problem's own page on leetcode.cn, where the book lists are published. */
export const bookProblemUrl = (slug: string) =>
  /^[A-Za-z0-9-]+$/.test(slug)
    ? `https://leetcode.cn/problems/${slug}/`
    : 'https://leetcode.cn/problemset/';

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
  item: { number: number | null; titleZh: string; titleEn: string },
  english: boolean,
) =>
  (english ? item.titleEn : item.titleZh) ||
  item.titleEn ||
  item.titleZh ||
  (item.number ? `LeetCode ${item.number}` : english ? 'On leetcode.cn' : '力扣中国站原题');

/** A book problem's label, e.g. 剑指 Offer 07; empty for LeetCode lists. */
export const refLabel = (
  list: Pick<ClassicList, 'refLabel'>,
  ref: string | null,
  english: boolean,
) => (ref && list.refLabel ? `${english ? list.refLabel.en : list.refLabel.zh} ${ref}` : '');
