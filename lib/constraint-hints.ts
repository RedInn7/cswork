/**
 * Hints read off a problem's bounds, no AI and no server: the complexity budget its largest
 * input allows (components/constraint-hints.tsx, folded until asked for), and after WA / TLE /
 * RE / MLE a short list of things to check, those the code's tokens or stderr confirm first.
 * Like lib/code-analyzer.ts, a rule that cannot be sure says nothing. Client-safe.
 */
import { analyze, isAnalyzerLanguage, loopLines, tokenize, type Token } from './code-analyzer';
import { bound, clarifyItems } from './clarify';
import type { Constraint, Message } from './testcase-fields';

/** The input size `n` and its name as the hint prints it; `val`: the largest element value, when known. */
export type Bounds = { n: number; name: string; val?: number };
export type Check = { id: string; zh: string; en: string; href?: string; line?: number };
type Param = { name: string; type: string };

const INT32 = 2 ** 31 - 1;
const LIMIT = 1e8;

// ------------------------------------------------------------------ bounds

/**
 * LeetCode parameters: the longest 1-D array, string, tree or list; without any, an integer
 * n, m or k. null with a 2-D array or a list of words or lists (row and word lengths are a
 * second size), or when a container's length is unknown.
 */
export function lcBounds(params: Param[] | null | undefined, constraints: Record<string, Constraint> | null | undefined): Bounds | null {
  if (!params?.length || !constraints) return null;
  if (params.some((p) => /\]\[\]$|^list<(list|string)|^string\[\]$|^ListNode\[\]$/i.test(p.type))) return null;
  const nodes = (type: string) => type === 'TreeNode' || type === 'ListNode';
  const containers = params.filter((p) => /\[\]$|^string$/i.test(p.type) || nodes(p.type));
  if (containers.length) {
    if (containers.some((p) => !constraints[p.name]?.len)) return null;
    const top = containers.reduce((a, b) => (constraints[b.name].len![1] > constraints[a.name].len![1] ? b : a));
    return { n: constraints[top.name].len![1], name: nodes(top.type) ? 'n' : `${top.name}.length` };
  }
  const sized = params.filter((p) => /^(n|m|k)$/.test(p.name) && /^(integer|long)$/.test(p.type) && constraints[p.name]?.val);
  if (!sized.length) return null;
  const top = sized.reduce((a, b) => (constraints[b.name].val![1] > constraints[a.name].val![1] ? b : a));
  return { n: constraints[top.name].val![1], name: top.name };
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const LE = String.raw`\s*(?:≤|<=|⩽|\\leq?)\s*`;
const POW = String.raw`10(?:\^\{?\d+\}?|[${SUP}]+)`;
// 2·10^5, 2×10⁵, 10^5, 1e5, 200,000, 200000
const NUM = String.raw`(\d+(?:\.\d+)?\s*[·×x*]\s*${POW}|${POW}|\d+(?:\.\d+)?e\d+|\d{1,3}(?:,\d{3})+|\d+)`;
const SIZE = new RegExp(String.raw`(?<![\w.])((?:\w+\.)?(?:length|len)|[nmqNMQ])${LE}${NUM}`, 'g');
const VALUE = new RegExp(String.raw`(?<![\w.])[A-Za-z]\w*(?:\[[a-z]\]|_\{?i\}?)\|?${LE}${NUM}`, 'g');

function parseNum(text: string) {
  const s = text.replace(new RegExp(`[${SUP}]+`, 'g'), (d) => `^${[...d].map((c) => SUP.indexOf(c)).join('')}`).replace(/[\s,{}]/g, '');
  const pow = /^(?:(\d+(?:\.\d+)?)[·×x*])?10\^(\d+)$/.exec(s);
  return pow ? (pow[1] ? Number(pow[1]) : 1) * 10 ** Number(pow[2]) : Number(s);
}

/**
 * An OA statement's bounds (`statement.input + description`): the largest `n ≤ 2·10^5` among
 * n, m, q, len and length, and the largest `a[i] ≤ 10^9`. A bound that is not a number (k ≤ n)
 * is skipped; T counts test cases, not size.
 */
export function statementBounds(text: string): Bounds | null {
  let best: Bounds | null = null;
  for (const [, name, num] of text.matchAll(SIZE)) {
    const n = parseNum(num);
    if (Number.isFinite(n) && n > 0 && (!best || n > best.n)) best = { n, name };
  }
  if (!best) return null;
  const vals = [...text.matchAll(VALUE)].map(([, num]) => parseNum(num)).filter(Number.isFinite);
  return vals.length ? { ...best, val: Math.max(...vals) } : best;
}

/** LeetCode bounds first; an OA problem falls back to its statement's. */
export const problemBounds = (id: string, params: Param[] | null | undefined, constraints: Record<string, Constraint> | null | undefined, text: string) =>
  lcBounds(params, constraints) ?? (id.startsWith('oa-') ? statementBounds(text) : null);

// ------------------------------------------------------------------ budget

const CLASSES: [string, (n: number) => number][] = [
  ['n!', (n) => {
    let f = 1;
    for (let i = 2; i <= n && f !== Infinity; i++) f *= i;
    return f;
  }],
  ['2ⁿ·n', (n) => 2 ** n * n],
  ['n³', (n) => n ** 3],
  ['n²', (n) => n ** 2],
  ['n log n', (n) => n * Math.log2(n)],
  ['n', (n) => n],
];

/** The slowest of six classes that stays within 10^8 operations, and the next slower one; null past O(n). */
export function budget(b: Bounds, language: string) {
  const i = CLASSES.findIndex(([, ops]) => ops(b.n) <= LIMIT);
  if (i < 0) return null;
  const ops = CLASSES[i][1](b.n);
  return {
    target: `O(${CLASSES[i][0]})`,
    ops,
    ...(i > 0 && { slower: { cls: `O(${CLASSES[i - 1][0]})`, ops: CLASSES[i - 1][1](b.n) } }),
    // CPython manages about 10^7 simple steps a second.
    pythonTight: language === 'python' && ops > 1e7,
  };
}

/** 1.7×10^6, 10^10: two significant digits, the way bounds are written. */
const approx = (x: number) => (x >= 1e21 ? `10^${Math.floor(Math.log10(x))}` : bound(Number(x.toPrecision(2))));

/** The budget as one sentence; null when there is none. */
export function budgetMessage(b: Bounds, language: string): Message | null {
  const r = budget(b, language);
  if (!r) return null;
  const head = `${b.name} ≤ ${bound(b.n)}`;
  return [
    `${head} → 每秒约 10^7–10^8 次运算 → 目标 ${r.target} 或更快${r.slower ? `；${r.slower.cls} ≈ ${approx(r.slower.ops)} 次，太慢` : ''}。` +
      (r.pythonTight ? `Python 每秒大约只有 10^7 次简单操作，${r.target} 在这里约 ${approx(r.ops)} 次，已经偏紧：内层循环少调函数，多用内置函数。` : ''),
    `${head} → about 10^7–10^8 operations a second → aim for ${r.target} or better${r.slower ? `; ${r.slower.cls} ≈ ${approx(r.slower.ops)} is too slow` : ''}.` +
      (r.pythonTight ? ` Python manages only about 10^7 simple steps a second, and ${r.target} is about ${approx(r.ops)} here, so it is tight: keep function calls out of inner loops and lean on built-ins.` : ''),
  ];
}

// ------------------------------------------------------------------ failure checks

const VERDICTS = new Set(['wrong_answer', 'time_limit', 'runtime_error', 'memory_limit']);
const TLE_NOTES = new Set(['py-list-front', 'py-list-membership', 'py-sort-in-loop', 'py-no-memo', 'py-string-concat', 'java-string-concat', 'cpp-string-concat', 'go-string-concat', 'cpp-copy-in-recursion']);
const RECURSION = '/judge-environment#recursion';
const IO = '/judge-environment#io';

const check = (id: string, [zh, en]: Message, extra?: { href?: string; line?: number }): Check => ({ id, zh, en, ...extra });

/** `int x` later grown with `x +=` or `x *=` (not by a constant): its line. */
function intGrows(t: Token[]) {
  const ints = new Set(t.flatMap((x, i) => (x.v === 'int' && t[i + 1]?.k === 'id' && ['=', ';', ',', ')', ':'].includes(t[i + 2]?.v) ? [t[i + 1].v] : [])));
  return t.find(
    (x, i) => x.k === 'id' && ints.has(x.v) && t[i - 1]?.v !== '.' && (t[i + 1]?.v === '+=' || t[i + 1]?.v === '*=') && !(t[i + 2]?.k === 'num' && t[i + 3]?.v === ';'),
  );
}

// ponytail: names of small direction / alphabet tables; a loop over one is not a second size.
const SMALL_TABLE = /^(dirs?|directions?|moves|neighbou?rs|ascii_\w+|string)$/i;
const NOT_BOUND = new Set(['range', 'enumerate', 'zip', 'reversed', 'in', 'not', 'and', 'or', 'if', 'else', 'True', 'False', 'None', 'true', 'false']);

/** A for loop whose count depends on the input: its bound names something other than its own variables. */
function variableFor(head: string[]) {
  if (head[0] !== 'for') return false;
  const ids = (xs: string[]) => xs.filter((x) => /^[A-Za-z_]\w*$/.test(x));
  let vars: string[];
  let limit: string[];
  const semi = head.indexOf(';');
  const range = head.indexOf('range');
  const pyIn = head.indexOf('in');
  if (semi > 0) {
    // for (init; cond; step) / Go's for init; cond; step
    const second = head.indexOf(';', semi + 1);
    if (second < 0) return false;
    const init = head.slice(1, semi);
    vars = [...init.filter((x, i) => init[i + 1] === '=' || init[i + 1] === ':='), ...ids(head.slice(second + 1))];
    limit = head.slice(semi + 1, second);
  } else if (range > 0 && !head.includes('(')) {
    vars = head.slice(1, range);
    limit = head.slice(range + 1);
  } else if (pyIn > 0) {
    vars = head.slice(1, pyIn);
    limit = head.slice(pyIn + 1);
  } else if (head.includes(':')) {
    // for (int x : nums)
    const colon = head.indexOf(':');
    vars = head.slice(1, colon);
    limit = head.slice(colon + 1);
  } else return false; // Go's `for cond {` and `for {` are while loops
  return ids(limit).some((x) => !vars.includes(x) && !NOT_BOUND.has(x) && !SMALL_TABLE.test(x));
}

/** A Python function that calls itself inside its own body. */
function pyRecursive(t: Token[]) {
  for (let i = 0; i < t.length; i++) {
    if (t[i].v !== 'def' || t[i + 1]?.k !== 'id' || t[i + 2]?.v !== '(') continue;
    const name = t[i + 1].v;
    for (let j = i + 3; j < t.length; j++) {
      if (t[j].line !== t[j - 1].line && t[j].col <= t[i].col) break;
      if (t[j].v === name && t[j + 1]?.v === '(' && (t[j - 1].v !== '.' || t[j - 2]?.v === 'self')) return true;
    }
  }
  return false;
}

/** A 2-D allocation: [[...] for ...], vector<vector, new int[n][m], make([][]. */
function grid(t: Token[], language: string) {
  return t.find((x, i) => {
    if (language === 'python') return x.v === '[' && t[i + 1]?.v === '[' && t.slice(i + 2, i + 40).some((y) => y.v === 'for' || y.v === '*');
    if (language === 'cpp') return x.v === 'vector' && t[i + 1]?.v === '<' && t[i + 2]?.v === 'vector';
    if (language === 'java') {
      if (x.v !== 'new' || t[i + 2]?.v !== '[') return false;
      let depth = 0;
      for (let j = i + 2; j < t.length; j++) {
        if (t[j].v === '[') depth++;
        else if (t[j].v === ']' && --depth === 0) return t[j + 1]?.v === '[';
      }
      return false;
    }
    return x.v === 'make' && t[i + 1]?.v === '(' && t[i + 2]?.v === '[' && t[i + 3]?.v === ']' && t[i + 4]?.v === '[';
  });
}

/** Generic checks per verdict, used only to bring the list up to three. */
function generic(status: string, codingMode: string, n: Bounds | null, language: string): Check[] {
  if (status === 'wrong_answer')
    return [
      codingMode === 'acm'
        ? check('wa-format', [
            '输出格式：数之间的空格和换行、每组数据都输出了吗、大小写（YES 还是 Yes）、浮点数保留几位，都和题面的输出格式对一遍。',
            "Output format: check spaces and line breaks between numbers, that every test case prints its answer, letter case (YES or Yes) and a float's decimal places against the statement's output section.",
          ])
        : check('wa-format', [
            '返回值：类型和顺序对吗？要求原地修改的题，改的是输入本身而不是一份拷贝吗？',
            'Return value: are the type and order right? On an in-place problem, did you change the input itself rather than a copy?',
          ]),
      check('wa-edges', [
        '边界情况：最小规模（只有 1 个元素）、全部相同、已经有序或逆序、取到最大最小值，各试一遍。',
        'Edge cases: try the smallest size (one element), all values equal, already sorted or reversed, and the extreme values.',
      ]),
      check('wa-trace', [
        '把没过的用例（或自己造一个最小的）手算一遍，和程序的中间值逐步对照，找到第一处不一样的地方。',
        "Work the failing case (or the smallest one you can build) by hand and compare it with the program's intermediate values step by step until they first differ.",
      ]),
    ];
  if (status === 'time_limit') {
    const b = n && budget(n, language);
    return [
      check(
        'tle-budget',
        n && b
          ? [
              `${n.name} ≤ ${bound(n.n)}：每秒约 10^7–10^8 次运算，目标 ${b.target} 或更快。把各层循环的次数乘起来，估一下你的代码一共要跑多少次。`,
              `${n.name} ≤ ${bound(n.n)}: about 10^7–10^8 operations a second, so aim for ${b.target} or better. Multiply the counts of your nested loops to estimate how many steps your code takes.`,
            ]
          : [
              '估算总运算量：每秒约 10^7–10^8 次（Python 约 10^7）。把各层循环的次数乘起来，和数据范围对照。',
              'Estimate the total work: about 10^7–10^8 operations a second (Python about 10^7). Multiply the counts of your nested loops and compare with the input bounds.',
            ],
      ),
      check('tle-while', [
        'while 循环里的指针或下标每一轮都在前进吗？某个分支忘了移动，就会一直循环到超时。',
        'Does every pass of each while loop move a pointer or index forward? A branch that forgets to advance it spins until the time limit.',
      ]),
      check('tle-repeat', [
        '有没有重复计算：同一段区间和、同一个子问题被反复求？前缀和、记忆化或预处理能把它们变成 O(1) 查询。',
        'Repeated work: is the same range sum or subproblem computed again and again? Prefix sums, memoization or precomputation turn those into O(1) lookups.',
      ]),
    ];
  }
  if (status === 'runtime_error')
    return [
      check('re-bounds', [
        '下标的两端：i = 0 时的 i − 1、i = n − 1 时的 i + 1，还有把循环条件写成了 <= n。',
        'Both ends of the index range: i − 1 at i = 0, i + 1 at i = n − 1, and a loop condition written as <= n.',
      ]),
      check('re-empty', [
        '空输入或只有一个元素：先判断，再取 nums[0]、s[0] 或 root.val。',
        'Empty or single-element input: check first, then read nums[0], s[0] or root.val.',
      ]),
      check('re-div', ['除以零或对零取模：除数会不会是 0？', 'Division or modulo by zero: can the divisor be 0?']),
    ];
  return [
    check(
      'mle-stack',
      ['递归太深：每层递归都占栈空间，深度到 10^5 级时考虑改成迭代或显式栈。', 'Deep recursion: every level takes stack space; at depths around 10^5, switch to a loop or an explicit stack.'],
      { href: RECURSION },
    ),
    check('mle-copy', [
      '复制：在循环或递归里切片（s[1:]、nums[:]）、取 substring、按值传 vector，每次都会生成新副本，改成传下标。',
      'Copies: slicing (s[1:], nums[:]), substring or passing a vector by value inside a loop or recursion makes a new copy every time; pass indices instead.',
    ]),
    check('mle-store', [
      '存了用不到的东西：visited 用布尔数组；BFS 入队时就标记，同一个点不要重复入队；队列里别存整条路径。',
      "State you don't need: mark visited in a boolean array; in BFS mark a node when it is enqueued so it never goes in twice; don't keep whole paths in the queue.",
    ]),
  ];
}

/**
 * What to check after a WA, TLE, RE or MLE in Python, C++, Java or Go: rules the code's tokens or
 * stderr confirm come first, then ones the bounds suggest, topped up to three with the verdict's
 * generic checks; at most six, one per id. [] for any other verdict or language.
 */
export function failureChecks({
  status,
  language,
  codingMode,
  code,
  stderr,
  bounds,
  params,
  constraints,
  statement,
}: {
  status: string;
  language: string;
  codingMode: string;
  code: string;
  stderr: string;
  bounds: Bounds | null;
  params?: Param[] | null;
  constraints?: Record<string, Constraint> | null;
  statement: string;
}): Check[] {
  if (!VERDICTS.has(status) || !isAnalyzerLanguage(language)) return [];
  const t: Token[] = code.length > 100_000 ? [] : tokenize(code, language);
  const n = bounds?.n ?? 0;
  const acm = codingMode === 'acm';
  const has = (v: string) => t.some((x) => x.v === v);
  const lineOf = (v: string) => t.find((x) => x.v === v)?.line;
  const confirmed: Check[] = [];
  const suggested: Check[] = [];

  if (status === 'wrong_answer') {
    const items = params?.length ? clarifyItems(params, constraints ?? null) : [];
    // The bounds' overflow check (lib/clarify.ts); an OA statement has only its own n and val.
    const overflow = items.some((i) => i.key === 'overflow') || (!params?.length && n * (bounds?.val ?? 0) > INT32);
    const grows = (language === 'cpp' || language === 'java') && overflow ? intGrows(t) : undefined;
    if (grows)
      confirmed.push(
        check(
          'wa-overflow',
          [
            `${grows.v} 是 int，按题目的数据范围，累加或累乘的结果可能超过 2^31−1（约 2.1×10^9）。${language === 'java' ? '改用 long' : '改用 long long'}；两个 int 相乘也要先转成 64 位再乘。`,
            `${grows.v} is an int, and with these bounds a running sum or product can pass 2^31−1 (about 2.1×10^9). Use ${language === 'java' ? 'long' : 'long long'}, and widen to 64 bits before multiplying two ints.`,
          ],
          { line: grows.line },
        ),
      );
    const edges = items.filter((i) => ['empty', 'negative', 'duplicates', 'nodes'].includes(i.key));
    if (edges.length)
      suggested.push(
        check('wa-edges', [
          `按约束过一遍边界：${edges.map((i) => i.question[0] + (i.answer?.[0] ?? '')).join('')}`,
          `Run through the edges the constraints allow. ${edges.map((i) => i.question[1] + (i.answer ? ` ${i.answer[1]}` : '')).join(' ')}`,
        ]),
      );
  }

  if (status === 'time_limit') {
    for (const note of analyze(code, language))
      if (TLE_NOTES.has(note.id))
        confirmed.push(check(note.id, [note.zh, note.en], { line: note.line, href: note.topic ? `/topics/${note.topic}#topic-pitfalls` : undefined }));
    const loops = loopLines(code, language);
    if (n >= 1e4) {
      const fors = loops.filter((l) => variableFor(l.head));
      const inner = fors.find((b, j) => fors.some((a, i) => i < j && a.from <= b.from && b.to <= a.to));
      if (inner)
        confirmed.push(
          check(
            'tle-nested',
            [
              `两层 for 循环嵌套，次数都随输入变化：${bounds!.name} ≤ ${bound(n)} 时约 ${approx(n * n)} 次。能不能去掉内层循环：哈希表、排序加双指针、前缀和或单调栈？`,
              `Two nested for loops whose counts both grow with the input: about ${approx(n * n)} steps at ${bounds!.name} ≤ ${bound(n)}. Can a hash map, sorting with two pointers, prefix sums or a monotonic stack remove the inner loop?`,
            ],
            { line: inner.from },
          ),
        );
    }
    if (acm && n >= 1e5) {
      const inLoop = (line: number) => loops.some((l) => l.from <= line && line <= l.to);
      let io: Check | undefined;
      if (language === 'python') {
        const call = t.find((x, i) => x.v === 'input' && t[i + 1]?.v === '(' && t[i - 1]?.v !== '.' && (inLoop(x.line) || t.some((y) => y.v === 'for' && y.line === x.line)));
        if (call && !has('stdin'))
          io = check(
            'tle-io',
            [
              '循环里用 input() 逐行读，10^5 行以上会很慢：开头写 import sys 和 input = sys.stdin.readline，或者一次 sys.stdin.read().split() 全部读进来。',
              'Calling input() line by line in a loop is slow past 10^5 lines: add import sys and input = sys.stdin.readline at the top, or read everything at once with sys.stdin.read().split().',
            ],
            { href: IO, line: call.line },
          );
      } else if (language === 'java' && has('Scanner'))
        io = check(
          'tle-io',
          [
            'Scanner 读 10^5 个数以上很慢：改用 BufferedReader 加 StringTokenizer（或 StreamTokenizer），输出攒进 StringBuilder 或用 PrintWriter 一次写出。',
            'Scanner is slow past 10^5 numbers: switch to BufferedReader with StringTokenizer (or StreamTokenizer), and collect output in a StringBuilder or a PrintWriter written once.',
          ],
          { href: IO, line: lineOf('Scanner') },
        );
      else if (language === 'cpp') {
        const unsynced = has('cin') && !has('sync_with_stdio');
        const endl = t.find((x) => x.v === 'endl' && inLoop(x.line));
        if (unsynced || endl)
          io = check(
            'tle-io',
            [
              [unsynced && 'cin 没关同步：main 开头加 ios::sync_with_stdio(false); cin.tie(nullptr);。', endl && '循环里的 endl 每次都会刷新输出缓冲，换成 \'\\n\'。'].filter(Boolean).join(''),
              [unsynced && 'cin is still synced with C stdio: start main with ios::sync_with_stdio(false); cin.tie(nullptr);.', endl && "endl in a loop flushes the output every time; write '\\n' instead."].filter(Boolean).join(' '),
            ],
            { href: IO, line: unsynced ? lineOf('cin') : endl!.line },
          );
      } else if (language === 'go') {
        const scan = t.find((x, i) => x.v === 'fmt' && t[i + 1]?.v === '.' && /^Scan(f|ln)?$/.test(t[i + 2]?.v ?? ''));
        if (scan && !/\bbufio\b/.test(code))
          io = check(
            'tle-io',
            [
              'fmt.Scan 没有缓冲，10^5 个数以上很慢：用 in := bufio.NewReader(os.Stdin) 配合 fmt.Fscan(in, …)，输出用 bufio.NewWriter 并记得 Flush。',
              'fmt.Scan is unbuffered and slow past 10^5 numbers: read through in := bufio.NewReader(os.Stdin) with fmt.Fscan(in, …), and write through a bufio.NewWriter you Flush at the end.',
            ],
            { href: IO, line: scan.line },
          );
      }
      if (io) confirmed.push(io);
    }
  }

  if (status === 'runtime_error') {
    const raised = /RecursionError|maximum recursion depth/.test(stderr);
    const raise = !acm || has('setrecursionlimit');
    if (language === 'python' && (raised || (!stderr && acm && n >= 1e4 && !has('setrecursionlimit') && pyRecursive(t))))
      confirmed.push(
        check(
          're-recursion',
          !raise
            ? [
                'Python 默认递归上限只有 1000 层：先确认递归能停下来，再在开头加 import sys 和 sys.setrecursionlimit(10**6)；深度到 10^5 级还是建议改成迭代。',
                'Python stops at 1000 levels of recursion by default: make sure the recursion ends, then add import sys and sys.setrecursionlimit(10**6) at the top; at depths around 10^5, a loop is still safer.',
              ]
            : acm
              ? [
                  '已经调高了递归上限还报 RecursionError：先确认递归能停下来；递归经过 C 实现的调用（@cache、lru_cache、max(f(x) for …)、map、sorted 的 key 函数）时，大约 3000–5000 层就会出错，改成迭代，或用字典手动记忆化。',
                  'RecursionError despite a raised limit: make sure the recursion ends; recursion through C-implemented calls (@cache, lru_cache, max(f(x) for …), map, a sorted key function) fails at roughly 3,000–5,000 levels, so switch to a loop or memoize with a dict.',
                ]
              : [
                  'LeetCode 模式的递归上限已经是 10^6，@cache、lru_cache 和 min/max/sum/any/all 也不受 C 调用的层数限制。仍报 RecursionError，先确认递归能停下来；再看递归是否经过 map、sorted 的 key 回调这类 C 调用，它们大约 5000 层就到顶，改成迭代或显式栈。',
                  'LeetCode mode already allows 10^6 levels, and @cache, lru_cache and min/max/sum/any/all are free of the C-call depth limit. If RecursionError persists, make sure the recursion ends, then look for recursion through other C calls such as map or a sorted key callback, which stop near 5,000 levels; switch to a loop or an explicit stack.',
                ],
          { href: RECURSION },
        ),
      );
    if (language === 'java' && /StackOverflowError/.test(stderr))
      confirmed.push(
        check(
          're-recursion',
          [
            'StackOverflowError：线程栈有 64 MB，10^5 层的普通递归能跑完，溢出多半是递归停不下来（基线条件不对），或者深度到了 10^6 级，那就改成迭代或显式栈。',
            "StackOverflowError: the thread stack is 64 MB, enough for ordinary recursion 10^5 levels deep, so this usually means the recursion never stops (a wrong base case) or goes about 10^6 deep; then use a loop or an explicit stack.",
          ],
          { href: RECURSION },
        ),
      );
    if (language === 'go' && /goroutine stack exceeds/.test(stderr))
      confirmed.push(
        check(
          're-recursion',
          [
            'goroutine stack exceeds：Go 的栈会自动增长，撑爆它基本是递归停不下来，先检查基线条件；确实很深就改成迭代。',
            'goroutine stack exceeds: Go stacks grow on their own, so overflowing one almost always means the recursion never stops; check the base case, and use a loop if it really is that deep.',
          ],
          { href: RECURSION },
        ),
      );
    if (/IndexError|IndexOutOfBounds|index out of range|out_of_range/.test(stderr)) {
      if (/1-indexed|1-based|indexed from 1|numbered from 1|下标从 ?1|编号从 ?1/i.test(statement))
        confirmed.push(
          check('re-one-based', [
            '题目的下标从 1 开始：数组开 n + 1 个位置，或者读入时统一减 1，别两种混着用。',
            'The statement counts from 1: give the array n + 1 slots, or subtract 1 as you read, and do not mix the two.',
          ]),
        );
      confirmed.push(generic(status, codingMode, bounds, language)[0]); // both ends of the index range
    }
    if (/NullPointerException|nil pointer|'NoneType' object/.test(stderr))
      confirmed.push(
        check('re-null', [
          '访问了空节点：读 root.left、node.val、head.next 之前先判断它是不是 null（Python 是 None，Go 是 nil），空树和空链表单独处理。',
          'A null node was dereferenced: check for null (None in Python, nil in Go) before reading root.left, node.val or head.next, and handle the empty tree or list on its own.',
        ]),
      );
  }

  if (status === 'memory_limit' && n >= 1e4) {
    const at = grid(t, language);
    if (at)
      confirmed.push(
        check(
          'mle-2d',
          [
            `二维数组：${bounds!.name} ≤ ${bound(n)}，开成 n × n 就有 ${approx(n * n)} 个格子，每格 4 字节约 ${approx((n * n * 4) / 2 ** 20)} MB。如果每一行只依赖上一行，改成两行或一行的滚动数组。`,
            `A 2-D array: with ${bounds!.name} ≤ ${bound(n)}, an n × n table has ${approx(n * n)} cells, about ${approx((n * n * 4) / 2 ** 20)} MB at 4 bytes each. If each row depends only on the previous one, keep two rows (or one) and roll them.`,
          ],
          { href: '/topics/dp-foundations', line: at.line },
        ),
      );
  }

  const out: Check[] = [];
  for (const c of [...confirmed, ...suggested]) if (!out.some((o) => o.id === c.id)) out.push(c);
  for (const c of generic(status, codingMode, bounds, language)) if (out.length < 3 && !out.some((o) => o.id === c.id)) out.push(c);
  return out.slice(0, 6);
}
