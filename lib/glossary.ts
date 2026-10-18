// The Chinese–English algorithm glossary (/topics/glossary): terms in both languages with an
// interview sentence to read aloud. Client-safe; the ⌘K palette imports it on demand.
import data from './content/glossary.json';

export type GlossaryGroup = 'basics' | 'array' | 'ds' | 'tree-graph' | 'dp' | 'search' | 'math';
export type GlossaryTerm = {
  id: string;
  zh: string;
  en: string;
  /** Other English names and abbreviations, searchable and shown with the term. */
  alt?: string[];
  /** One interview sentence that uses the term (en or an alt). */
  say: string;
  /** The Line 500 stop (/topics/<stop>) that teaches it. */
  stop?: string;
  group: GlossaryGroup;
};

export const GLOSSARY = data as GlossaryTerm[];
export const GLOSSARY_GROUPS: [GlossaryGroup, string, string][] = [
  ['basics', '基础与复杂度', 'Basics & complexity'],
  ['array', '数组与字符串', 'Arrays & strings'],
  ['ds', '数据结构', 'Data structures'],
  ['tree-graph', '树与图', 'Trees & graphs'],
  ['dp', '动态规划', 'Dynamic programming'],
  ['search', '搜索、回溯与贪心', 'Search, backtracking & greedy'],
  ['math', '数学与位运算', 'Math & bits'],
];
export const glossaryHref = (id: string) => `/topics/glossary#term-${id}`;

/** Terms whose Chinese, English or alternative names contain `q`, prefix matches first. */
export function glossaryHits(q: string) {
  const query = q.trim().toLocaleLowerCase();
  if (!query) return [];
  const names = (t: GlossaryTerm) => [t.zh, t.en, ...(t.alt ?? [])].map((n) => n.toLocaleLowerCase());
  return GLOSSARY.filter((t) => names(t).some((n) => n.includes(query))).sort(
    (a, b) => Number(!names(a).some((n) => n.startsWith(query))) - Number(!names(b).some((n) => n.startsWith(query))),
  );
}
