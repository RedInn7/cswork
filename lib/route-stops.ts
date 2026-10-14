// Route-map data for the curated collection. Client-safe: never import
// lib/ling-curated.ts here, it would pull the whole curated JSON into the bundle.

export type RouteGroup = { zh: string; en: string };
export type StageCount = { total: number; solved: number };
/** One entry of `collection.sections` as the list API returns it. */
export type RouteSectionInput = {
  slug: string;
  title: string;
  titleEn?: string;
  total: number;
  solved: number;
  stages?: Record<string, StageCount>;
  /** Companies whose interview reports map onto the stop, and how many reports. */
  companies?: number;
  reports?: number;
};
export type RouteStop = {
  slug: string;
  /** 0-based position on the line; the grid column is index + 1. */
  index: number;
  /** Two-digit stop number, "01".."35". */
  code: string;
  title: string;
  titleEn: string;
  shortZh: string;
  shortEn: string;
  group: RouteGroup;
  /** First stop of its run of same-group stops. */
  start: boolean;
  total: number;
  solved: number;
  stages?: Record<string, StageCount>;
  companies?: number;
  reports?: number;
};
/** A contiguous run of stops in one group; `from` is the 0-based index of its first stop. */
export type RouteRun = RouteGroup & { from: number; span: number };

export const ROUTE_SECTIONS: (RouteGroup & { slugs: string[] })[] = [
  { zh: '线性结构', en: 'Linear Structures', slugs: ['array-foundations', 'hash-counting', 'string-processing', 'two-pointers-windows', 'prefix-intervals', 'binary-search', 'stacks-heaps', 'greedy-scheduling'] },
  { zh: '链表与树', en: 'Lists & Trees', slugs: ['linked-list', 'binary-tree', 'binary-tree-paths', 'binary-tree-build', 'binary-search-tree'] },
  { zh: '图论', en: 'Graphs', slugs: ['grid-traversal', 'graph-connectivity', 'graph-topological', 'graph-shortest-path', 'graph-spanning-tree'] },
  { zh: '回溯', en: 'Backtracking', slugs: ['backtracking-enumeration', 'backtracking-strings', 'backtracking-constraints'] },
  { zh: '动态规划', en: 'Dynamic Programming', slugs: ['dp-foundations', 'dp-grid', 'dp-knapsack', 'dp-subsequence', 'dp-string', 'dp-palindrome', 'dp-state-machine', 'dp-stock', 'dp-scheduling', 'dp-search-game'] },
  { zh: '设计与位运算', en: 'Design & Bits', slugs: ['design-containers', 'design-cache-index', 'design-trie-serialization', 'bits-math'] },
];
export const OTHER_SECTION: RouteGroup = { zh: '其他', en: 'Other' };
export const STOP_NAMES: Record<string, [string, string]> = {
  'array-foundations': ['原地数组', 'In-place Arrays'], 'hash-counting': ['哈希计数', 'Hashing'],
  'string-processing': ['字符串', 'Strings'], 'two-pointers-windows': ['双指针滑窗', 'Two Pointers'],
  'prefix-intervals': ['前缀和区间', 'Prefix & Ranges'], 'binary-search': ['二分查找', 'Binary Search'],
  'stacks-heaps': ['单调栈与堆', 'Stacks & Heaps'], 'greedy-scheduling': ['贪心调度', 'Greedy'],
  'linked-list': ['链表', 'Linked Lists'], 'binary-tree': ['树的遍历', 'Tree Traversal'],
  'binary-tree-paths': ['树上路径', 'Tree Paths'], 'binary-tree-build': ['树的构造', 'Tree Building'],
  'binary-search-tree': ['二叉搜索树', 'BST'], 'grid-traversal': ['网格搜索', 'Grid Search'],
  'graph-connectivity': ['并查集', 'Union-Find'], 'graph-topological': ['拓扑排序', 'Topo Sort'],
  'graph-shortest-path': ['最短路', 'Shortest Paths'], 'graph-spanning-tree': ['生成树', 'Spanning Trees'],
  'backtracking-enumeration': ['回溯枚举', 'Enumeration'], 'backtracking-strings': ['拆分构造', 'Partitioning'],
  'backtracking-constraints': ['剪枝搜索', 'Pruning'], 'dp-foundations': ['动规入门', 'DP Basics'],
  'dp-grid': ['网格动规', 'Grid DP'], 'dp-knapsack': ['背包计数', 'Knapsack'],
  'dp-subsequence': ['子序列', 'Subsequences'], 'dp-string': ['字符串动规', 'String DP'],
  'dp-palindrome': ['回文区间', 'Palindromes'], 'dp-state-machine': ['状态机', 'State Machines'],
  'dp-stock': ['股票买卖', 'Stock Trading'], 'dp-scheduling': ['分段调度', 'Scheduling DP'],
  'dp-search-game': ['树形博弈', 'Tree & Game DP'], 'design-containers': ['迭代器设计', 'Iterators'],
  'design-cache-index': ['缓存索引', 'Caches'], 'design-trie-serialization': ['字典树序列化', 'Trie & Codec'],
  'bits-math': ['位运算', 'Bits & Math'],
};
/** OA topic labels: the 35 stops plus two OA-only topics that are not on the line. */
export const TOPIC_NAMES: Record<string, [string, string]> = {
  ...STOP_NAMES,
  simulation: ['模拟/实现', 'Simulation'],
  sql: ['SQL', 'SQL'],
};
/** Labels for OA problems that are neither coding nor SQL (oa-topics.json `k`). */
export const OA_KIND_NAMES: Record<string, [string, string]> = {
  mcq: ['概念题', 'Concept question'],
  other: ['非算法题', 'Non-algorithmic'],
};
/** A topic's short name in the locale; unknown slugs show as written. */
export const topicName = (slug: string, zh: boolean) =>
  Object.hasOwn(TOPIC_NAMES, slug) ? TOPIC_NAMES[slug][zh ? 0 : 1] : slug;
/** Line 500 practice for a topic, or null when the topic is not one of its stops. */
export const stopHref = (slug: string) =>
  Object.hasOwn(STOP_NAMES, slug) ? `/?view=problems&section=${slug}` : null;
/** The stop named by ?section= in this page's URL, or '' (also on the server). */
export function stopFromUrl() {
  if (typeof location === 'undefined') return '';
  const slug = new URLSearchParams(location.search).get('section') || '';
  return Object.hasOwn(STOP_NAMES, slug) ? slug : '';
}

/** A stop's topic frequency, or '' without reports. Report counts, never a probability. */
export function askedText(stop: { companies?: number; reports?: number }, zh: boolean) {
  const { companies = 0, reports = 0 } = stop;
  if (!companies) return '';
  return zh
    ? `${companies} 家公司考过 · 面经出现 ${reports} 次`
    : `asked by ${companies} ${companies === 1 ? 'company' : 'companies'} · in ${reports} ${reports === 1 ? 'report' : 'reports'}`;
}

const groupOf = new Map(
  ROUTE_SECTIONS.flatMap(({ zh, en, slugs }) => {
    const group: RouteGroup = { zh, en };
    return slugs.map((slug) => [slug, group] as const);
  }),
);

/** Stops in the order the server sends them, plus the contiguous group runs above them. */
export function routeStops(sections: readonly RouteSectionInput[]) {
  const runs: RouteRun[] = [];
  let previous: RouteGroup | undefined;
  const stops = sections.map((section, index): RouteStop => {
    const group = groupOf.get(section.slug) ?? OTHER_SECTION;
    const start = group !== previous;
    if (start) runs.push({ ...group, from: index, span: 1 });
    else runs[runs.length - 1].span++;
    previous = group;
    const titleEn = section.titleEn || section.title;
    // Unknown slugs fall back to their full titles.
    const [shortZh, shortEn] = Object.prototype.hasOwnProperty.call(STOP_NAMES, section.slug)
      ? STOP_NAMES[section.slug]
      : [section.title, titleEn];
    return {
      slug: section.slug,
      index,
      code: String(index + 1).padStart(2, '0'),
      title: section.title,
      titleEn,
      shortZh,
      shortEn,
      group,
      start,
      total: section.total,
      solved: section.solved,
      stages: section.stages,
      companies: section.companies,
      reports: section.reports,
    };
  });
  return { stops, runs };
}
