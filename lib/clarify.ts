import { stressCases, type StressRule } from './stress-gen';
import type { Constraint, Message } from './testcase-fields';

/**
 * "Before you code" checklist (components/clarify-panel.tsx): what to ask the interviewer, read
 * off the parameter types and the statement's bounds (lib/content/leetcode-constraints.json).
 * `answer` is what the bounds already say; `cases` are custom cases (one JSON line per
 * parameter) the learner can add, only where an input is certainly valid.
 */
export type ClarifyItem = { key: string; question: Message; answer?: Message; cases: string[] };
type Param = { name: string; type: string };

const INT32 = 2 ** 31 - 1;
const isNode = (type: string) => type === 'TreeNode' || type === 'ListNode';
const isString = (type: string) => /^string$/i.test(type);
const isArray = (type: string) => /\[\]$|^list</.test(type);
const isContainer = (type: string) => isArray(type) || isString(type) || isNode(type);
const hasText = (type: string) => /string|character/i.test(type);

/** 10^9, −2^31, 3×10^9, 2^16−1: bounds as a statement writes them, exactly; 999999 stays 999999. */
export function bound(x: number): string {
  const sign = x < 0 ? '−' : '';
  const a = Math.abs(x);
  if (a < 10000 || !Number.isInteger(a)) return `${sign}${a}`;
  const k = Math.floor(Math.log10(a));
  // At most three significant digits: 1.5×10^5, never a rounded 2.68×10^8.
  if (a % 10 ** (k - 2) === 0) {
    const m = +(a / 10 ** k).toPrecision(3);
    return `${sign}${m === 1 ? '' : `${m}×`}10^${k}`;
  }
  if (Number.isInteger(Math.log2(a))) return `${sign}2^${Math.log2(a)}`;
  if (Number.isInteger(Math.log2(a + 1))) return `${sign}2^${Math.log2(a + 1)}−1`;
  return `${sign}${a}`;
}

/**
 * The smallest input: a whitelisted problem (lib/content/stress-safe.json takes any input within
 * its bounds) draws one at every minimum length; otherwise a lone container parameter that may
 * be empty is empty. null when neither holds: other inputs can break the statement's guarantees.
 */
function minimalCase(params: Param[], constraints: Record<string, Constraint>, rules?: Record<string, StressRule> | null) {
  if (rules) {
    const least = (range?: number[]) => range && [range[0], range[0]];
    const bounds = Object.fromEntries(
      params.map(({ name }) => {
        const c: StressRule = { ...constraints[name], ...rules[name] };
        return [name, { ...c, ...(c.len && { len: least(c.len) }), ...(c.cols && { cols: least(c.cols) }) }];
      }),
    );
    const drawn = stressCases(params, bounds, {}, 1)?.[0];
    if (drawn) return drawn;
  }
  const [only] = params;
  if (params.length === 1 && isContainer(only.type) && constraints[only.name]?.len?.[0] === 0)
    return isString(only.type) ? '""' : '[]';
  return null;
}

export function clarifyItems(
  params: Param[],
  constraints: Record<string, Constraint> | null,
  rules?: Record<string, StressRule> | null,
): ClarifyItem[] {
  const bounds = constraints ?? {};
  const items: ClarifyItem[] = [];
  const containers = params.filter((p) => isContainer(p.type));
  const sized = containers.filter((p) => bounds[p.name]?.len);
  if (sized.length) {
    const min = minimalCase(params, bounds, rules);
    const zh = sized.map(({ name, type }) => {
      const lo = bounds[name].len![0];
      const unit = isNode(type) ? '个节点' : isString(type) ? '个字符' : '个元素';
      return lo === 0 ? `${name} 可以为空` : `${name} 至少 ${lo} ${unit}`;
    });
    const en = sized.map(({ name, type }) => {
      const lo = bounds[name].len![0];
      const unit = isNode(type) ? 'node' : isString(type) ? 'character' : 'element';
      return lo === 0 ? `${name} can be empty` : `${name} has at least ${lo} ${unit}${lo === 1 ? '' : 's'}`;
    });
    items.push({
      key: 'empty',
      question: ['输入能为空吗？最小规模是多少？', 'Can the input be empty? How small can it get?'],
      answer: [`${zh.join('；')}。`, `${en.join('; ')}.`],
      cases: min ? [min] : [],
    });
  }
  const valued = params.filter((p) => !hasText(p.type) && bounds[p.name]?.val);
  if (valued.length) {
    const negative = valued.filter((p) => bounds[p.name].val![0] < 0);
    items.push({
      key: 'negative',
      question: ['会有负数吗？值的范围多大？', 'Can values be negative? How large do they get?'],
      answer: negative.length
        ? [
            `有负数：${negative.map((p) => `${p.name} 最小 ${bound(bounds[p.name].val![0])}`).join('，')}。`,
            `Yes: ${negative.map((p) => `${p.name} goes down to ${bound(bounds[p.name].val![0])}`).join(', ')}.`,
          ]
        : [
            `没有负数：${valued.map((p) => `${p.name} 在 [${bound(bounds[p.name].val![0])}, ${bound(bounds[p.name].val![1])}]`).join('，')}。`,
            `No: ${valued.map((p) => `${p.name} is in [${bound(bounds[p.name].val![0])}, ${bound(bounds[p.name].val![1])}]`).join(', ')}.`,
          ],
      cases: [],
    });
  }
  // The largest sum of one array, tree or list: its most elements (or nodes) times its largest magnitude.
  const overflows = params.flatMap(({ name, type }) => {
    const { len, val } = bounds[name] ?? {};
    if ((!isArray(type) && !isNode(type)) || hasText(type) || !len || !val) return [];
    const top = Math.max(Math.abs(val[0]), Math.abs(val[1]));
    return len[1] * top > INT32 ? [`${name}: ${bound(len[1])} × ${bound(top)} = ${bound(len[1] * top)}`] : [];
  });
  if (overflows.length)
    items.push({
      key: 'overflow',
      question: ['中间结果会超出 32 位整数吗？', 'Can intermediate results overflow 32 bits?'],
      answer: [
        `会。长度（节点数）上限乘以 |值| 上限（${overflows.join('；')}）超过 2^31−1，求和可能超出 32 位：Java 和 C++ 用 long。`,
        `Yes. Longest length (or node count) times largest |value| (${overflows.join('; ')}) exceeds 2^31−1, so a sum can overflow 32 bits: use long in Java and C++.`,
      ],
      cases: [],
    });
  const texts = params.filter((p) => hasText(p.type));
  if (texts.length)
    items.push({
      key: 'charset',
      question: ['字符串里会出现哪些字符？区分大小写吗？', 'Which characters can appear? Is case significant?'],
      answer: [
        `${texts.map((p) => p.name).join('、')} 含字符：题面约束写了字符集就照它来；没写就问清只有小写字母，还是也有大写、数字、空格和标点。`,
        `${texts.map((p) => p.name).join(', ')} hold${texts.length === 1 ? 's' : ''} characters: follow the alphabet in the constraints; if none is given, ask whether it is only lowercase letters or also uppercase, digits, spaces and punctuation.`,
      ],
      cases: [],
    });
  const nodes = params.filter((p) => isNode(p.type) || p.type === 'ListNode[]');
  if (nodes.length) {
    const [only] = params;
    const range = bounds[only.name]?.len;
    const val = bounds[only.name]?.val;
    // A lone tree or list of at most one node: one node valued 1 (or the lowest value allowed).
    const single =
      params.length === 1 && isNode(only.type) && range && range[0] <= 1 && range[1] >= 1
        ? [`[${val && (val[0] > 1 || val[1] < 1) ? val[0] : 1}]`]
        : [];
    items.push({
      key: 'nodes',
      question: ['树或链表会是空的、只有一个节点吗？', 'Can the tree or list be empty, or a single node?'],
      answer: [
        `${nodes.map((p) => p.name).join('、')}：空的（null）和只有一个节点都要单独想一遍；根或头结点会不会变，要不要哑结点。`,
        `${nodes.map((p) => p.name).join(', ')}: think through null and a single node separately, whether the root or head can change, and whether a dummy node helps.`,
      ],
      cases: single,
    });
  }
  if (params.some((p) => isArray(p.type) || isString(p.type)))
    items.push(
      { key: 'duplicates', question: ['有重复元素吗？', 'Can elements repeat?'], cases: [] },
      { key: 'sorted', question: ['输入是有序的吗？', 'Is the input sorted?'], cases: [] },
    );
  items.push({ key: 'answers', question: ['有多个解时，返回任意一个还是全部？', 'With several answers, return any one or all of them?'], cases: [] });
  if (containers.length)
    items.push({ key: 'mutate', question: ['可以直接修改输入吗？', 'May I modify the input in place?'], cases: [] });
  return items;
}

/**
 * The custom cases after adding `inputs` in order (problem-workspace.tsx): ones already there are
 * skipped, a lone blank case is replaced, at most `max` are kept. `index` selects the last input
 * now among them (−1: none), `left` counts the ones that didn't fit.
 */
export function mergeCases(cases: string[], inputs: string[], max: number) {
  const next = cases.length === 1 && !cases[0] ? [] : [...cases];
  let left = 0;
  for (const input of inputs)
    if (next.includes(input)) continue;
    else if (next.length < max) next.push(input);
    else left++;
  const last = inputs.findLast((input) => next.includes(input));
  return { cases: next, index: last === undefined ? -1 : next.indexOf(last), left };
}
