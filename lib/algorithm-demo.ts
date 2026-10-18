import { SORT_ALGOS, SORT_DEFAULT, sortTrace, type SortAlgo } from './algorithm-demo-sorts';

/** t('中文', 'English'): the generators write every caption and label through one of these. */
export type Tr = (zh: string, en: string) => string;
export const zhText: Tr = (zh) => zh;
export const enText: Tr = (_zh, en) => en;

export type DemoKind =
  | 'binary-search'
  | 'sliding-window'
  | 'bfs'
  | 'dp'
  | 'two-pointers'
  | 'dfs'
  | 'dijkstra'
  | 'union-find'
  | 'topo-sort'
  | 'heap'
  | 'monotonic-stack'
  | 'dp-table'
  | 'backtracking'
  | 'trie'
  | 'array-ops'
  | 'hash-table'
  | 'linked-list'
  | 'tree-traversal'
  | 'bst'
  | 'kruskal'
  | 'n-queens'
  | 'interval-dp'
  | 'stock-dp'
  | 'lru-cache'
  | 'interval-greedy'
  | 'prefix-sum'
  | 'bits'
  | 'kmp'
  | `sort-${SortAlgo}`;
export type DemoState = 'active' | 'visited' | 'muted' | 'answer' | 'blocked';
export type DemoCell = {
  value: string | number;
  label: string;
  state?: DemoState;
};
/** A graph or tree node in its trace's coordinate box; `label` sits in the circle, `note` under it. */
export type DemoNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  state?: DemoState;
  note?: string;
  /** Extra drop for the note, so crowded neighbours' notes alternate rows. */
  noteDy?: number;
};
export type DemoEdge = {
  from: string;
  to: string;
  label?: string;
  state?: DemoState;
  directed?: boolean;
};
export type DemoGraph = {
  width: number;
  height: number;
  nodes: DemoNode[];
  edges: DemoEdge[];
};
export type DemoFrame = {
  caption: string;
  cells: DemoCell[];
  stats: [string, string][];
  queue?: string[];
  graph?: DemoGraph;
  done?: boolean;
};
export type DemoTrace = {
  title: string;
  question: string;
  invariant: string;
  columns?: number;
  /** What `queue` holds when it is not a plain FIFO queue (a stack, a heap's input, results). */
  queueLabel?: string;
  frames: DemoFrame[];
};
export const demoKinds: DemoKind[] = [
  'binary-search',
  'sliding-window',
  'bfs',
  'dp',
  'two-pointers',
  'dfs',
  'dijkstra',
  'union-find',
  'topo-sort',
  'heap',
  'monotonic-stack',
  'dp-table',
  'backtracking',
  'trie',
  'array-ops',
  'hash-table',
  'linked-list',
  'tree-traversal',
  'bst',
  'kruskal',
  'n-queens',
  'interval-dp',
  'stock-dp',
  'lru-cache',
  'interval-greedy',
  'prefix-sum',
  'bits',
  'kmp',
  ...SORT_ALGOS.map((algo) => `sort-${algo}` as const),
];
export function isDemoKind(kind: string): kind is DemoKind {
  return demoKinds.includes(kind as DemoKind);
}

/**
 * x/y for a forest: leaves left to right, each parent centred over its children, one row
 * per depth, scaled into `width`. Roots and children come in display order.
 */
function layoutForest(
  roots: string[],
  children: (id: string) => string[],
  width = 100,
  row = 16,
  margin = 8,
) {
  const raw = new Map<string, { x: number; depth: number }>();
  let leaves = 0,
    deepest = 0;
  const place = (id: string, depth: number): number => {
    deepest = Math.max(deepest, depth);
    const kids = children(id);
    const x = kids.length
      ? kids.map((k) => place(k, depth + 1)).reduce((a, b) => a + b) / kids.length
      : leaves++;
    raw.set(id, { x, depth });
    return x;
  };
  for (const root of roots) place(root, 0);
  const span = Math.max(1, leaves - 1);
  const pos = new Map<string, { x: number; y: number }>();
  for (const [id, { x, depth }] of raw)
    pos.set(id, {
      x: leaves <= 1 ? width / 2 : margin + (x / span) * (width - 2 * margin),
      y: margin + depth * row,
    });
  return { pos, height: margin * 2 + deepest * row };
}

export function binarySearchTrace(
  values = [2, 5, 8, 12, 16, 23, 38, 56],
  target = 23,
  t: Tr = zhText,
): DemoTrace {
  const frames: DemoFrame[] = [];
  let left = 0,
    right = values.length - 1;
  const frame = (caption: string, mid = -1, answer = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: values.map((value, i) => ({
        value,
        label: String(i),
        state:
          i === answer
            ? 'answer'
            : i === mid
              ? 'active'
              : i < left || i > right
                ? 'muted'
                : undefined,
      })),
      stats: [
        [t('目标', 'Target'), String(target)],
        ['left', String(left)],
        ['right', String(right)],
        ['mid', mid < 0 ? '—' : String(mid)],
      ],
    });
  frame(
    t(
      '初始搜索区间包含整个有序数组。下方数字是数组下标。',
      'The search range starts as the whole sorted array. The small numbers are indexes.',
    ),
  );
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    frame(
      t(
        `检查下标 ${mid}：${values[mid]} 与目标 ${target} 比较。`,
        `Check index ${mid}: compare ${values[mid]} with the target ${target}.`,
      ),
      mid,
    );
    if (values[mid] === target) {
      frame(t(`找到目标！返回下标 ${mid}。`, `Found it! Return index ${mid}.`), mid, mid, true);
      break;
    }
    if (values[mid] < target) {
      left = mid + 1;
      frame(
        t(
          `${values[mid]} < ${target}，左侧连同 mid 都不可能是答案，left 移到 ${left}。`,
          `${values[mid]} < ${target}, so mid and everything left of it are out: left moves to ${left}.`,
        ),
      );
    } else {
      right = mid - 1;
      frame(
        t(
          `${values[mid]} > ${target}，右侧连同 mid 都不可能是答案，right 移到 ${right}。`,
          `${values[mid]} > ${target}, so mid and everything right of it are out: right moves to ${right}.`,
        ),
      );
    }
  }
  if (!frames.at(-1)?.done)
    frame(
      t('区间为空，目标不存在，返回 −1。', 'The range is empty: the target is absent, return −1.'),
      -1,
      -1,
      true,
    );
  return {
    title: t('二分查找 · 每次排除一半', 'Binary search · drop half each step'),
    question: t(`在有序数组中查找 ${target}`, `Find ${target} in a sorted array`),
    invariant: t(
      '如果目标存在，它始终位于闭区间 [left, right] 内。',
      'If the target exists, it is always inside the closed range [left, right].',
    ),
    frames,
  };
}

export function slidingWindowTrace(input = 'abcabcbb', t: Tr = zhText): DemoTrace {
  const chars = Array.from(input),
    frames: DemoFrame[] = [],
    seen = new Set<string>();
  let left = 0,
    best = 0;
  const frame = (caption: string, right: number, done = false) =>
    frames.push({
      caption,
      done,
      cells: chars.map((value, i) => ({
        value,
        label: String(i),
        state: i >= left && i <= right ? 'active' : 'muted',
      })),
      stats: [
        ['left', String(left)],
        ['right', String(right)],
        [t('窗口长度', 'Window'), String(Math.max(0, right - left + 1))],
        [t('最长长度', 'Longest'), String(best)],
      ],
    });
  frame(
    t(
      '从空窗口开始，求不含重复字符的最长子串长度。',
      'Start with an empty window; find the longest substring without a repeated character.',
    ),
    -1,
  );
  for (let right = 0; right < chars.length; right++) {
    while (seen.has(chars[right])) {
      const removed = chars[left];
      seen.delete(removed);
      left++;
      frame(
        t(
          `下一个字符 ${chars[right]} 已在窗口内：移除左端 ${removed}，继续检查。`,
          `The next character ${chars[right]} is already in the window: drop ${removed} from the left and check again.`,
        ),
        right - 1,
      );
    }
    seen.add(chars[right]);
    best = Math.max(best, right - left + 1);
    const window = chars.slice(left, right + 1).join('');
    frame(
      t(
        `加入 ${chars[right]}。当前窗口「${window}」没有重复字符，更新最长长度。`,
        `Add ${chars[right]}. The window "${window}" has no repeats; update the longest length.`,
      ),
      right,
    );
  }
  frame(
    t(`遍历完成，最长无重复子串长度为 ${best}。`, `Done: the longest substring without repeats has length ${best}.`),
    chars.length - 1,
    true,
  );
  return {
    title: t('滑动窗口 · 无重复字符子串', 'Sliding window · no repeated characters'),
    question: t(`输入：${input || '空字符串'}`, `Input: ${input || 'empty string'}`),
    invariant: t(
      '每次加入右端字符后，窗口内所有字符互不相同；left 只向右移动。',
      'After each new right character the window holds distinct characters; left only moves right.',
    ),
    frames,
  };
}

export function bfsTrace(t: Tr = zhText): DemoTrace {
  const columns = 5,
    rows = 4,
    walls = new Set([6, 7, 12]),
    goal = 19;
  const distance = Array<number>(columns * rows).fill(-1),
    parent = Array<number>(columns * rows).fill(-1);
  const queue = [0],
    frames: DemoFrame[] = [];
  distance[0] = 0;
  const name = (i: number) => `(${Math.floor(i / columns)},${i % columns})`;
  const frame = (caption: string, current = -1, path: number[] = [], done = false) =>
    frames.push({
      caption,
      done,
      cells: distance.map((d, i) => ({
        value: walls.has(i) ? '■' : i === 0 ? 'S' : i === goal ? 'T' : d < 0 ? '·' : d,
        label: name(i),
        state: walls.has(i)
          ? 'blocked'
          : path.includes(i)
            ? 'answer'
            : i === current
              ? 'active'
              : d >= 0
                ? 'visited'
                : undefined,
      })),
      stats: [
        [t('已发现', 'Discovered'), String(distance.filter((d) => d >= 0).length)],
        [t('当前距离', 'Current distance'), current < 0 ? '—' : String(distance[current])],
        [t('终点距离', 'Distance to T'), distance[goal] < 0 ? t('未到达', 'not reached') : String(distance[goal])],
      ],
      queue: queue.map(name),
    });
  frame(
    t(
      '起点 S 入队，距离为 0。每一步只能上下左右移动，深色格不可通行。',
      'S joins the queue at distance 0. Moves go up, down, left or right; dark cells are walls.',
    ),
  );
  while (queue.length) {
    const current = queue.shift()!;
    frame(
      t(
        `取出队首 ${name(current)}，它与起点的最短距离是 ${distance[current]}。`,
        `Take ${name(current)} from the front: its shortest distance from S is ${distance[current]}.`,
      ),
      current,
    );
    if (current === goal) {
      const path: number[] = [];
      for (let i = goal; i >= 0; i = parent[i]) path.push(i);
      frame(
        t(
          `到达 T！沿前驱还原最短路径，共 ${distance[goal]} 步。`,
          `Reached T! Follow the parents back for the shortest path: ${distance[goal]} steps.`,
        ),
        current,
        path,
        true,
      );
      break;
    }
    const r = Math.floor(current / columns),
      c = current % columns;
    for (const [dr, dc] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const nr = r + dr,
        nc = c + dc,
        next = nr * columns + nc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= columns || walls.has(next) || distance[next] >= 0) continue;
      distance[next] = distance[current] + 1;
      parent[next] = current;
      queue.push(next);
      frame(
        t(
          `发现 ${name(next)}，距离设为 ${distance[next]}，标记后入队，避免重复访问。`,
          `Discover ${name(next)} at distance ${distance[next]}; mark it and enqueue it so it is never visited twice.`,
        ),
        next,
      );
    }
  }
  return {
    title: t('BFS · 网格最短路径', 'BFS · shortest path on a grid'),
    question: t('从左上角 S 到右下角 T，最少走几步？', 'How few steps from S (top left) to T (bottom right)?'),
    invariant: t(
      '队列按距离从小到大处理；每个格子第一次被发现时，其最短距离已经确定。',
      'The queue is processed in order of distance; a cell’s shortest distance is fixed when it is first discovered.',
    ),
    columns,
    frames,
  };
}

export function dpTrace(amount = 6, coins = [1, 3, 4], t: Tr = zhText): DemoTrace {
  if (
    !Number.isInteger(amount) ||
    amount < 0 ||
    amount > 100 ||
    coins.some((c) => !Number.isInteger(c) || c <= 0)
  )
    throw new Error('Invalid coin change demo input');
  const dp = Array<number>(amount + 1).fill(Infinity),
    frames: DemoFrame[] = [];
  dp[0] = 0;
  const frame = (caption: string, current = -1, from = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: dp.map((value, i) => ({
        value: Number.isFinite(value) ? value : '∞',
        label: `dp[${i}]`,
        state:
          done && i === amount
            ? 'answer'
            : i === current
              ? 'active'
              : i === from
                ? 'visited'
                : i < current
                  ? 'visited'
                  : undefined,
      })),
      stats: [
        [t('目标金额', 'Amount'), String(amount)],
        [t('当前金额', 'Current'), current < 0 ? '—' : String(current)],
        [
          t('最少硬币', 'Fewest coins'),
          Number.isFinite(dp[amount]) ? String(dp[amount]) : t('尚不可达', 'not reachable yet'),
        ],
      ],
    });
  frame(
    t(
      'dp[0] = 0，其余状态为 ∞（不可达）。dp[x] 表示凑出金额 x 的最少硬币数。',
      'dp[0] = 0 and every other state starts at ∞ (unreachable). dp[x] is the fewest coins that make x.',
    ),
  );
  for (let x = 1; x <= amount; x++)
    for (const coin of coins) {
      if (coin > x) continue;
      const candidate = dp[x - coin] + 1,
        before = dp[x];
      dp[x] = Math.min(dp[x], candidate);
      const shown = Number.isFinite(candidate) ? candidate : '∞';
      frame(
        dp[x] < before
          ? t(
              `金额 ${x}，尝试最后一枚用 ${coin}：dp[${x - coin}] + 1 = ${shown}。更新 dp[${x}] = ${dp[x]}。`,
              `Amount ${x}, last coin ${coin}: dp[${x - coin}] + 1 = ${shown}. Update dp[${x}] = ${dp[x]}.`,
            )
          : t(
              `金额 ${x}，尝试最后一枚用 ${coin}：dp[${x - coin}] + 1 = ${shown}。不能得到更少硬币，保留原值。`,
              `Amount ${x}, last coin ${coin}: dp[${x - coin}] + 1 = ${shown}. Not fewer coins; keep the old value.`,
            ),
        x,
        x - coin,
      );
    }
  frame(
    Number.isFinite(dp[amount])
      ? t(`计算完成，凑出 ${amount} 最少需要 ${dp[amount]} 枚硬币。`, `Done: ${amount} needs at least ${dp[amount]} coins.`)
      : t(`计算完成，无法凑出 ${amount}，返回 −1。`, `Done: ${amount} cannot be made, return −1.`),
    amount,
    -1,
    true,
  );
  return {
    title: t('动态规划 · 零钱兑换', 'Dynamic programming · coin change'),
    question: t(
      `硬币 ${coins.join('、')}，每种无限枚，凑出 ${amount}`,
      `Coins ${coins.join(', ')}, unlimited of each: make ${amount}`,
    ),
    invariant: t(
      '按金额递增计算；更新 dp[x] 时，所有更小金额的最优解都已确定。',
      'Amounts go up one by one; when dp[x] is updated, every smaller amount is already optimal.',
    ),
    frames,
  };
}

/** Pair sum on a sorted array: move the pointer whose move can fix the sum. */
export function twoPointersTrace(
  values = [1, 3, 4, 6, 8, 11, 15],
  target = 14,
  t: Tr = zhText,
): DemoTrace {
  const frames: DemoFrame[] = [];
  let left = 0,
    right = values.length - 1;
  const frame = (caption: string, found = false, done = false) =>
    frames.push({
      caption,
      done,
      cells: values.map((value, i) => ({
        value,
        label: i === left ? `L·${i}` : i === right ? `R·${i}` : String(i),
        state:
          found && (i === left || i === right)
            ? 'answer'
            : i === left || i === right
              ? 'active'
              : i < left || i > right
                ? 'muted'
                : undefined,
      })),
      stats: [
        [t('目标和', 'Target'), String(target)],
        ['left', String(left)],
        ['right', String(right)],
        [t('当前和', 'Sum'), left < right ? String(values[left] + values[right]) : '—'],
      ],
    });
  frame(
    t(
      '数组已排序。left 指向最小值，right 指向最大值。',
      'The array is sorted. left starts at the smallest value, right at the largest.',
    ),
  );
  while (left < right) {
    const sum = values[left] + values[right];
    if (sum === target) {
      frame(
        t(
          `${values[left]} + ${values[right]} = ${target}，找到答案：下标 ${left} 和 ${right}。`,
          `${values[left]} + ${values[right]} = ${target}: the answer is indexes ${left} and ${right}.`,
        ),
        true,
        true,
      );
      break;
    }
    if (sum < target) {
      left++;
      frame(
        t(
          `${sum} < ${target}：和太小，只有让 left 右移才能变大。left → ${left}。`,
          `${sum} < ${target}: too small, and only moving left rightwards can grow it. left → ${left}.`,
        ),
      );
    } else {
      right--;
      frame(
        t(
          `${sum} > ${target}：和太大，只有让 right 左移才能变小。right → ${right}。`,
          `${sum} > ${target}: too big, and only moving right leftwards can shrink it. right → ${right}.`,
        ),
      );
    }
  }
  if (!frames.at(-1)?.done)
    frame(t('两指针相遇，没有和为目标的一对数。', 'The pointers met: no pair adds up to the target.'), false, true);
  return {
    title: t('双指针 · 有序数组两数之和', 'Two pointers · pair sum in a sorted array'),
    question: t(`找出和为 ${target} 的两个数`, `Find two numbers that add up to ${target}`),
    invariant: t(
      '答案如果存在，一定在 [left, right] 之内：被跳过的值不可能和任何剩下的值凑成目标。',
      'If a pair exists it lies inside [left, right]: a skipped value cannot pair with anything left to reach the target.',
    ),
    frames,
  };
}

/** Count islands with an explicit stack: each land cell is marked when it is pushed, so it is pushed once. */
export function dfsTrace(grid = ['110010', '100110', '001000', '101101'], t: Tr = zhText): DemoTrace {
  const rows = grid.length,
    columns = grid[0]?.length ?? 0,
    land = grid
      .join('')
      .split('')
      .map((c) => c === '1');
  const island = Array<number>(rows * columns).fill(0),
    stack: number[] = [],
    frames: DemoFrame[] = [];
  let count = 0;
  const name = (i: number) => `(${Math.floor(i / columns)},${i % columns})`;
  const frame = (caption: string, current = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: land.map((isLand, i) => ({
        value: !isLand ? '~' : island[i] ? `#${island[i]}` : '1',
        label: name(i),
        state: !isLand ? 'muted' : i === current ? 'active' : island[i] ? (done ? 'answer' : 'visited') : undefined,
      })),
      stats: [
        [t('岛屿数', 'Islands'), String(count)],
        [t('已访问陆地', 'Land visited'), String(island.filter(Boolean).length)],
      ],
      queue: stack.map(name),
    });
  frame(
    t(
      '1 是陆地，~ 是水。逐行扫描，遇到没访问过的陆地就从它开始深搜。',
      '1 is land, ~ is water. Scan row by row; unvisited land starts a new depth-first search.',
    ),
  );
  for (let start = 0; start < land.length; start++) {
    if (!land[start] || island[start]) continue;
    island[start] = ++count;
    stack.push(start);
    frame(
      t(`${name(start)} 是新的陆地：岛屿数 +1，标记后压栈。`, `${name(start)} is new land: islands +1, mark it and push it.`),
      start,
    );
    while (stack.length) {
      const current = stack.pop()!;
      frame(t(`弹出栈顶 ${name(current)}，检查它的四个邻居。`, `Pop ${name(current)} and check its four neighbours.`), current);
      const r = Math.floor(current / columns),
        c = current % columns;
      for (const [dr, dc] of [
        [-1, 0],
        [0, -1],
        [0, 1],
        [1, 0],
      ]) {
        const nr = r + dr,
          nc = c + dc,
          next = nr * columns + nc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= columns || !land[next] || island[next]) continue;
        island[next] = count;
        stack.push(next);
        frame(
          t(
            `邻居 ${name(next)} 是同一座岛的陆地：标记为 #${count} 并压栈。`,
            `Neighbour ${name(next)} is land on the same island: mark it #${count} and push it.`,
          ),
          next,
        );
      }
    }
    frame(t(`栈空了，第 ${count} 座岛探索完毕。`, `The stack is empty: island ${count} is fully explored.`));
  }
  frame(t(`扫描结束，一共 ${count} 座岛。`, `Scan finished: ${count} islands in total.`), -1, true);
  return {
    title: t('DFS · 网格岛屿数量', 'DFS · counting islands on a grid'),
    question: t(
      '上下左右相连的陆地算一座岛，一共有几座？',
      'Land joined up, down, left or right is one island. How many are there?',
    ),
    invariant: t(
      '压栈时就标记：每块陆地只入栈一次，所以总时间是 O(行 × 列)。',
      'Cells are marked when pushed, so each land cell enters the stack once: O(rows × columns) in all.',
    ),
    columns,
    queueLabel: t('栈底 → 栈顶', 'Stack bottom → top'),
    frames,
  };
}

const DIJKSTRA_XY: Record<string, [number, number]> = {
  A: [8, 30],
  B: [36, 8],
  C: [36, 52],
  D: [66, 8],
  E: [66, 52],
  F: [92, 30],
};
export const DIJKSTRA_EDGES: [string, string, number][] = [
  ['A', 'B', 4],
  ['A', 'C', 2],
  ['C', 'B', 1],
  ['B', 'D', 5],
  ['C', 'E', 10],
  ['D', 'E', 2],
  ['D', 'F', 6],
  ['E', 'F', 3],
];
/** Dijkstra with a lazy-deletion priority queue on a small undirected weighted graph. */
export function dijkstraTrace(t: Tr = zhText): DemoTrace {
  const nodes = Object.keys(DIJKSTRA_XY),
    source = 'A',
    goal = 'F';
  const dist = new Map(nodes.map((n) => [n, n === source ? 0 : Infinity])),
    prev = new Map<string, string>(),
    settled = new Set<string>(),
    frames: DemoFrame[] = [];
  let pq: [number, string][] = [[0, source]];
  const shown = (d: number) => (Number.isFinite(d) ? String(d) : '∞');
  const byDistance = (x: [number, string], y: [number, string]) => x[0] - y[0] || x[1].localeCompare(y[1]);
  const frame = (caption: string, current = '', edge: [string, string] | null = null, done = false) => {
    const onTree = (a: string, b: string) => prev.get(a) === b || prev.get(b) === a;
    frames.push({
      caption,
      done,
      cells: nodes.map((n) => ({
        value: shown(dist.get(n)!),
        label: n,
        state: n === current ? 'active' : settled.has(n) ? 'visited' : undefined,
      })),
      graph: {
        width: 100,
        height: 60,
        nodes: nodes.map((n) => ({
          id: n,
          label: n,
          x: DIJKSTRA_XY[n][0],
          y: DIJKSTRA_XY[n][1],
          note: shown(dist.get(n)!),
          state: n === current ? 'active' : settled.has(n) ? 'visited' : undefined,
        })),
        edges: DIJKSTRA_EDGES.map(([a, b, w]) => ({
          from: a,
          to: b,
          label: String(w),
          state:
            edge && ((edge[0] === a && edge[1] === b) || (edge[0] === b && edge[1] === a))
              ? 'active'
              : onTree(a, b)
                ? done
                  ? 'answer'
                  : 'visited'
                : undefined,
        })),
      },
      stats: [
        [t('已确定', 'Settled'), `${settled.size} / ${nodes.length}`],
        [t('当前节点', 'Current'), current || '—'],
        [`${source}→${goal}`, shown(dist.get(goal)!)],
      ],
      queue: [...pq].sort(byDistance).map(([d, n]) => `${n}:${d}`),
    });
  };
  frame(
    t(
      `起点 ${source} 距离为 0，其余为 ∞。节点下方的数字是目前已知的最短距离。`,
      `${source} starts at distance 0, the rest at ∞. The number under each node is its best known distance.`,
    ),
  );
  while (pq.length) {
    pq.sort(byDistance);
    const [d, u] = pq.shift()!;
    if (settled.has(u)) {
      frame(
        t(
          `弹出 ${u}:${d}，但 ${u} 已确定，这是过期条目，跳过。`,
          `Pop ${u}:${d}, but ${u} is already settled: a stale entry, skip it.`,
        ),
      );
      continue;
    }
    settled.add(u);
    frame(
      t(
        `弹出距离最小的 ${u}（${d}）。所有边权非负，它的最短距离就此确定。`,
        `Pop ${u} (${d}), the smallest distance. With no negative edges, its shortest distance is now final.`,
      ),
      u,
    );
    for (const [a, b, w] of DIJKSTRA_EDGES) {
      const v = a === u ? b : b === u ? a : '';
      if (!v || settled.has(v)) continue;
      const candidate = d + w;
      if (candidate < dist.get(v)!) {
        dist.set(v, candidate);
        prev.set(v, u);
        pq = [...pq, [candidate, v]];
        frame(
          t(
            `松弛 ${u}–${v}：${d} + ${w} = ${candidate}，比原来更短，更新 ${v} 并入队。`,
            `Relax ${u}–${v}: ${d} + ${w} = ${candidate} is shorter, so update ${v} and push it.`,
          ),
          u,
          [u, v],
        );
      } else
        frame(
          t(
            `松弛 ${u}–${v}：${d} + ${w} = ${candidate}，不比 ${shown(dist.get(v)!)} 短，不变。`,
            `Relax ${u}–${v}: ${d} + ${w} = ${candidate} is not shorter than ${shown(dist.get(v)!)}; no change.`,
          ),
          u,
          [u, v],
        );
    }
  }
  const path = [goal];
  while (prev.has(path[0])) path.unshift(prev.get(path[0])!);
  frame(
    t(
      `完成。${source} 到 ${goal} 最短为 ${shown(dist.get(goal)!)}，路径 ${path.join(' → ')}。绿色边组成最短路径树。`,
      `Done. The shortest ${source} to ${goal} distance is ${shown(dist.get(goal)!)} via ${path.join(' → ')}. Green edges form the shortest-path tree.`,
    ),
    '',
    null,
    true,
  );
  return {
    title: t('Dijkstra · 带权最短路', 'Dijkstra · weighted shortest paths'),
    question: t(
      `从 ${source} 出发，到每个点的最短距离是多少？`,
      `What is the shortest distance from ${source} to every node?`,
    ),
    invariant: t(
      '从优先队列弹出的未确定节点，其距离已是最短；前提是边权都不为负。',
      'The unsettled node popped from the priority queue already has its shortest distance, as long as no edge is negative.',
    ),
    queueLabel: t('优先队列（按距离从小到大）', 'Priority queue (smallest distance first)'),
    frames,
  };
}

/** Union by size with path compression; a union inside one set is skipped. */
export function unionFindTrace(
  n = 8,
  unions: [number, number][] = [
    [0, 1],
    [2, 3],
    [1, 3],
    [4, 5],
    [5, 6],
    [3, 6],
    [0, 2],
  ],
  t: Tr = zhText,
): DemoTrace {
  const parent = Array.from({ length: n }, (_, i) => i),
    size = Array<number>(n).fill(1),
    frames: DemoFrame[] = [];
  let components = n,
    operation = '—';
  const frame = (caption: string, path: number[] = [], done = false) => {
    const roots = parent.flatMap((p, i) => (p === i ? [String(i)] : []));
    const { pos, height } = layoutForest(roots, (id) =>
      parent.flatMap((p, i) => (p === Number(id) && i !== p ? [String(i)] : [])),
    );
    frames.push({
      caption,
      done,
      cells: parent.map((p, i) => ({
        value: p,
        label: `p[${i}]`,
        state: path.includes(i) ? 'active' : done && p === i ? 'answer' : undefined,
      })),
      graph: {
        width: 100,
        height: Math.max(height, 30),
        nodes: parent.map((p, i) => ({
          id: String(i),
          label: String(i),
          ...pos.get(String(i))!,
          state: path.includes(i) ? 'active' : p === i ? (done ? 'answer' : 'visited') : undefined,
        })),
        edges: parent.flatMap((p, i) =>
          p === i
            ? []
            : [{ from: String(i), to: String(p), directed: true, state: path.includes(i) ? ('active' as const) : undefined }],
        ),
      },
      stats: [
        [t('连通分量', 'Components'), String(components)],
        [t('操作', 'Operation'), operation],
      ],
    });
  };
  const find = (x: number) => {
    const path = [x];
    while (parent[path.at(-1)!] !== path.at(-1)) path.push(parent[path.at(-1)!]);
    return path;
  };
  frame(
    t(
      '每个元素自成一组：parent[i] = i。箭头从孩子指向父亲，没有箭头的是根。',
      'Every element starts alone: parent[i] = i. Arrows point from a child to its parent; nodes without one are roots.',
    ),
  );
  for (const [a, b] of unions) {
    operation = `union(${a}, ${b})`;
    const pa = find(a),
      pb = find(b);
    const ra = pa.at(-1)!,
      rb = pb.at(-1)!;
    frame(
      t(
        `find(${a}) 沿 ${pa.join(' → ')} 找到根 ${ra}；find(${b}) 沿 ${pb.join(' → ')} 找到根 ${rb}。`,
        `find(${a}) walks ${pa.join(' → ')} to root ${ra}; find(${b}) walks ${pb.join(' → ')} to root ${rb}.`,
      ),
      [...pa, ...pb],
    );
    const compress = [...pa.slice(0, -2), ...pb.slice(0, -2)];
    if (compress.length) {
      for (const x of pa.slice(0, -1)) parent[x] = ra;
      for (const x of pb.slice(0, -1)) parent[x] = rb;
      frame(
        t(
          `路径压缩：${compress.join('、')} 直接指向根，下次 find 一步到位。`,
          `Path compression: ${compress.join(', ')} now point straight at the root, so the next find takes one step.`,
        ),
        compress,
      );
    }
    if (ra === rb) {
      frame(t(`${a} 和 ${b} 已在同一组，跳过。`, `${a} and ${b} are already in one set: skip.`), [ra]);
      continue;
    }
    const [big, small] = size[ra] >= size[rb] ? [ra, rb] : [rb, ra];
    parent[small] = big;
    size[big] += size[small];
    components--;
    frame(
      t(
        `按大小合并：较小的树（根 ${small}）挂到较大的树（根 ${big}）下，连通分量 −1。`,
        `Union by size: the smaller tree (root ${small}) hangs under the bigger one (root ${big}); components −1.`,
      ),
      [small, big],
    );
  }
  operation = '—';
  frame(
    t(`全部合并完成，共 ${components} 个连通分量（绿色为各组的根）。`, `All unions done: ${components} components (roots in green).`),
    [],
    true,
  );
  return {
    title: t('并查集 · 按大小合并 + 路径压缩', 'Union-find · union by size + path compression'),
    question: t(`${n} 个元素，依次执行 ${unions.length} 次 union`, `${n} elements, ${unions.length} unions in order`),
    invariant: t(
      '同一组的元素沿 parent 走到同一个根；树高保持在 O(log n)，压缩后几乎是常数。',
      'Elements of one set reach the same root through parent; trees stay O(log n) tall and nearly flat after compression.',
    ),
    frames,
  };
}

const TOPO_XY: Record<string, [number, number]> = {
  A: [8, 12],
  B: [8, 48],
  C: [38, 12],
  D: [38, 48],
  E: [66, 30],
  F: [92, 30],
};
export const TOPO_EDGES: [string, string][] = [
  ['A', 'C'],
  ['B', 'C'],
  ['B', 'D'],
  ['C', 'E'],
  ['D', 'E'],
  ['D', 'F'],
  ['E', 'F'],
];
/** Kahn's algorithm: repeatedly output a node with no remaining prerequisites. */
export function topoSortTrace(edges: [string, string][] = TOPO_EDGES, t: Tr = zhText): DemoTrace {
  const nodes = Object.keys(TOPO_XY),
    indegree = new Map(nodes.map((n) => [n, edges.filter(([, b]) => b === n).length])),
    removed = new Set<number>(),
    order: string[] = [],
    frames: DemoFrame[] = [];
  const queue = nodes.filter((n) => !indegree.get(n));
  const stateOf = (n: string, current: string, done: boolean): DemoState | undefined =>
    n === current ? 'active' : order.includes(n) ? (done ? 'answer' : 'visited') : undefined;
  const frame = (caption: string, current = '', edge = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: nodes.map((n) => ({
        value: indegree.get(n)!,
        label: t(`入度 ${n}`, `in ${n}`),
        state: stateOf(n, current, done),
      })),
      graph: {
        width: 100,
        height: 60,
        nodes: nodes.map((n) => ({
          id: n,
          label: n,
          x: TOPO_XY[n][0],
          y: TOPO_XY[n][1],
          note: order.includes(n) ? `#${order.indexOf(n) + 1}` : undefined,
          state: stateOf(n, current, done),
        })),
        edges: edges.map(([a, b], i) => ({
          from: a,
          to: b,
          directed: true,
          state: i === edge ? 'active' : removed.has(i) ? 'muted' : undefined,
        })),
      },
      stats: [[t('输出顺序', 'Order'), order.join(' → ') || '—']],
      queue: [...queue],
    });
  frame(
    queue.length
      ? t(
          `箭头 X → Y 表示先修 X 才能修 Y。入度为 0 的 ${queue.join('、')} 没有先修要求，先入队。`,
          `An arrow X → Y means X must come before Y. ${queue.join(', ')} have in-degree 0, so they join the queue first.`,
        )
      : t(
          '箭头 X → Y 表示先修 X 才能修 Y。没有入度为 0 的节点：每门课都有先修，图里有环，不存在拓扑序。',
          'An arrow X → Y means X must come before Y. No node has in-degree 0: every course has a prerequisite, so the graph has a cycle and no topological order exists.',
        ),
  );
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    frame(t(`取出 ${u}，排在第 ${order.length} 位。`, `Take ${u}: it goes in position ${order.length}.`), u);
    edges.forEach(([a, b], i) => {
      if (a !== u) return;
      indegree.set(b, indegree.get(b)! - 1);
      removed.add(i);
      if (!indegree.get(b)) queue.push(b);
      frame(
        indegree.get(b)
          ? t(
              `删去边 ${u} → ${b}，${b} 的入度降到 ${indegree.get(b)}。`,
              `Remove ${u} → ${b}; ${b}'s in-degree drops to ${indegree.get(b)}.`,
            )
          : t(`删去边 ${u} → ${b}，${b} 的入度变为 0，入队。`, `Remove ${u} → ${b}; ${b}'s in-degree hits 0, so it joins the queue.`),
        u,
        i,
      );
    });
  }
  frame(
    order.length === nodes.length
      ? t(`完成，拓扑序为 ${order.join(' → ')}。`, `Done. A topological order: ${order.join(' → ')}.`)
      : t(
          `只输出了 ${order.length} 个节点，剩下的节点在环上，不存在拓扑序。`,
          `Only ${order.length} nodes came out; the rest sit on a cycle, so no topological order exists.`,
        ),
    '',
    -1,
    true,
  );
  return {
    title: t('拓扑排序 · Kahn 算法', 'Topological sort · Kahn’s algorithm'),
    question: t('按先修关系给 6 门课排一个可行的学习顺序', 'Order 6 courses so that every prerequisite comes first'),
    invariant: t(
      '队列里只放入度为 0 的节点：它的先修都已输出，现在输出不会违反任何边。',
      'The queue only holds nodes with in-degree 0: their prerequisites are out, so outputting them breaks no edge.',
    ),
    frames,
  };
}

/** Top-k with a min-heap of size k: the root is always the k-th largest seen so far. */
export function heapTrace(stream = [5, 2, 9, 1, 7, 8, 3], k = 3, t: Tr = zhText): DemoTrace {
  if (!Number.isInteger(k) || k < 1 || k > stream.length) throw new Error('Invalid heap demo input');
  const kth = `${k}${[11, 12, 13].includes(k % 100) ? 'th' : (['th', 'st', 'nd', 'rd'][k % 10] ?? 'th')}`;
  const heap: number[] = [],
    frames: DemoFrame[] = [];
  let next = 0;
  const frame = (caption: string, hot: number[] = [], done = false) => {
    const { pos, height } = layoutForest(heap.length ? ['0'] : [], (id) =>
      [2 * Number(id) + 1, 2 * Number(id) + 2].filter((c) => c < heap.length).map(String),
    );
    frames.push({
      caption,
      done,
      cells: heap.map((value, i) => ({
        value,
        label: `h[${i}]`,
        state: hot.includes(i) ? 'active' : done && i === 0 ? 'answer' : undefined,
      })),
      graph: {
        width: 100,
        height: Math.max(height, 30),
        nodes: heap.map((value, i) => ({
          id: String(i),
          label: String(value),
          ...pos.get(String(i))!,
          state: hot.includes(i) ? 'active' : i === 0 ? (done ? 'answer' : 'visited') : undefined,
        })),
        // Node i's parent is (i - 1) / 2.
        edges: heap.slice(1).map((_, j) => ({ from: String(Math.floor(j / 2)), to: String(j + 1) })),
      },
      stats: [
        ['k', String(k)],
        [t('堆大小', 'Heap size'), String(heap.length)],
        [t('第 k 大', 'k-th largest'), heap.length === k ? String(heap[0]) : '—'],
      ],
      queue: stream.slice(next).map(String),
    });
  };
  frame(
    t(
      `维护一个最多 ${k} 个元素的小顶堆：堆顶是堆里最小的数。`,
      `Keep a min-heap of at most ${k} numbers: the root is the smallest one inside.`,
    ),
  );
  while (next < stream.length) {
    const x = stream[next++];
    heap.push(x);
    let i = heap.length - 1;
    frame(t(`读入 ${x}，放到堆尾，准备上浮。`, `Read ${x} and put it at the end; sift it up.`), [i]);
    while (i > 0 && heap[(i - 1) >> 1] > heap[i]) {
      const p = (i - 1) >> 1;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      frame(t(`${heap[p]} 比父节点 ${heap[i]} 小，交换。`, `${heap[p]} is smaller than its parent ${heap[i]}: swap.`), [p, i]);
      i = p;
    }
    if (heap.length <= k) continue;
    const top = heap[0];
    heap[0] = heap.pop()!;
    frame(
      t(
        `堆里有 ${k + 1} 个数，弹出堆顶 ${top}：它不可能是前 ${k} 大。堆尾 ${heap[0]} 移到堆顶，准备下沉。`,
        `${k + 1} numbers inside: pop the root ${top}, which cannot be in the top ${k}. The last one, ${heap[0]}, moves to the root and sifts down.`,
      ),
      [0],
    );
    for (i = 0; ; ) {
      const l = 2 * i + 1,
        r = l + 1;
      let m = i;
      if (l < heap.length && heap[l] < heap[m]) m = l;
      if (r < heap.length && heap[r] < heap[m]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      frame(
        t(`${heap[m]} 比较小的孩子 ${heap[i]} 大，交换。`, `${heap[m]} is bigger than its smaller child ${heap[i]}: swap.`),
        [i, m],
      );
      i = m;
    }
  }
  frame(
    t(
      `数据流读完。堆里是前 ${k} 大的数，堆顶 ${heap[0]} 就是第 ${k} 大。`,
      `Stream finished. The heap holds the top ${k}; its root ${heap[0]} is the ${kth} largest.`,
    ),
    [],
    true,
  );
  return {
    title: t('堆 · 数据流中的第 k 大', 'Heap · k-th largest in a stream'),
    question: t(`数据流 ${stream.join(', ')}，求第 ${k} 大`, `Stream ${stream.join(', ')}: find the ${kth} largest`),
    invariant: t(
      '堆里始终是目前读到的最大的 k 个数；每次进出堆都是 O(log k)。',
      'The heap always holds the k largest numbers read so far; each push or pop costs O(log k).',
    ),
    queueLabel: t('还没读入的数据', 'Still to read'),
    frames,
  };
}

/** Next greater element with a stack whose values never increase from bottom to top. */
export function monotonicStackTrace(values = [3, 1, 4, 1, 5, 9, 2, 6], t: Tr = zhText): DemoTrace {
  const n = values.length,
    answer = Array<number | null>(n).fill(null),
    stack: number[] = [],
    frames: DemoFrame[] = [];
  let current = -1;
  const frame = (caption: string, done = false) =>
    frames.push({
      caption,
      done,
      cells: [
        ...values.map((value, i): DemoCell => ({
          value,
          label: String(i),
          state: i === current ? 'active' : stack.includes(i) ? 'visited' : answer[i] !== null ? 'muted' : undefined,
        })),
        ...answer.map((value, i): DemoCell => ({
          value: value ?? (done ? -1 : '·'),
          label: `ans[${i}]`,
          state: value !== null || done ? 'answer' : undefined,
        })),
      ],
      stats: [
        [t('当前下标', 'Index'), current < 0 ? '—' : String(current)],
        [t('栈大小', 'Stack size'), String(stack.length)],
      ],
      queue: stack.map((i) => `${values[i]} [${i}]`),
    });
  frame(
    t(
      '上一行是数组，下一行是答案：每个数右边第一个更大的数。栈里存还没找到答案的下标。',
      'Top row: the array. Bottom row: each value’s next greater value to its right. The stack keeps indexes still waiting for one.',
    ),
  );
  for (let i = 0; i < n; i++) {
    current = i;
    frame(t(`看下标 ${i}，值 ${values[i]}。`, `Look at index ${i}, value ${values[i]}.`));
    while (stack.length && values[stack.at(-1)!] < values[i]) {
      const j = stack.pop()!;
      answer[j] = values[i];
      frame(
        t(
          `栈顶 ${values[j]} < ${values[i]}：${values[i]} 就是下标 ${j} 右边第一个更大的数，弹出。`,
          `Top ${values[j]} < ${values[i]}: ${values[i]} is the next greater value for index ${j}. Pop it.`,
        ),
      );
    }
    stack.push(i);
    frame(t(`把下标 ${i} 压栈，等待它右边更大的数。`, `Push index ${i}; it waits for a greater value to its right.`));
  }
  current = -1;
  frame(
    t(
      '遍历结束。栈里剩下的下标右边没有更大的数，答案为 −1。',
      'Done. Indexes left on the stack have no greater value to their right: −1.',
    ),
    true,
  );
  return {
    title: t('单调栈 · 下一个更大元素', 'Monotonic stack · next greater element'),
    question: t(`数组 ${values.join(', ')}`, `Array ${values.join(', ')}`),
    invariant: t(
      '从栈底到栈顶，值不增；每个下标只进栈、出栈各一次，总共 O(n)。',
      'From bottom to top the values never increase; each index is pushed and popped once, O(n) in total.',
    ),
    columns: n,
    queueLabel: t('栈底 → 栈顶（值 [下标]）', 'Stack bottom → top (value [index])'),
    frames,
  };
}

/** Longest common subsequence: the table filled row by row, then one answer traced back. */
export function dpTableTrace(a = 'ACBD', b = 'ABCD', t: Tr = zhText): DemoTrace {
  const m = a.length,
    n = b.length,
    dp: (number | null)[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i && j ? null : 0)),
    ),
    frames: DemoFrame[] = [];
  type At = [number, number];
  const frame = (caption: string, current: At | null, from: At[] = [], path: At[] = [], done = false) => {
    const has = (list: At[], i: number, j: number) => list.some(([x, y]) => x === i && y === j);
    const cells: DemoCell[] = [
      { value: '', label: '', state: 'muted' },
      { value: '∅', label: '', state: 'muted' },
      ...Array.from(b, (ch): DemoCell => ({ value: ch, label: '', state: 'muted' })),
    ];
    for (let i = 0; i <= m; i++) {
      cells.push({ value: i ? a[i - 1] : '∅', label: '', state: 'muted' });
      for (let j = 0; j <= n; j++)
        cells.push({
          value: dp[i][j] ?? '·',
          label: `${i},${j}`,
          state: has(path, i, j)
            ? 'answer'
            : current && current[0] === i && current[1] === j
              ? 'active'
              : has(from, i, j)
                ? 'visited'
                : undefined,
        });
    }
    frames.push({
      caption,
      done,
      cells,
      stats: [[t('LCS 长度', 'LCS length'), dp[m][n] === null ? '—' : String(dp[m][n])]],
    });
  };
  frame(
    t(
      `dp[i][j] 是「${a}」前 i 个字符与「${b}」前 j 个字符的最长公共子序列长度。第 0 行和第 0 列是空串，都为 0。`,
      `dp[i][j] is the LCS length of the first i characters of "${a}" and the first j of "${b}". Row 0 and column 0 are empty strings: all 0.`,
    ),
    null,
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]! + 1;
        frame(
          t(
            `${a[i - 1]} = ${b[j - 1]}：取左上角 + 1，dp[${i}][${j}] = ${dp[i][j]}。`,
            `${a[i - 1]} = ${b[j - 1]}: take the top-left cell + 1, dp[${i}][${j}] = ${dp[i][j]}.`,
          ),
          [i, j],
          [[i - 1, j - 1]],
        );
      } else {
        dp[i][j] = Math.max(dp[i - 1][j]!, dp[i][j - 1]!);
        frame(
          t(
            `${a[i - 1]} ≠ ${b[j - 1]}：取上方和左方的较大值，dp[${i}][${j}] = ${dp[i][j]}。`,
            `${a[i - 1]} ≠ ${b[j - 1]}: take the larger of the cells above and to the left, dp[${i}][${j}] = ${dp[i][j]}.`,
          ),
          [i, j],
          [
            [i - 1, j],
            [i, j - 1],
          ],
        );
      }
  const path: At[] = [];
  let lcs = '';
  for (let i = m, j = n; i && j; )
    if (a[i - 1] === b[j - 1]) {
      path.push([i, j]);
      lcs = a[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j]! >= dp[i][j - 1]!) i--;
    else j--;
  frame(
    t(
      `填表完成，LCS 长度为 ${dp[m][n]}。从右下角倒推，绿色格子是匹配的字符：「${lcs}」。`,
      `Table done: the LCS has length ${dp[m][n]}. Walking back from the bottom right, the green cells are the matches: "${lcs}".`,
    ),
    null,
    [],
    path,
    true,
  );
  return {
    title: t('二维 DP · 填表求最长公共子序列', '2D DP · filling the LCS table'),
    question: t(`「${a}」和「${b}」的最长公共子序列`, `Longest common subsequence of "${a}" and "${b}"`),
    invariant: t(
      '按行从左到右填：算 dp[i][j] 时，它依赖的上方、左方、左上方都已算好。',
      'Rows fill left to right: when dp[i][j] is computed, the cells above, left and top-left are already final.',
    ),
    columns: n + 2,
    frames,
  };
}

/** Subsets by take/skip decisions: the recursion tree grows as the search walks it. */
export function backtrackingTrace(nums = [1, 2, 3], t: Tr = zhText): DemoTrace {
  // Four numbers make 16 leaves: a wider box, and every other leaf note one row lower.
  const crowded = nums.length > 3,
    width = crowded ? 160 : 120;
  // A node's id is its decision string ('y' took nums[depth], 'n' skipped it); the root is 'r'.
  const key = (id: string) => id || 'r';
  const layout = layoutForest(['r'], (id) => {
    const path = id === 'r' ? '' : id;
    return path.length < nums.length ? [`${path}y`, `${path}n`] : [];
  }, width, 15, 7);
  const { pos } = layout,
    height = layout.height + (crowded ? 3.6 : 0);
  // Leaves run left to right in binary: y = 0, n = 1.
  const noteDy = (id: string) =>
    crowded && id.length === nums.length && id.endsWith('n') ? 3.6 : undefined;
  const subset = (id: string) => `{${[...id].flatMap((c, i) => (c === 'y' ? [nums[i]] : [])).join(',')}}`;
  const seen: string[] = [],
    results: string[] = [],
    frames: DemoFrame[] = [];
  const frame = (caption: string, current: string | null, done = false) =>
    frames.push({
      caption,
      done,
      cells: [],
      graph: {
        width,
        height,
        nodes: seen.map((id) => ({
          id: key(id),
          label: '',
          ...pos.get(key(id))!,
          note: subset(id),
          noteDy: noteDy(id),
          state:
            current !== null && id === current
              ? 'active'
              : current !== null && current.startsWith(id)
                ? 'visited'
                : id.length === nums.length
                  ? 'answer'
                  : undefined,
        })),
        edges: seen
          .filter(Boolean)
          .map((id) => ({
            from: key(id.slice(0, -1)),
            to: id,
            label: id.endsWith('y') ? `+${nums[id.length - 1]}` : undefined,
            state: id.endsWith('n') ? 'muted' : current !== null && current.startsWith(id) ? 'visited' : undefined,
          })),
      },
      stats: [
        [t('深度', 'Depth'), current === null ? '—' : String(current.length)],
        [t('当前路径', 'Path'), current === null ? '—' : subset(current)],
        [t('结果数', 'Results'), String(results.length)],
      ],
      queue: [...results],
    });
  const walk = (id: string) => {
    seen.push(id);
    if (id.length === nums.length) {
      results.push(subset(id));
      frame(t(`走到叶子，记录子集 ${subset(id)}。`, `A leaf: record the subset ${subset(id)}.`), id);
      return;
    }
    const x = nums[id.length];
    frame(
      id
        ? t(`在 ${subset(id)}，下一步决定是否选 ${x}。`, `At ${subset(id)}; next, decide whether to take ${x}.`)
        : t(`从空集出发，先决定是否选 ${x}。`, `Start from the empty set; first decide whether to take ${x}.`),
      id,
    );
    walk(`${id}y`);
    frame(
      t(`回溯：撤销「选 ${x}」，改走「不选 ${x}」的分支。`, `Backtrack: undo "take ${x}" and try the "skip ${x}" branch.`),
      id,
    );
    walk(`${id}n`);
  };
  walk('');
  frame(
    t(
      `搜索结束，${nums.length} 个数共有 ${results.length} 个子集。`,
      `Search finished: ${nums.length} numbers have ${results.length} subsets.`,
    ),
    null,
    true,
  );
  return {
    title: t('回溯 · 子集的决策树', 'Backtracking · the subset decision tree'),
    question: t(`列出 [${nums.join(', ')}] 的所有子集`, `List every subset of [${nums.join(', ')}]`),
    invariant: t(
      '每层决定一个数选或不选；递归返回时撤销这一步，路径恢复原状，再试另一个分支。',
      'Each level decides one number, take or skip; returning undoes that choice so the path is restored before the other branch.',
    ),
    queueLabel: t('已收集的子集', 'Subsets collected'),
    frames,
  };
}

/** Insert words into a trie, then look a few up. A node's id is the prefix it spells; the root is 'r'. */
export function trieTrace(
  words = ['cat', 'car', 'cart', 'dog', 'do'],
  queries = ['car', 'cap', 'do'],
  t: Tr = zhText,
): DemoTrace {
  const children = new Map<string, string[]>([['', []]]);
  for (const w of words)
    for (let i = 1; i <= w.length; i++) {
      const p = w.slice(0, i);
      if (!children.has(p)) {
        children.set(p, []);
        children.get(w.slice(0, i - 1))!.push(p);
      }
    }
  const key = (id: string) => id || 'r';
  // Laid out once for the finished trie, so nodes do not jump while it grows.
  const { pos, height } = layoutForest(['r'], (id) => children.get(id === 'r' ? '' : id)!);
  const made = new Set<string>(['']),
    ends = new Set<string>(),
    frames: DemoFrame[] = [];
  const frame = (caption: string, path: string[] = [], found: boolean | null = null, done = false) =>
    frames.push({
      caption,
      done,
      cells: [],
      graph: {
        width: 100,
        height,
        nodes: [...made].map((id) => ({
          id: key(id),
          label: id ? id.at(-1)! : '·',
          ...pos.get(key(id))!,
          note: ends.has(id) ? id : undefined,
          state:
            found !== null && path.at(-1) === id
              ? found
                ? 'answer'
                : 'blocked'
              : path.includes(id)
                ? 'active'
                : ends.has(id)
                  ? 'visited'
                  : undefined,
        })),
        edges: [...made].filter(Boolean).map((id) => ({
          from: key(id.slice(0, -1)),
          to: id,
          state: path.includes(id) ? ('active' as const) : undefined,
        })),
      },
      stats: [
        [t('节点数', 'Nodes'), String(made.size)],
        [t('单词数', 'Words'), String(ends.size)],
      ],
    });
  frame(
    t(
      '只有一个空的根节点。每条边代表一个字符，路径拼出前缀。',
      'Only an empty root. Each edge is one character; a path spells a prefix.',
    ),
  );
  for (const w of words) {
    const path = [''];
    for (let i = 1; i <= w.length; i++) {
      const p = w.slice(0, i);
      path.push(p);
      const fresh = !made.has(p);
      made.add(p);
      frame(
        fresh
          ? t(`插入「${w}」：前缀「${p}」不存在，新建节点 ${p.at(-1)}。`, `Insert "${w}": prefix "${p}" is new, create node ${p.at(-1)}.`)
          : t(`插入「${w}」：前缀「${p}」已存在，直接复用。`, `Insert "${w}": prefix "${p}" exists, reuse it.`),
        path,
      );
    }
    ends.add(w);
    frame(t(`在「${w}」的最后一个节点打上单词结束标记。`, `Mark the last node of "${w}" as the end of a word.`), path);
  }
  for (const q of queries) {
    const path = [''];
    for (let i = 1; i <= q.length && made.has(q.slice(0, i)); i++) path.push(q.slice(0, i));
    const walked = path.length === q.length + 1,
      found = walked && ends.has(q);
    frame(
      found
        ? t(`查找「${q}」：路径完整且末尾有结束标记，存在。`, `Search "${q}": the path exists and ends on a word mark, found.`)
        : walked
          ? t(`查找「${q}」：路径存在，但末尾没有结束标记，只是前缀。`, `Search "${q}": the path exists but has no word mark, only a prefix.`)
          : t(
              `查找「${q}」：走到「${path.at(-1)}」后没有下一个字符，不存在。`,
              `Search "${q}": the path stops after "${path.at(-1)}", not found.`,
            ),
      path,
      found,
    );
  }
  frame(
    t(
      `完成。${ends.size} 个单词共用前缀，只用了 ${made.size} 个节点；查找只与单词长度有关。`,
      `Done. ${ends.size} words share prefixes in ${made.size} nodes; a lookup costs only the word’s length.`,
    ),
    [],
    null,
    true,
  );
  return {
    title: t('字典树 · 插入与查找', 'Trie · insert and search'),
    question: t(
      `插入 ${words.join(', ')}，再查找 ${queries.join(', ')}`,
      `Insert ${words.join(', ')}, then search ${queries.join(', ')}`,
    ),
    invariant: t(
      '从根到任一节点的路径就是一个前缀；节点下写着单词的，才是一个完整单词的结尾。',
      'The path from the root to any node is a prefix; only nodes with a word written under them end a whole word.',
    ),
    frames,
  };
}

/** Insert into a sorted array (shift right), delete by index (shift left), then dedupe in place with a write pointer. */
export function arrayOpsTrace(values = [1, 2, 2, 4, 4, 4, 6], x = 3, del = 0, t: Tr = zhText): DemoTrace {
  if (!Number.isInteger(del) || del < 0 || del > values.length) throw new Error('Invalid array demo input');
  const a: (number | null)[] = [...values, null],
    frames: DemoFrame[] = [];
  let length = values.length,
    moves = 0,
    w = -1,
    r = -1;
  const frame = (caption: string, hot: number[] = [], done = false) =>
    frames.push({
      caption,
      done,
      cells: a.map((value, i) => ({
        value: value ?? '·',
        label: String(i),
        state: hot.includes(i) ? 'active' : i >= length ? 'muted' : done ? 'answer' : i < w ? 'visited' : undefined,
      })),
      stats: [
        [t('长度', 'Length'), String(length)],
        [t('搬移次数', 'Moves'), String(moves)],
        ['w', w < 0 ? '—' : String(w)],
        ['r', r < 0 ? '—' : String(r)],
      ],
    });
  frame(
    t(
      '一个有序数组，末尾留了一个空位（·）。数组在内存里是连续的，插入和删除都要搬动后面的元素。',
      'A sorted array with one free slot (·) at the end. Arrays are contiguous, so inserting or deleting shifts the elements after it.',
    ),
  );
  let j = length - 1;
  while (j >= 0 && a[j]! > x) {
    a[j + 1] = a[j];
    moves++;
    frame(t(`插入 ${x}：${a[j]} > ${x}，右移到位置 ${j + 1}。`, `Insert ${x}: ${a[j]} > ${x}, shift it right to position ${j + 1}.`), [j, j + 1]);
    j--;
  }
  a[j + 1] = x;
  length++;
  frame(
    t(
      `把 ${x} 写进位置 ${j + 1}。这次插入搬了 ${length - 2 - j} 个元素，最坏要搬 n 个：O(n)。`,
      `Write ${x} into position ${j + 1}. Elements shifted by this insert: ${length - 2 - j}; the worst case shifts all n: O(n).`,
    ),
    [j + 1],
  );
  const gone = a[del];
  frame(t(`删除位置 ${del} 的 ${gone}：它后面的元素依次左移一格。`, `Delete ${gone} at position ${del}: every element after it shifts left by one.`), [del]);
  for (let i = del; i < length - 1; i++) {
    a[i] = a[i + 1];
    moves++;
    frame(t(`${a[i]} 左移到位置 ${i}。`, `${a[i]} shifts left to position ${i}.`), [i, i + 1]);
  }
  a[--length] = null;
  frame(t(`末尾空出一格，长度减 1，删除完成。`, `The last slot is free again: length − 1, the delete is done.`));
  w = 0;
  frame(
    t(
      '原地去重：读指针 r 从左往右扫，写指针 w 左边是已经保留的结果。r 的值和 w 左边最后一个不同才写入。',
      'Dedupe in place: the read pointer r scans left to right; everything left of the write pointer w is kept. r is written only when it differs from the last kept value.',
    ),
  );
  for (r = 0; r < length; r++) {
    if (w > 0 && a[w - 1] === a[r]) {
      frame(t(`a[r] = ${a[r]} 和 a[w−1] 相同，跳过。`, `a[r] = ${a[r]} equals a[w−1]: skip it.`), [r]);
      continue;
    }
    if (w !== r) {
      a[w] = a[r];
      moves++;
    }
    w++;
    frame(t(`a[r] = ${a[r]} 是新值，写到位置 ${w - 1}，w 前进。`, `a[r] = ${a[r]} is new: write it at position ${w - 1}, w moves on.`), [r, w - 1]);
  }
  length = w;
  r = -1;
  frame(
    t(
      `扫描结束：前 ${w} 个是去重后的数组，后面的格子不再算数。两个指针各走一遍，O(n) 时间、O(1) 额外空间。`,
      `Done: everything left of w = ${w} is the deduplicated array; the rest no longer counts. Each pointer passes once: O(n) time, O(1) extra space.`,
    ),
    [],
    true,
  );
  return {
    title: t('数组 · 插入、删除与原地去重', 'Arrays · insert, delete, dedupe in place'),
    question: t(`有序数组 ${values.join(', ')}：插入 ${x}，删除下标 ${del}，再去重`, `Sorted array ${values.join(', ')}: insert ${x}, delete index ${del}, then dedupe`),
    invariant: t(
      '数组始终连续存放：中间插入或删除要搬动后面的元素；去重时 w 左边就是最终结果。',
      'The array always stays contiguous: inserting or deleting in the middle shifts what follows; while deduping, everything left of w is final.',
    ),
    frames,
  };
}

/** Separate chaining with h(k) = k mod buckets; past a load factor of 0.75 the table doubles and rehashes. */
export function hashTableTrace(keys = [12, 7, 4, 15, 9, 20, 3], t: Tr = zhText): DemoTrace {
  let buckets: number[][] = [[], [], [], []],
    size = 0,
    resizes = 0;
  const frames: DemoFrame[] = [];
  const frame = (caption: string, hot = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: buckets.map((chain, i) => ({
        value: chain.length ? chain.join('→') : '∅',
        label: `[${i}]`,
        state: i === hot ? 'active' : done && chain.length ? 'answer' : chain.length ? undefined : 'muted',
      })),
      stats: [
        [t('键数', 'Keys'), String(size)],
        [t('桶数', 'Buckets'), String(buckets.length)],
        [t('负载因子', 'Load factor'), (size / buckets.length).toFixed(2)],
        [t('扩容次数', 'Resizes'), String(resizes)],
      ],
    });
  frame(
    t(
      `${buckets.length} 个空桶。键 k 放进第 k mod 桶数 号桶；同一个桶里的键串成链表（拉链法）。`,
      `${buckets.length} empty buckets. Key k goes to bucket k mod (bucket count); keys that land in one bucket form a chain.`,
    ),
  );
  for (const k of keys) {
    const b = k % buckets.length,
      chain = buckets[b];
    if (chain.includes(k)) {
      frame(t(`${k} 已经在桶 ${b} 里：键不重复，不再插入。`, `${k} is already in bucket ${b}: keys are unique, nothing to add.`), b);
      continue;
    }
    chain.push(k);
    size++;
    frame(
      chain.length > 1
        ? t(
            `${k} mod ${buckets.length} = ${b}：桶 ${b} 里已经有 ${chain.slice(0, -1).join('、')}，冲突了，接到链表末尾。`,
            `${k} mod ${buckets.length} = ${b}: bucket ${b} already holds ${chain.slice(0, -1).join(', ')}, a collision; append it to the chain.`,
          )
        : t(`${k} mod ${buckets.length} = ${b}：放进空桶 ${b}。`, `${k} mod ${buckets.length} = ${b}: it goes into empty bucket ${b}.`),
      b,
    );
    if (size / buckets.length <= 0.75) continue;
    const old = buckets.flat();
    buckets = Array.from({ length: buckets.length * 2 }, () => []);
    resizes++;
    frame(
      t(
        `负载因子 ${size}/${buckets.length / 2} > 0.75：桶数翻倍到 ${buckets.length}，每个键都要按新的桶数重新计算位置。`,
        `Load factor ${size}/${buckets.length / 2} > 0.75: double to ${buckets.length} buckets; every key is placed again by the new count.`,
      ),
    );
    for (const key of old) {
      const nb = key % buckets.length;
      buckets[nb].push(key);
      frame(t(`重新哈希：${key} mod ${buckets.length} = ${nb}。`, `Rehash: ${key} mod ${buckets.length} = ${nb}.`), nb);
    }
  }
  frame(
    t(
      `插入完成：${size} 个键、${buckets.length} 个桶，负载因子 ${(size / buckets.length).toFixed(2)}。链表都很短，查找平均 O(1)；一次扩容是 O(n)，均摊到每次插入仍是 O(1)。`,
      `All inserted. Keys: ${size}, buckets: ${buckets.length}, load factor ${(size / buckets.length).toFixed(2)}. Chains stay short, so a lookup is O(1) on average; one resize costs O(n), still O(1) amortized per insert.`,
    ),
    -1,
    true,
  );
  return {
    title: t('哈希表 · 拉链法与扩容', 'Hash table · chaining and resizing'),
    question: t(`依次插入 ${keys.join(', ')}`, `Insert ${keys.join(', ')} in order`),
    invariant: t(
      '键 k 总在第 k mod 桶数 号桶里；负载因子不超过 0.75，链表的平均长度就是常数。',
      'Key k always sits in bucket k mod (bucket count); with the load factor at most 0.75, chains stay constant length on average.',
    ),
    frames,
  };
}

/** A singly linked list: insert and delete by rewiring pointers, then reverse it in place. */
export function linkedListTrace(values = [1, 2, 3, 4], x = 9, at = 2, del = 0, t: Tr = zhText): DemoTrace {
  if (!Number.isInteger(at) || at < 0 || at > values.length || !Number.isInteger(del) || del < 0 || del > values.length)
    throw new Error('Invalid linked list demo input');
  const value = new Map<string, number>(values.map((v, k) => [`n${k}`, v]));
  const next = new Map<string, string | null>(values.map((_, k) => [`n${k}`, k + 1 < values.length ? `n${k + 1}` : null]));
  const fresh = `n${values.length}`;
  value.set(fresh, x);
  let head: string | null = values.length ? 'n0' : null,
    pending: string | null = null,
    pendingAt = 0,
    pointers: Record<string, string | null> = {},
    reversing = false;
  // Slots left to right; a node being inserted is drawn below the row until it is linked in.
  const order = values.map((_, k) => `n${k}`);
  const frames: DemoFrame[] = [];
  const chain = (from: string | null) => {
    const ids: string[] = [];
    for (let p = from; p && ids.length <= value.size; p = next.get(p) ?? null) ids.push(p);
    return ids;
  };
  const walk = (from: string | null) => chain(from).map((id) => value.get(id)).join(' → ') || '∅';
  const frame = (caption: string, hot: string[] = [], done = false) => {
    const slots = order.length + (pending ? 1 : 0),
      step = slots > 1 ? 84 / (slots - 1) : 0;
    const drawn = pending ? [...order, pending] : order;
    const xy = (id: string) =>
      id === pending
        ? { x: 8 + step * Math.max(0, pendingAt - 0.5), y: 38 }
        : { x: slots > 1 ? 8 + step * order.indexOf(id) : 50, y: 16 };
    const reversed = reversing ? chain(pointers.prev ?? null) : [];
    const names = (id: string) =>
      Object.entries(pointers)
        .filter(([, p]) => p === id)
        .map(([name]) => name);
    frames.push({
      caption,
      done,
      cells: [],
      graph: {
        width: 100,
        height: 50,
        nodes: drawn.map((id) => ({
          id,
          label: String(value.get(id)),
          ...xy(id),
          note: [...(id === head && !reversing ? ['head'] : []), ...names(id)].join(',') || undefined,
          state: hot.includes(id) ? 'active' : done ? 'answer' : reversed.includes(id) ? 'visited' : undefined,
        })),
        edges: drawn.flatMap((id) => {
          const to = next.get(id);
          return to && drawn.includes(to) ? [{ from: id, to, directed: true, state: hot.includes(id) ? ('active' as const) : undefined }] : [];
        }),
      },
      stats: reversing
        ? [
            ['prev', walk(pointers.prev ?? null)],
            ['cur', walk(pointers.cur ?? null)],
          ]
        : [[t('从 head 读', 'From head'), walk(head)]],
    });
  };
  frame(t('每个结点存一个值和指向下一个结点的指针。从 head 出发只能一个一个往后走。', 'Each node holds a value and a pointer to the next node. From head you can only walk forward one node at a time.'));
  // Insert x so that it becomes position `at`.
  const before = at ? order[at - 1] : null;
  pointers = before ? { prev: before } : {};
  pending = fresh;
  pendingAt = at;
  frame(
    before
      ? t(`插入 ${x} 到位置 ${at}：从 head 走 ${at - 1} 步找到前一个结点 ${value.get(before)}，再新建结点 ${x}。`, `Insert ${x} at position ${at}: walk ${at - 1} steps from head to the node before it, ${value.get(before)}, and create node ${x}.`)
      : t(`插入 ${x} 到表头：新建结点 ${x}。`, `Insert ${x} at the front: create node ${x}.`),
    [fresh],
  );
  next.set(fresh, before ? next.get(before)! : head);
  frame(
    t(`先让新结点指向${before ? ' prev 的' : '原来的'}下一个结点。顺序反过来的话，后半段就找不到了。`, `First point the new node at ${before ? 'prev’s next node' : 'the old head'}. Doing this second would lose the rest of the list.`),
    [fresh],
  );
  if (before) next.set(before, fresh);
  else head = fresh;
  frame(before ? t('再让 prev 指向新结点。只改了两根指针：O(1)。', 'Then point prev at the new node. Two pointers changed: O(1).') : t('head 改指向新结点。只改了两根指针：O(1)。', 'Move head to the new node. Two pointers changed: O(1).'), before ? [before, fresh] : [fresh]);
  order.splice(at, 0, fresh);
  pending = null;
  pointers = {};
  frame(t(`插入完成。`, `Insert done.`));
  // Delete position `del`.
  const target = order[del],
    prevNode = del ? order[del - 1] : null;
  pointers = prevNode ? { prev: prevNode } : {};
  frame(t(`删除位置 ${del} 的结点 ${value.get(target)}。`, `Delete node ${value.get(target)} at position ${del}.`), [target]);
  if (prevNode) next.set(prevNode, next.get(target)!);
  else head = next.get(target)!;
  frame(
    prevNode
      ? t(`让 prev 直接指向 ${value.get(target)} 的下一个结点，跳过它。`, `Point prev straight at the node after ${value.get(target)}, skipping it.`)
      : t(`head 改指向第二个结点。`, `Move head to the second node.`),
    prevNode ? [prevNode] : [],
  );
  order.splice(del, 1);
  next.delete(target);
  pointers = {};
  frame(t(`结点 ${value.get(target)} 已经从链上摘下来，删除完成。`, `Node ${value.get(target)} is off the list: delete done.`));
  // Reverse in place.
  reversing = true;
  pointers = { prev: null, cur: head };
  frame(t('原地反转：prev = None，cur = head。每一步把 cur 的指针掉头指向 prev。', 'Reverse in place: prev = None, cur = head. Each step turns cur’s pointer around to prev.'), head ? [head] : []);
  while (pointers.cur) {
    const cur = pointers.cur,
      nxt = next.get(cur) ?? null;
    pointers = { prev: pointers.prev, cur, nxt };
    next.set(cur, pointers.prev ?? null);
    frame(
      t(`先记住 nxt = ${nxt ? value.get(nxt) : 'None'}，再让 ${value.get(cur)} 指向 ${pointers.prev ? value.get(pointers.prev) : 'None'}。`, `Save nxt = ${nxt ? value.get(nxt) : 'None'}, then point ${value.get(cur)} at ${pointers.prev ? value.get(pointers.prev) : 'None'}.`),
      [cur],
    );
    pointers = { prev: cur, cur: nxt };
    frame(t('prev 和 cur 各前进一步。', 'prev and cur each move one step forward.'), nxt ? [nxt] : []);
  }
  head = pointers.prev ?? null;
  reversing = false;
  pointers = {};
  frame(
    t(`cur 走到 None，prev 就是新的 head：${walk(head)}。每个结点只处理一次，O(n) 时间、O(1) 空间。`, `cur reached None, so prev is the new head: ${walk(head)}. Each node is handled once: O(n) time, O(1) space.`),
    [],
    true,
  );
  return {
    title: t('链表 · 改指针完成插入、删除、反转', 'Linked list · insert, delete and reverse by rewiring'),
    question: t(`链表 ${values.join(' → ')}：在位置 ${at} 插入 ${x}，删除位置 ${del}，再反转`, `List ${values.join(' → ')}: insert ${x} at position ${at}, delete position ${del}, then reverse`),
    invariant: t(
      '改一根指针之前，先保存它原来指向的结点，链表就不会断。',
      'Before changing a pointer, save the node it pointed to, and the list never breaks.',
    ),
    frames,
  };
}

const TREE_KIDS: Record<string, [string | null, string | null]> = {
  A: ['B', 'C'],
  B: ['D', 'E'],
  C: ['F', 'G'],
  D: [null, null],
  E: [null, null],
  F: [null, null],
  G: [null, null],
};
export type TreeOrder = 'pre' | 'in' | 'post' | 'level';
export const TREE_ORDERS: TreeOrder[] = ['pre', 'in', 'post', 'level'];
/**
 * Preorder, inorder and postorder with one explicit stack (a node is pushed once to expand and once,
 * marked ✓, to output), then level order with a queue.
 */
export function treeTraversalTrace(orders: TreeOrder[] = TREE_ORDERS, t: Tr = zhText): DemoTrace {
  const kids = (id: string) => TREE_KIDS[id].filter((k): k is string => k !== null);
  const { pos, height } = layoutForest(['A'], kids);
  const names: Record<TreeOrder, [string, string, string, string]> = {
    pre: ['前序', 'Preorder', '根 → 左 → 右', 'root → left → right'],
    in: ['中序', 'Inorder', '左 → 根 → 右', 'left → root → right'],
    post: ['后序', 'Postorder', '左 → 右 → 根', 'left → right → root'],
    level: ['层序', 'Level order', '一层一层，从左到右', 'level by level, left to right'],
  };
  const frames: DemoFrame[] = [],
    results: [string, string][] = [];
  let out: string[] = [],
    box: string[] = [],
    order: TreeOrder = orders[0] ?? 'pre';
  const frame = (caption: string, current = '', done = false) =>
    frames.push({
      caption,
      done,
      cells: [],
      graph: {
        width: 100,
        height,
        nodes: Object.keys(TREE_KIDS).map((id) => ({
          id,
          label: id,
          ...pos.get(id)!,
          note: !done && out.includes(id) ? `#${out.indexOf(id) + 1}` : undefined,
          state: id === current ? 'active' : done ? 'answer' : out.includes(id) ? 'visited' : undefined,
        })),
        edges: Object.keys(TREE_KIDS).flatMap((id) => kids(id).map((k) => ({ from: id, to: k }))),
      },
      stats: done ? results : [[t('遍历', 'Order'), t(names[order][0], names[order][1])], [t('输出', 'Output'), out.join(' ') || '—']],
      queue: done ? undefined : [...box],
    });
  frame(t('同一棵树，四种遍历顺序。节点下的 #k 是它在当前遍历里第几个输出。', 'One tree, four traversal orders. #k under a node is its position in the current output.'));
  for (order of orders) {
    const [zh, en, ruleZh, ruleEn] = names[order];
    out = [];
    if (order === 'level') {
      box = ['A'];
      frame(t(`${zh}（${ruleZh}）：用队列，先放入根。`, `${en} (${ruleEn}): use a queue, starting with the root.`));
      while (box.length) {
        const u = box.shift()!;
        out.push(u);
        box.push(...kids(u));
        frame(
          t(`出队 ${u} 并输出，再把它的孩子 ${kids(u).join('、') || '（无）'} 放到队尾。`, `Dequeue ${u} and output it, then add its children ${kids(u).join(', ') || '(none)'} to the back.`),
          u,
        );
      }
    } else {
      const stack: [string, boolean][] = [['A', false]];
      const show = () => (box = stack.map(([id, ready]) => (ready ? `${id}✓` : id)));
      show();
      frame(t(`${zh}（${ruleZh}）：用栈，先压入根。带 ✓ 的表示「下次弹出就输出」。`, `${en} (${ruleEn}): use a stack, starting with the root. A ✓ means "output it when popped".`));
      while (stack.length) {
        const [u, ready] = stack.pop()!;
        if (ready) {
          out.push(u);
          show();
          frame(t(`弹出 ${u}✓，输出 ${u}。`, `Pop ${u}✓ and output ${u}.`), u);
          continue;
        }
        const [l, r] = TREE_KIDS[u].map((id): [string, boolean] | null => (id ? [id, false] : null)),
          self: [string, boolean] = [u, true];
        const plan = order === 'pre' ? [self, l, r] : order === 'in' ? [l, self, r] : [l, r, self];
        const pushes = plan.filter((p): p is [string, boolean] => p !== null).reverse();
        stack.push(...pushes);
        show();
        frame(
          t(
            `弹出 ${u}，要按「${ruleZh}」输出，就倒过来压栈：${pushes.map(([id, mark]) => (mark ? `${id}✓` : id)).join('、')}。`,
            `Pop ${u}. To output ${ruleEn}, push in reverse: ${pushes.map(([id, mark]) => (mark ? `${id}✓` : id)).join(', ')}.`,
          ),
          u,
        );
      }
    }
    box = [];
    results.push([t(zh, en), out.join(' ')]);
    frame(t(`${zh}遍历结果：${out.join(' ')}。`, `${en}: ${out.join(' ')}.`));
  }
  frame(
    t(
      `完成。每种遍历每个节点进出一次，都是 O(n)；栈或队列最多存 O(树高) 或 O(最宽一层) 个节点。`,
      `Done. Every order touches each node a constant number of times: O(n). The stack holds O(height) nodes, the queue O(widest level).`,
    ),
    '',
    true,
  );
  return {
    title: t('二叉树遍历 · 栈与队列', 'Tree traversal · stack and queue'),
    question: t(`${orders.map((o) => names[o][0]).join('、')}遍历这棵树`, `Walk the tree in ${orders.map((o) => names[o][1].toLowerCase()).join(', ')}`),
    invariant: t(
      '深度优先的三种顺序只差在「输出根」排在左右子树的前、中、后；层序用队列，先进先出就是一层一层。',
      'The three depth-first orders differ only in where the root is output: before, between or after its subtrees. Level order uses a queue, and first in, first out means level by level.',
    ),
    queueLabel: t('栈底 → 栈顶，或队首 → 队尾', 'Stack bottom → top, or queue front → back'),
    frames,
  };
}

export type BstOp = ['find' | 'insert' | 'delete', number];
type BstNode = { id: string; key: number; left: BstNode | null; right: BstNode | null };
/** Find, insert, and delete's three cases (leaf, one child, two children: the in-order successor takes over). */
export function bstTrace(
  keys = [8, 3, 10, 1, 6, 14, 4, 7, 13],
  ops: BstOp[] = [
    ['find', 6],
    ['insert', 5],
    ['delete', 1],
    ['delete', 14],
    ['delete', 8],
  ],
  t: Tr = zhText,
): DemoTrace {
  let root: BstNode | null = null,
    made = 0,
    operation = '—',
    compares = 0;
  const frames: DemoFrame[] = [];
  const add = (key: number) => {
    const node: BstNode = { id: `k${made++}`, key, left: null, right: null };
    if (!root) return (root = node);
    for (let p = root; ; ) {
      if (key === p.key) return p;
      const side = key < p.key ? 'left' : 'right';
      if (!p[side]) return (p[side] = node);
      p = p[side]!;
    }
  };
  for (const k of keys) add(k);
  const inorder = (n: BstNode | null): number[] => (n ? [...inorder(n.left), n.key, ...inorder(n.right)] : []);
  const frame = (caption: string, path: BstNode[] = [], hit: BstNode | null = null, done = false) => {
    const all = new Map<string, BstNode>();
    const collect = (n: BstNode | null) => {
      if (!n) return;
      all.set(n.id, n);
      collect(n.left);
      collect(n.right);
    };
    collect(root);
    // A lone child gets an invisible sibling, so a left child is drawn on the left.
    const layout = layoutForest(root ? [root.id] : [], (id) => {
      const n = all.get(id);
      if (!n || (!n.left && !n.right)) return [];
      return [n.left?.id ?? `${id}-l`, n.right?.id ?? `${id}-r`];
    });
    frames.push({
      caption,
      done,
      cells: [],
      graph: {
        width: 100,
        height: Math.max(layout.height, 30),
        nodes: [...all.values()].map((n) => ({
          id: n.id,
          label: String(n.key),
          ...layout.pos.get(n.id)!,
          state: n === hit ? 'answer' : path.includes(n) ? 'active' : undefined,
        })),
        edges: [...all.values()].flatMap((n) =>
          [n.left, n.right].flatMap((c) => (c ? [{ from: n.id, to: c.id, state: path.includes(c) && path.includes(n) ? ('active' as const) : undefined }] : [])),
        ),
      },
      stats: [
        [t('操作', 'Operation'), operation],
        [t('比较次数', 'Comparisons'), String(compares)],
        [t('中序', 'In-order'), inorder(root).join(' ') || '∅'],
      ],
    });
  };
  /** Walks from the root toward key, one frame per step; returns the path (its last node holds key if found). */
  const search = (key: number) => {
    const path: BstNode[] = [];
    for (let p = root; p; p = key < p.key ? p.left : p.right) {
      path.push(p);
      compares++;
      if (key === p.key) break;
      frame(
        key < p.key
          ? t(`${key} < ${p.key}：答案只可能在左子树，往左走。`, `${key} < ${p.key}: it can only be in the left subtree, go left.`)
          : t(`${key} > ${p.key}：答案只可能在右子树，往右走。`, `${key} > ${p.key}: it can only be in the right subtree, go right.`),
        [...path],
      );
    }
    return path;
  };
  frame(
    t(
      `依次插入 ${keys.join(', ')} 得到这棵二叉搜索树：每个节点左边都比它小，右边都比它大，所以中序遍历是有序的。`,
      `Inserting ${keys.join(', ')} in order gives this binary search tree: everything left of a node is smaller, everything right is bigger, so the in-order walk is sorted.`,
    ),
  );
  for (const [op, key] of ops) {
    operation = `${op}(${key})`;
    compares = 0;
    const path = search(key),
      node = path.at(-1)?.key === key ? path.at(-1)! : null;
    if (op === 'find') {
      frame(
        node
          ? t(`找到 ${key}，比较了 ${compares} 次，最多是树高。`, `Found ${key} after ${compares} comparisons, at most the tree's height.`)
          : t(`走到空位置，${key} 不在树里。`, `Reached an empty spot: ${key} is not in the tree.`),
        path,
        node,
      );
    } else if (op === 'insert') {
      if (node) {
        frame(t(`${key} 已经在树里，不重复插入。`, `${key} is already in the tree; no duplicate.`), path, node);
        continue;
      }
      const fresh = add(key)!;
      frame(t(`在走到的空位置挂上新叶子 ${key}。`, `Hang the new leaf ${key} on the empty spot the walk reached.`), [...path, fresh], fresh);
    } else if (!node) frame(t(`${key} 不在树里，没有可删除的。`, `${key} is not in the tree; nothing to delete.`), path);
    else {
      const parent = path.at(-2) ?? null;
      const relink = (child: BstNode | null) => {
        if (!parent) root = child;
        else if (parent.left === node) parent.left = child;
        else parent.right = child;
      };
      if (!node.left || !node.right) {
        const child = node.left ?? node.right;
        frame(
          child
            ? t(`情况二：${key} 只有一个孩子 ${child.key}，让孩子顶替它的位置。`, `Case 2: ${key} has one child, ${child.key}; the child takes its place.`)
            : t(`情况一：${key} 是叶子，直接删掉。`, `Case 1: ${key} is a leaf; just remove it.`),
          path,
        );
        relink(child);
        frame(t(`删除 ${key} 完成。`, `${key} is deleted.`), child ? [child] : []);
      } else {
        const trail = [node.right];
        while (trail.at(-1)!.left) trail.push(trail.at(-1)!.left!);
        const next = trail.at(-1)!,
          above = trail.at(-2) ?? node;
        frame(
          t(
            `情况三：${key} 有两个孩子。找中序后继：右子树里最小的 ${next.key}（一直往左走）。`,
            `Case 3: ${key} has two children. Find its in-order successor, the smallest key in the right subtree: ${next.key} (keep going left).`,
          ),
          [...path, ...trail],
        );
        node.key = next.key;
        if (above === node) above.right = next.right;
        else above.left = next.right;
        frame(
          t(
            `用 ${next.key} 顶替 ${key}，再把原来的 ${next.key} 摘掉：它没有左孩子，按情况一或二处理。`,
            `Put ${next.key} in ${key}'s place, then unhook the old ${next.key}: it has no left child, so case 1 or 2 applies.`,
          ),
          [node],
        );
      }
    }
  }
  operation = '—';
  frame(
    t('全部操作完成，中序遍历仍然有序。每个操作只走一条从根往下的路径：O(树高)。', 'All operations done, and the in-order walk is still sorted. Each operation walks one root-to-leaf path: O(height).'),
    [],
    null,
    true,
  );
  return {
    title: t('二叉搜索树 · 查找、插入、删除', 'Binary search tree · find, insert, delete'),
    question: t(`依次执行 ${ops.map(([op, k]) => `${op}(${k})`).join('、')}`, `Run ${ops.map(([op, k]) => `${op}(${k})`).join(', ')}`),
    invariant: t(
      '任意节点：左子树的键都比它小，右子树的键都比它大。',
      'At every node, keys in the left subtree are smaller and keys in the right subtree are bigger.',
    ),
    frames,
  };
}

/** Kruskal on Dijkstra's graph: edges by weight, union-find decides take or skip. */
export function kruskalTrace(t: Tr = zhText): DemoTrace {
  const nodes = Object.keys(DIJKSTRA_XY),
    edges = DIJKSTRA_EDGES.map(([a, b, w]) => ({ a, b, w })).sort((x, y) => x.w - y.w),
    parent = new Map(nodes.map((n) => [n, n])),
    verdict: ('take' | 'skip' | undefined)[] = [],
    frames: DemoFrame[] = [];
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  let total = 0,
    taken = 0;
  const frame = (caption: string, current = -1, done = false) => {
    const groups = [...new Set(nodes.map(find))].map((r) => `{${nodes.filter((n) => find(n) === r).join(',')}}`);
    frames.push({
      caption,
      done,
      cells: edges.map((e, i) => ({
        value: e.w,
        label: `${e.a}–${e.b}`,
        state: i === current ? 'active' : verdict[i] === 'take' ? 'answer' : verdict[i] === 'skip' ? 'blocked' : undefined,
      })),
      graph: {
        width: 100,
        height: 60,
        nodes: nodes.map((n) => ({ id: n, label: n, x: DIJKSTRA_XY[n][0], y: DIJKSTRA_XY[n][1] })),
        edges: edges.map((e, i) => ({
          from: e.a,
          to: e.b,
          label: String(e.w),
          state: i === current ? 'active' : verdict[i] === 'take' ? (done ? 'answer' : 'visited') : verdict[i] === 'skip' ? 'blocked' : undefined,
        })),
      },
      stats: [
        [t('已选边', 'Edges taken'), `${taken} / ${nodes.length - 1}`],
        [t('总权重', 'Total weight'), String(total)],
      ],
      queue: groups,
    });
  };
  frame(t('边按权重从小到大排好（下方格子）。一开始每个点自成一个连通块。', 'The edges are sorted by weight (the cells below). At first every node is its own component.'));
  for (let i = 0; i < edges.length && taken < nodes.length - 1; i++) {
    const { a, b, w } = edges[i],
      ra = find(a),
      rb = find(b);
    if (ra !== rb) {
      parent.set(ra, rb);
      total += w;
      taken++;
      verdict[i] = 'take';
      frame(t(`${a}–${b}（${w}）连接两个不同的连通块：选它，两块合并。`, `${a}–${b} (${w}) joins two different components: take it and merge them.`), i);
    } else {
      verdict[i] = 'skip';
      frame(t(`${a}–${b}（${w}）：${a} 和 ${b} 已经连通，再选就成环，跳过。`, `${a}–${b} (${w}): ${a} and ${b} are already connected; taking it would close a cycle, skip.`), i);
    }
  }
  frame(
    t(`选够 ${nodes.length - 1} 条边，最小生成树的总权重是 ${total}。排序 O(E log E)，并查集几乎 O(1)。`, `${nodes.length - 1} edges taken: the minimum spanning tree weighs ${total}. Sorting costs O(E log E); union-find is nearly O(1).`),
    -1,
    true,
  );
  return {
    title: t('Kruskal · 最小生成树', 'Kruskal · minimum spanning tree'),
    question: t('用最小的总权重把 6 个点连通', 'Connect all 6 nodes with the least total weight'),
    invariant: t(
      '已选的边始终无环；按权重从小到大，每次选连接两个不同连通块的最轻的边。',
      'The chosen edges never form a cycle; in weight order, take the lightest edge that joins two different components.',
    ),
    queueLabel: t('连通块', 'Components'),
    frames,
  };
}

/** N-queens row by row, pruning with sets of used columns and both diagonals (r − c and r + c). */
export function nQueensTrace(n = 4, t: Tr = zhText): DemoTrace {
  if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error('Invalid n-queens demo input');
  const queens: number[] = [],
    cols = new Set<number>(),
    down = new Set<number>(),
    up = new Set<number>(),
    frames: DemoFrame[] = [];
  let solutions = 0;
  const free = (r: number, c: number) => !cols.has(c) && !down.has(r - c) && !up.has(r + c);
  const frame = (caption: string, hot: [number, number] | null = null, done = false) =>
    frames.push({
      caption,
      done,
      cells: Array.from({ length: n * n }, (_, i): DemoCell => {
        const r = Math.floor(i / n),
          c = i % n,
          queen = queens[r] === c,
          attacked = !queen && r >= queens.length && !free(r, c);
        return {
          value: queen ? '♛' : attacked ? '×' : '·',
          label: `${r},${c}`,
          state: hot && hot[0] === r && hot[1] === c ? 'active' : queen ? (queens.length === n ? 'answer' : 'visited') : attacked ? 'muted' : undefined,
        };
      }),
      stats: [
        [t('已放皇后', 'Queens placed'), `${queens.length} / ${n}`],
        [t('占用的列', 'Columns used'), [...cols].sort((a, b) => a - b).join(' ') || '—'],
        [t('↘ 对角线 r−c', '↘ diagonals r−c'), [...down].sort((a, b) => a - b).join(' ') || '—'],
        [t('↙ 对角线 r+c', '↙ diagonals r+c'), [...up].sort((a, b) => a - b).join(' ') || '—'],
        [t('解的个数', 'Solutions'), String(solutions)],
      ],
    });
  const place = (r: number) => {
    if (r === n) {
      solutions++;
      frame(t(`${n} 个皇后都放好了：第 ${solutions} 个解。记录下来，继续回溯找下一个。`, `All ${n} queens placed: solution ${solutions}. Record it and backtrack for more.`));
      return;
    }
    let tried = false;
    for (let c = 0; c < n; c++) {
      if (!free(r, c)) continue;
      tried = true;
      queens.push(c);
      cols.add(c);
      down.add(r - c);
      up.add(r + c);
      frame(
        t(
          `第 ${r} 行放在第 ${c} 列：占用列 ${c}、对角线 ${r - c} 和 ${r + c}。下面各行被攻击的格子标 ×，不用再试。`,
          `Row ${r}, column ${c}: this uses column ${c} and diagonals ${r - c} and ${r + c}. Attacked squares below are marked × and never tried.`,
        ),
        [r, c],
      );
      place(r + 1);
      queens.pop();
      cols.delete(c);
      down.delete(r - c);
      up.delete(r + c);
      frame(t(`回溯：拿走第 ${r} 行第 ${c} 列的皇后，试这一行的下一列。`, `Backtrack: lift the queen at row ${r}, column ${c} and try the next column.`), [r, c]);
    }
    if (!tried) frame(t(`第 ${r} 行每一格都被攻击：这条路走不通，剪枝回到上一行。`, `Every square in row ${r} is attacked: a dead end, so prune and go back up.`));
  };
  frame(t(`在 ${n}×${n} 棋盘上一行放一个皇后。用三个集合记下占用的列和两条对角线，O(1) 判断能不能放。`, `Place one queen per row on a ${n}×${n} board. Three sets record the used columns and both diagonals, so each check is O(1).`));
  place(0);
  frame(t(`搜索结束：${n} 皇后共有 ${solutions} 个解。`, `Search finished. Solutions for ${n} queens: ${solutions}.`), null, true);
  return {
    title: t('N 皇后 · 按列和对角线剪枝', 'N-queens · pruning by column and diagonal'),
    question: t(`${n} 皇后有多少种摆法？`, `How many ways can ${n} queens be placed?`),
    invariant: t(
      '同一条 ↘ 对角线上 r − c 相同，同一条 ↙ 对角线上 r + c 相同；集合里没有才能放。',
      'Squares on one ↘ diagonal share r − c and on one ↙ diagonal share r + c; a queen fits only if none of its three keys is taken.',
    ),
    columns: n,
    frames,
  };
}

/** Longest palindromic subsequence: dp[i][j] over s[i..j], filled by interval length. */
export function intervalDpTrace(s = 'agbdba', t: Tr = zhText): DemoTrace {
  const n = s.length,
    dp: (number | null)[][] = Array.from({ length: n }, () => Array<number | null>(n).fill(null)),
    frames: DemoFrame[] = [];
  let length = 0;
  type At = [number, number];
  const frame = (caption: string, current: At[] = [], from: At[] = [], done = false) => {
    const has = (list: At[], i: number, j: number) => list.some(([x, y]) => x === i && y === j);
    const cells: DemoCell[] = [{ value: '', label: '', state: 'muted' }, ...Array.from(s, (ch, j): DemoCell => ({ value: ch, label: String(j), state: 'muted' }))];
    for (let i = 0; i < n; i++) {
      cells.push({ value: s[i], label: String(i), state: 'muted' });
      for (let j = 0; j < n; j++)
        cells.push(
          j < i
            ? { value: '', label: '', state: 'muted' }
            : {
                value: dp[i][j] ?? '·',
                label: `${i},${j}`,
                state: done && i === 0 && j === n - 1 ? 'answer' : has(current, i, j) ? 'active' : has(from, i, j) ? 'visited' : undefined,
              },
        );
    }
    frames.push({
      caption,
      done,
      cells,
      stats: [
        [t('区间长度', 'Interval length'), length ? String(length) : '—'],
        [t('最长回文子序列', 'Longest palindromic subsequence'), (dp[0]?.[n - 1] ?? null) === null ? '—' : String(dp[0][n - 1])],
      ],
    });
  };
  frame(
    t(
      `dp[i][j] 是「${s}」第 i 到第 j 个字符里最长回文子序列的长度。它依赖更短的区间，所以按区间长度从短到长填。`,
      `dp[i][j] is the longest palindromic subsequence within characters i..j of "${s}". It depends on shorter intervals, so fill by interval length, short to long.`,
    ),
  );
  if (n) {
    length = 1;
    for (let i = 0; i < n; i++) dp[i][i] = 1;
    frame(
      t('长度 1：单个字符自己就是回文，对角线全是 1。', 'Length 1: a single character is a palindrome, so the diagonal is all 1.'),
      Array.from({ length: n }, (_, i): At => [i, i]),
    );
  }
  for (length = 2; length <= n; length++)
    for (let i = 0; i + length <= n; i++) {
      const j = i + length - 1;
      if (s[i] === s[j]) {
        dp[i][j] = (length === 2 ? 0 : dp[i + 1][j - 1]!) + 2;
        frame(
          t(`s[${i}] = s[${j}] = ${s[i]}：两端都能用，dp[${i}][${j}] = dp[${i + 1}][${j - 1}] + 2 = ${dp[i][j]}。`, `s[${i}] = s[${j}] = ${s[i]}: both ends join, dp[${i}][${j}] = dp[${i + 1}][${j - 1}] + 2 = ${dp[i][j]}.`),
          [[i, j]],
          length === 2 ? [] : [[i + 1, j - 1]],
        );
      } else {
        dp[i][j] = Math.max(dp[i + 1][j]!, dp[i][j - 1]!);
        frame(
          t(`s[${i}] = ${s[i]} ≠ s[${j}] = ${s[j]}：去掉一端，取 dp[${i + 1}][${j}] 和 dp[${i}][${j - 1}] 的较大值 ${dp[i][j]}。`, `s[${i}] = ${s[i]} ≠ s[${j}] = ${s[j]}: drop one end and take the larger of dp[${i + 1}][${j}] and dp[${i}][${j - 1}], ${dp[i][j]}.`),
          [[i, j]],
          [
            [i + 1, j],
            [i, j - 1],
          ],
        );
      }
    }
  length = 0;
  frame(
    t(`右上角 dp[0][${n - 1}] = ${dp[0]?.[n - 1] ?? 0} 就是答案。共 O(n²) 个区间，每个 O(1)。`, `The top-right cell dp[0][${n - 1}] = ${dp[0]?.[n - 1] ?? 0} is the answer. O(n²) intervals, O(1) each.`),
    [],
    [],
    true,
  );
  return {
    title: t('区间 DP · 最长回文子序列', 'Interval DP · longest palindromic subsequence'),
    question: t(`「${s}」的最长回文子序列有多长？`, `How long is the longest palindromic subsequence of "${s}"?`),
    invariant: t(
      '算长度为 L 的区间时，所有更短的区间都已填好：两端相同就 +2，不同就去掉一端。',
      'When an interval of length L is filled, every shorter one is final: equal ends add 2, unequal ends drop one side.',
    ),
    columns: n + 1,
    frames,
  };
}

/** Stock trading with a one-day cooldown: three states (hold / cool / free) advanced day by day. */
export function stockDpTrace(prices = [1, 2, 3, 0, 2], t: Tr = zhText): DemoTrace {
  const n = prices.length,
    table: (number | null)[][] = [Array(n).fill(null), Array(n).fill(null), Array(n).fill(null)],
    rows: [string, string][] = [
      ['持有', 'hold'],
      ['冷冻', 'cool'],
      ['空仓', 'free'],
    ],
    frames: DemoFrame[] = [];
  let day = -1;
  const shown = (v: number | null) => (v === null ? '·' : v === -Infinity ? '−∞' : v);
  const best = () => (day < 0 ? 0 : Math.max(table[1][day]!, table[2][day]!));
  const frame = (caption: string, from: number[] = [], done = false) =>
    frames.push({
      caption,
      done,
      cells: [
        { value: t('价格', 'price'), label: '', state: 'muted' },
        ...prices.map((p, d): DemoCell => ({ value: p, label: t(`第 ${d} 天`, `day ${d}`), state: d === day ? 'active' : 'muted' })),
        ...rows.flatMap(([zh, en], r): DemoCell[] => [
          { value: t(zh, en), label: '', state: 'muted' },
          ...table[r].map((v, d): DemoCell => ({
            value: shown(v),
            label: `${t(zh, en)}[${d}]`,
            state: done && d === n - 1 && r && v === best() ? 'answer' : d === day ? 'active' : from.includes(d) ? 'visited' : undefined,
          })),
        ]),
      ],
      stats: [
        [t('第几天', 'Day'), day < 0 ? '—' : String(day)],
        [t('最大利润', 'Best profit'), String(best())],
      ],
    });
  frame(
    t(
      '每天结束时处在三种状态之一：持有股票、刚卖出（明天冷冻不能买）、空仓可买。每列只由前一列算出。',
      'Each day ends in one of three states: holding a share, just sold (cooling down, no buying tomorrow), or free to buy. Each column comes from the previous one only.',
    ),
  );
  for (day = 0; day < n; day++) {
    const p = prices[day];
    if (day === 0) {
      table[0][0] = -p;
      table[1][0] = -Infinity;
      table[2][0] = 0;
      frame(t(`第 0 天：买入就是 −${p}；还不可能刚卖出（−∞）；什么都不做是 0。`, `Day 0: buying gives −${p}; nobody can have just sold (−∞); doing nothing is 0.`));
      continue;
    }
    const [h, c, f] = [table[0][day - 1]!, table[1][day - 1]!, table[2][day - 1]!];
    table[0][day] = Math.max(h, f - p);
    table[1][day] = h + p;
    table[2][day] = Math.max(f, c);
    frame(
      t(
        `第 ${day} 天价格 ${p}。持有 = max(继续持有 ${h}, 空仓买入 ${f}−${p}) = ${table[0][day]}；冷冻 = 昨天持有今天卖 ${h}+${p} = ${table[1][day]}；空仓 = max(${f}, 昨天冷冻 ${shown(c)}) = ${table[2][day]}。`,
        `Day ${day}, price ${p}. hold = max(keep ${h}, buy from free ${f}−${p}) = ${table[0][day]}; cool = sell today ${h}+${p} = ${table[1][day]}; free = max(${f}, yesterday's cool ${shown(c)}) = ${table[2][day]}.`,
      ),
      [day - 1],
    );
  }
  day = n - 1;
  frame(
    t(`最后一天不应还持有股票：答案是 max(冷冻, 空仓) = ${best()}。O(n) 时间、O(1) 空间。`, `Never end holding a share: the answer is max(cool, free) = ${best()}. O(n) time, O(1) space.`),
    [],
    true,
  );
  return {
    title: t('状态机 DP · 含冷冻期的股票买卖', 'State machine DP · stocks with a cooldown'),
    question: t(`价格 ${prices.join(', ')}，卖出后要冷冻一天，最大利润是多少？`, `Prices ${prices.join(', ')}, with a one-day cooldown after selling: what is the best profit?`),
    invariant: t(
      '每天的三个状态只由前一天的三个状态转移而来：hold → cool（卖），free → hold（买），cool → free（等一天）。',
      'Each day’s three states come only from the previous day’s: hold → cool (sell), free → hold (buy), cool → free (wait a day).',
    ),
    columns: n + 1,
    frames,
  };
}

export type LruOp = [number] | [number, number];
/** LRU cache: a hash map to find nodes and a doubly linked list ordered by use (most recent first). */
export function lruTrace(
  capacity = 2,
  ops: LruOp[] = [[1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]],
  t: Tr = zhText,
): DemoTrace {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 4) throw new Error('Invalid LRU demo input');
  const map = new Map<number, number>(),
    order: number[] = [],
    results: string[] = [],
    frames: DemoFrame[] = [];
  let operation = '—';
  const frame = (caption: string, hot: number[] = [], done = false) => {
    const ids = ['H', ...order.map(String), 'T'],
      step = 84 / (ids.length - 1);
    frames.push({
      caption,
      done,
      // Insertion order, not sorted: a new key lands in a slot the previous frame didn't draw, so
      // predict mode never asks about a cell whose key changes under it.
      cells: [...map.keys()].map((k): DemoCell => ({ value: map.get(k)!, label: t(`键 ${k}`, `key ${k}`), state: hot.includes(k) ? 'active' : undefined })),
      graph: {
        width: 100,
        height: 30,
        nodes: ids.map((id, i) => ({
          id,
          label: id === 'H' ? t('头', 'H') : id === 'T' ? t('尾', 'T') : id,
          x: 8 + step * i,
          y: 12,
          note: id === 'H' ? t('最近', 'newest') : id === 'T' ? t('最久', 'oldest') : `=${map.get(Number(id))}`,
          state: hot.includes(Number(id)) && id !== 'H' && id !== 'T' ? 'active' : id === 'H' || id === 'T' ? 'muted' : undefined,
        })),
        edges: ids.slice(1).flatMap((id, i) => [
          { from: ids[i], to: id, directed: true },
          { from: id, to: ids[i], directed: true },
        ]),
      },
      stats: [
        [t('容量', 'Capacity'), String(capacity)],
        [t('大小', 'Size'), String(map.size)],
        [t('操作', 'Operation'), operation],
      ],
      queue: [...results],
    });
  };
  frame(
    t(
      '哈希表（格子）按键找到链表结点；双向链表从头到尾按「最近使用」排序。头尾是两个哨兵结点。',
      'The hash map (cells) finds a key’s list node; the doubly linked list runs from most to least recently used, between two sentinels.',
    ),
  );
  for (const op of ops) {
    const [k, v] = op;
    const touch = () => {
      order.splice(order.indexOf(k), 1);
      order.unshift(k);
    };
    if (op.length === 1) {
      operation = `get(${k})`;
      if (!map.has(k)) {
        results.push('-1');
        frame(t(`get(${k})：哈希表里没有，返回 −1。`, `get(${k}): not in the map, return −1.`));
        continue;
      }
      touch();
      results.push(String(map.get(k)));
      frame(t(`get(${k})：哈希表 O(1) 找到结点，返回 ${map.get(k)}，并把它摘下来移到表头。`, `get(${k}): the map finds the node in O(1); return ${map.get(k)} and move the node to the front.`), [k]);
      continue;
    }
    operation = `put(${k}, ${v})`;
    if (map.has(k)) {
      map.set(k, v!);
      touch();
      frame(t(`put(${k}, ${v})：键已存在，更新值并移到表头。`, `put(${k}, ${v}): the key exists; update it and move it to the front.`), [k]);
      continue;
    }
    if (map.size === capacity) {
      const old = order.pop()!;
      map.delete(old);
      frame(t(`put(${k}, ${v})：容量满了，先淘汰尾部（最久没用）的 ${old}，哈希表里也删掉。`, `put(${k}, ${v}): full, so first evict ${old} at the tail (least recently used) and drop it from the map too.`));
    }
    map.set(k, v!);
    order.unshift(k);
    frame(t(`put(${k}, ${v})：新结点插到表头，哈希表记下它。`, `put(${k}, ${v}): a new node goes to the front and the map records it.`), [k]);
  }
  operation = '—';
  frame(
    t('所有操作完成。查表 O(1)，链表摘下、插入、删尾都只改几根指针，也是 O(1)。', 'All operations done. Map lookups are O(1), and unhooking, inserting or dropping the tail only rewires a few pointers: O(1) too.'),
    [],
    true,
  );
  return {
    title: t('LRU 缓存 · 哈希表 + 双向链表', 'LRU cache · hash map + doubly linked list'),
    question: t(
      `容量 ${capacity}：${ops.map((op) => (op.length === 1 ? `get(${op[0]})` : `put(${op[0]}, ${op[1]})`)).join('、')}`,
      `Capacity ${capacity}: ${ops.map((op) => (op.length === 1 ? `get(${op[0]})` : `put(${op[0]}, ${op[1]})`)).join(', ')}`,
    ),
    invariant: t(
      '链表从头到尾按最近使用排序；哈希表和链表里的键始终是同一批，最多 capacity 个。',
      'The list runs from most to least recently used; the map and the list always hold the same keys, at most capacity of them.',
    ),
    queueLabel: t('get 的返回值', 'get results'),
    frames,
  };
}

/** Most non-overlapping intervals: sort by right end, keep each one that starts at or after the last kept end. */
export function intervalGreedyTrace(
  intervals: [number, number][] = [
    [1, 4],
    [3, 5],
    [0, 6],
    [5, 7],
    [3, 9],
    [6, 10],
    [8, 11],
  ],
  t: Tr = zhText,
): DemoTrace {
  const sorted = [...intervals].sort((a, b) => a[1] - b[1]),
    verdict: ('keep' | 'skip' | undefined)[] = [],
    frames: DemoFrame[] = [],
    span = Math.max(1, ...intervals.map(([, e]) => e)),
    x = (v: number) => 8 + (v / span) * 84;
  let end = -Infinity,
    kept = 0;
  const frame = (caption: string, current = -1, done = false) =>
    frames.push({
      caption,
      done,
      cells: sorted.map(([s, e], i) => ({
        value: `${s}–${e}`,
        label: `#${i}`,
        state: i === current ? 'active' : verdict[i] === 'keep' ? 'answer' : verdict[i] === 'skip' ? 'blocked' : undefined,
      })),
      // Each interval is a bar on a timeline: an edge between two bare dots.
      graph: {
        width: 100,
        height: 10 + 6 * Math.max(0, sorted.length - 1),
        nodes: sorted.flatMap(([s, e], i) => [
          { id: `s${i}`, label: '', x: x(s), y: 5 + 6 * i },
          { id: `e${i}`, label: '', x: x(e), y: 5 + 6 * i },
        ]),
        edges: sorted.map((_, i) => ({
          from: `s${i}`,
          to: `e${i}`,
          state: i === current ? 'active' : verdict[i] === 'keep' ? 'answer' : verdict[i] === 'skip' ? 'muted' : undefined,
        })),
      },
      stats: [
        [t('已选', 'Kept'), String(kept)],
        [t('上一个结束于', 'Last end'), Number.isFinite(end) ? String(end) : '−∞'],
      ],
    });
  frame(t('区间已按右端点从小到大排好，图里每一行是一个区间。', 'The intervals are sorted by right end; each row of the chart is one interval.'));
  sorted.forEach(([s, e], i) => {
    if (s >= end) {
      const last = Number.isFinite(end) ? String(end) : '−∞';
      verdict[i] = 'keep';
      kept++;
      end = e;
      frame(
        t(`[${s}, ${e}] 的起点 ${s} ≥ 上一个结束 ${last}：选它。剩下的区间里它结束得最早，给后面留的空间最多。`, `[${s}, ${e}] starts at ${s} ≥ the last end ${last}: keep it. Of those left it ends earliest, leaving the most room.`),
        i,
      );
    } else {
      verdict[i] = 'skip';
      frame(t(`[${s}, ${e}] 的起点 ${s} < ${end}，和已选的重叠：跳过。`, `[${s}, ${e}] starts at ${s} < ${end}, overlapping a kept one: skip.`), i);
    }
  });
  frame(
    t(`最多选出 ${kept} 个互不重叠的区间。排序 O(n log n)，扫描 O(n)。`, `Most non-overlapping intervals: ${kept}. Sorting is O(n log n), the scan O(n).`),
    -1,
    true,
  );
  return {
    title: t('区间贪心 · 按右端点选不重叠区间', 'Interval greedy · keep the earliest finish'),
    question: t('最多能选出多少个互不重叠的区间（端点可以相接）？', 'How many intervals can you keep with no overlap (touching ends are fine)?'),
    invariant: t(
      '交换论证：任何最优解的第一个区间都能换成结束最早的那个，数量不变。',
      'Exchange argument: the first interval of any optimal answer can be swapped for the one that ends first, with no loss.',
    ),
    frames,
  };
}

/** Subarrays summing to k: running prefix sum plus a hash map counting earlier prefix sums. */
export function prefixSumTrace(nums = [1, 2, 1, -1, 2, 1], k = 3, t: Tr = zhText): DemoTrace {
  const n = nums.length,
    prefix: (number | null)[] = Array(n).fill(null),
    seen = new Map<number, number>([[0, 1]]),
    frames: DemoFrame[] = [];
  let pre = 0,
    answer = 0,
    current = -1;
  const frame = (caption: string, done = false) =>
    frames.push({
      caption,
      done,
      cells: [
        ...nums.map((v, i): DemoCell => ({ value: v, label: String(i), state: i === current ? 'active' : i < current ? 'visited' : undefined })),
        ...prefix.map((v, i): DemoCell => ({ value: v ?? '·', label: `pre[${i + 1}]`, state: i === current ? 'active' : done ? 'answer' : undefined })),
      ],
      stats: [
        ['k', String(k)],
        [t('前缀和', 'Prefix sum'), String(pre)],
        [t('要找 pre − k', 'Looking for pre − k'), current < 0 ? '—' : String(pre - k)],
        [t('子数组个数', 'Subarrays'), String(answer)],
      ],
      queue: [...seen].map(([s, c]) => `${s}×${c}`),
    });
  frame(
    t(
      `第一行是数组，第二行是前缀和。子数组 i..j 的和 = pre[j+1] − pre[i]，所以和为 ${k} 等价于找之前出现过的 pre − ${k}。空前缀 0 先记 1 次。`,
      `Top row: the array. Bottom row: prefix sums. The sum of i..j is pre[j+1] − pre[i], so a sum of ${k} means an earlier prefix equal to pre − ${k}. The empty prefix 0 counts once.`,
    ),
  );
  for (current = 0; current < n; current++) {
    pre += nums[current];
    prefix[current] = pre;
    const hits = seen.get(pre - k) ?? 0;
    answer += hits;
    seen.set(pre, (seen.get(pre) ?? 0) + 1);
    frame(
      t(
        `加上 ${nums[current]}，前缀和 = ${pre}。表里 ${pre - k} 出现过 ${hits} 次，就有 ${hits} 个以这里结尾、和为 ${k} 的子数组。再把 ${pre} 记进表。`,
        `Add ${nums[current]}: the prefix sum is ${pre}. Earlier prefixes equal to ${pre - k}: ${hits}, and each starts a subarray ending here that sums to ${k}. Then record ${pre}.`,
      ),
    );
  }
  current = -1;
  frame(t(`共有 ${answer} 个和为 ${k} 的子数组。一遍扫描，O(n) 时间、O(n) 空间；有负数也成立。`, `Subarrays summing to ${k}: ${answer}. One pass: O(n) time, O(n) space, negatives included.`), true);
  return {
    title: t('前缀和 · 和为 k 的子数组', 'Prefix sums · subarrays summing to k'),
    question: t(`数组 ${nums.join(', ')} 中有多少个和为 ${k} 的连续子数组？`, `How many contiguous subarrays of ${nums.join(', ')} sum to ${k}?`),
    invariant: t('哈希表里存的是当前位置之前每个前缀和出现的次数。', 'The map holds how many times each prefix sum appeared before the current position.'),
    columns: Math.max(1, n),
    queueLabel: t('哈希表（前缀和×次数）', 'Map (prefix sum×count)'),
    frames,
  };
}

/** Count set bits with x &= x − 1, which clears the lowest 1 each round. */
export function bitsTrace(x = 44, t: Tr = zhText): DemoTrace {
  if (!Number.isInteger(x) || x < 0 || x > 255) throw new Error('Invalid bits demo input');
  const frames: DemoFrame[] = [];
  let count = 0;
  const bits = (v: number | null) => Array.from({ length: 8 }, (_, b) => (v === null ? '·' : (v >> (7 - b)) & 1));
  const frame = (caption: string, v: number, minus: number | null, and: number | null, done = false) => {
    const row = (name: string, value: number | null, hot: (b: number) => boolean, mark?: DemoState): DemoCell[] => [
      { value: name, label: value === null ? '' : String(value), state: 'muted' },
      ...bits(value).map((bit, b): DemoCell => ({
        value: bit,
        label: `2^${7 - b}`,
        state: value === null ? 'muted' : hot(b) ? 'active' : bit === 1 ? mark : undefined,
      })),
    ];
    const changed = (b: number) => minus !== null && ((v ^ minus) >> (7 - b)) & 1;
    frames.push({
      caption,
      done,
      cells: [
        ...row('x', v, (b) => Boolean(changed(b)), done ? 'answer' : 'visited'),
        ...row('x−1', minus, (b) => Boolean(changed(b))),
        ...row('&', and, () => false, 'visited'),
      ],
      stats: [
        ['x', String(v)],
        [t('数到的 1', 'Ones counted'), String(count)],
      ],
    });
  };
  frame(
    t(
      `x = ${x}，二进制 ${x.toString(2)}。三行依次是 x、x − 1 和 x & (x − 1)。每轮 x &= x − 1 清掉最低位的 1，轮数就是 1 的个数。`,
      `x = ${x}, binary ${x.toString(2)}. The rows are x, x − 1 and x & (x − 1). Each round x &= x − 1 clears the lowest 1, so the rounds count the ones.`,
    ),
    x,
    null,
    null,
  );
  for (let v = x; v; ) {
    const low = v & -v;
    frame(
      t(
        `x − 1：最低位的 1（${low}）变成 0，它右边的 0 都变成 1（蓝色是变了的位）。和 x 相与，只有这一位被清掉。`,
        `x − 1 flips the lowest 1 (${low}) to 0 and the 0s to its right to 1 (blue bits changed). ANDed with x, only that bit is cleared.`,
      ),
      v,
      v - 1,
      v & (v - 1),
    );
    v &= v - 1;
    count++;
    frame(t(`x 变成 ${v}，数到 ${count} 个 1。`, `x becomes ${v}; ones counted so far: ${count}.`), v, null, null);
  }
  frame(
    t(`x 变成 0，结束：${x} 有 ${count} 个 1。循环次数等于 1 的个数，不是总位数。`, `x is 0, done. 1 bits in ${x}: ${count}. The loop runs once per 1 bit, not once per bit.`),
    0,
    null,
    null,
    true,
  );
  return {
    title: t('位运算 · x & (x − 1) 数 1', 'Bits · counting ones with x & (x − 1)'),
    question: t(`${x} 的二进制里有几个 1？`, `How many 1 bits does ${x} have?`),
    invariant: t('x & (x − 1) 恰好清掉最低位的 1，其余位不变。', 'x & (x − 1) clears exactly the lowest 1 bit and leaves the rest unchanged.'),
    columns: 9,
    frames,
  };
}

/** KMP: build the prefix function of the pattern, then scan the text without ever moving back. */
export function kmpTrace(text = 'abxabcabcaby', pat = 'abcaby', t: Tr = zhText): DemoTrace {
  const n = text.length,
    m = pat.length,
    pi: (number | null)[] = Array(m).fill(null),
    matches: number[] = [],
    frames: DemoFrame[] = [];
  if (!m || m > n) throw new Error('Invalid KMP demo input');
  let phase: 'build' | 'scan' = 'build';
  const frame = (caption: string, offset: number, hot: { text?: number; pat?: number[] } = {}, done = false) =>
    frames.push({
      caption,
      done,
      cells: [
        ...Array.from(text, (ch, i): DemoCell => ({
          value: ch,
          label: String(i),
          state: i === hot.text ? 'active' : phase === 'build' ? 'muted' : matches.some((s) => i >= s && i < s + m) ? 'answer' : undefined,
        })),
        ...Array.from({ length: n }, (_, i): DemoCell => {
          const j = i - offset;
          return j >= 0 && j < m ? { value: pat[j], label: `p${j}`, state: hot.pat?.includes(j) ? 'active' : undefined } : { value: '', label: '', state: 'muted' };
        }),
        ...Array.from({ length: n }, (_, i): DemoCell => {
          const j = i - offset;
          return j >= 0 && j < m ? { value: pi[j] ?? '·', label: `pi${j}`, state: 'visited' } : { value: '', label: '', state: 'muted' };
        }),
      ],
      stats: [
        [t('阶段', 'Phase'), phase === 'build' ? t('求前缀函数', 'Prefix function') : t('匹配', 'Matching')],
        [t('匹配起点', 'Matches at'), matches.join(' ') || '—'],
      ],
    });
  frame(
    t(
      `先只看模式串「${pat}」：pi[i] 是它前 i+1 个字符里，既是前缀又是后缀的最长长度（不算整个串）。`,
      `First the pattern "${pat}" alone: pi[i] is the longest proper prefix of its first i+1 characters that is also a suffix.`,
    ),
    0,
  );
  pi[0] = 0;
  for (let i = 1, j = 0; i < m; i++) {
    while (j && pat[i] !== pat[j]) {
      frame(t(`p${i} = ${pat[i]} ≠ p${j} = ${pat[j]}：j 退回 pi[${j - 1}] = ${pi[j - 1]}。`, `p${i} = ${pat[i]} ≠ p${j} = ${pat[j]}: j falls back to pi[${j - 1}] = ${pi[j - 1]}.`), 0, { pat: [i, j] });
      j = pi[j - 1]!;
    }
    if (pat[i] === pat[j]) j++;
    pi[i] = j;
    frame(
      t(`p${i} = ${pat[i]}${j ? `，和 p${j - 1} 相同，前后缀延长到 ${j}` : '，没有相同的前后缀'}：pi[${i}] = ${j}。`, `p${i} = ${pat[i]}${j ? `, matching p${j - 1}: the border grows to ${j}` : ': no border'}: pi[${i}] = ${j}.`),
      0,
      { pat: [i] },
    );
  }
  phase = 'scan';
  frame(t('开始在文本上匹配。文本指针 i 只前进；失配时模式串按 pi 往右滑，不必从头比。', 'Now scan the text. The text pointer i only moves forward; on a mismatch the pattern slides right by pi instead of restarting.'), 0);
  for (let i = 0, j = 0; i < n; i++) {
    while (j && text[i] !== pat[j]) {
      frame(t(`t${i} = ${text[i]} ≠ p${j} = ${pat[j]}：模式串滑动，j = pi[${j - 1}] = ${pi[j - 1]}。`, `t${i} = ${text[i]} ≠ p${j} = ${pat[j]}: slide the pattern, j = pi[${j - 1}] = ${pi[j - 1]}.`), i - j, { text: i, pat: [j] });
      j = pi[j - 1]!;
    }
    if (text[i] === pat[j]) {
      j++;
      if (j === m) {
        matches.push(i - m + 1);
        frame(t(`整个模式串匹配上了，起点 ${i - m + 1}。j 退回 pi[${m - 1}] = ${pi[m - 1]}，继续找下一个。`, `The whole pattern matches, starting at ${i - m + 1}. j falls back to pi[${m - 1}] = ${pi[m - 1]} to look for more.`), i - m + 1, { text: i, pat: [m - 1] });
        j = pi[m - 1]!;
      } else frame(t(`t${i} = p${j - 1} = ${text[i]}：匹配，i 和 j 都前进。`, `t${i} = p${j - 1} = ${text[i]}: a match, i and j both move on.`), i - j + 1, { text: i, pat: [j - 1] });
    } else frame(t(`t${i} = ${text[i]} ≠ p0：从下一个字符重新开始。`, `t${i} = ${text[i]} ≠ p0: start again at the next character.`), i, { text: i, pat: [0] });
  }
  frame(
    t(`扫描结束，匹配起点：${matches.join('、') || '无'}。文本指针从不后退：O(n + m)。`, `Scan finished, matches at: ${matches.join(', ') || 'none'}. The text pointer never moves back: O(n + m).`),
    matches[0] ?? 0,
    {},
    true,
  );
  return {
    title: t('KMP · 前缀函数与线性匹配', 'KMP · prefix function and linear matching'),
    question: t(`在「${text}」中找「${pat}」的所有出现位置`, `Find every occurrence of "${pat}" in "${text}"`),
    invariant: t(
      'j 是当前已匹配的长度；失配时退到 pi[j−1]，它是已匹配部分最长的相同前后缀，不会漏掉任何起点。',
      'j is the matched length; on a mismatch it falls to pi[j−1], the longest border of what matched, so no start is skipped.',
    ),
    columns: n,
    frames,
  };
}

/** [中文, English]: input labels and parse errors are shown in the page's language. */
export type Pair = [string, string];
export type DemoParse = { args: unknown[] } | { error: Pair };
export type DemoInput = {
  label: Pair;
  placeholder: string;
  parse: (text: string) => DemoParse;
  /** One-click inputs (sorted, reversed, random, duplicates): a function is called on each click. */
  presets?: [Pair, string | (() => string)][];
};

class InputError extends Error {
  constructor(readonly pair: Pair) {
    super(pair[1]);
  }
}
export function fail(zh: string, en: string): never {
  throw new InputError([zh, en]);
}
/** "a; b" → ['a', 'b']: the parts a kind's input is split into. */
export function parts(text: string, count: number, optional = 0): string[] {
  const found = text.split(/[;；|]/).map((p) => p.trim());
  if (found.length < count - optional || found.length > count)
    fail(`格式是 ${count} 段，用分号隔开`, `Use ${count} parts separated by semicolons`);
  return found;
}
export const tokens = (text: string) => text.split(/[\s,，、]+/).filter(Boolean);
/** Whole numbers with |v| ≤ limit, between 1 and `max` of them. */
export function numbers(text: string, max: number, limit = 99): number[] {
  const list = tokens(text);
  if (!list.length) fail('至少要填一个数', 'Enter at least one number');
  if (list.length > max) fail(`最多 ${max} 个数`, `At most ${max} numbers`);
  return list.map((token) => {
    if (!/^[+-]?\d+$/.test(token)) fail(`「${token}」不是整数`, `"${token}" is not a whole number`);
    const value = Number(token);
    if (Math.abs(value) > limit) fail(`每个数要在 −${limit} 到 ${limit} 之间`, `Each number must be between −${limit} and ${limit}`);
    return value;
  });
}
export function one(text: string) {
  if (tokens(text).length !== 1) fail('这里只填一个整数', 'Enter exactly one whole number here');
  return numbers(text, 1)[0];
}
function sorted(values: number[]) {
  if (values.some((v, i) => i && v < values[i - 1]))
    fail('数组要先按从小到大排好序', 'The array must be sorted from small to large');
  return values;
}
const words = (text: string, max: number, size: number, what: Pair) => {
  const list = tokens(text.toLowerCase());
  if (list.length > max) fail(`${what[0]}最多 ${max} 个`, `At most ${max} ${what[1]}`);
  for (const w of list)
    if (!/^[a-z]+$/.test(w) || w.length > size)
      fail(`「${w}」：每个词只能是 1 到 ${size} 个英文字母`, `"${w}": each word is 1 to ${size} letters a–z`);
  return list;
};
export const input = (label: Pair, placeholder: string, read: (text: string) => unknown[]): DemoInput => ({
  label,
  placeholder,
  parse: (text) => {
    if (!text.trim()) return { error: ['先填一个输入', 'Type an input first'] };
    try {
      return { args: read(text.trim()) };
    } catch (error) {
      if (error instanceof InputError) return { error: error.pair };
      throw error;
    }
  },
});
const sortedAndTarget = (text: string) => {
  const [values, target] = parts(text, 2);
  return [sorted(numbers(values, 12)), one(target)];
};
/** Whole numbers from 0 to `limit`. */
function naturals(text: string, max: number, limit = 99) {
  const list = numbers(text, max, Number.MAX_SAFE_INTEGER);
  if (list.some((v) => v < 0 || v > limit)) fail(`每个数要在 0 到 ${limit} 之间`, `Each number must be between 0 and ${limit}`);
  return list;
}
function within(value: number, low: number, high: number, what: Pair) {
  if (value < low || value > high) fail(`${what[0]}要在 ${low} 到 ${high} 之间`, `${what[1]} must be between ${low} and ${high}`);
  return value;
}
const sortInput = (algo: SortAlgo): DemoInput => {
  const limit = algo === 'counting' ? 9 : 99,
    low = algo === 'counting' || algo === 'radix' ? 0 : -99;
  const ascending = algo === 'radix' ? [5, 12, 23, 31, 47, 58, 66, 90] : [1, 2, 3, 4, 5, 6, 7, 8];
  return {
    ...input([`数组（最多 12 个，${low} 到 ${limit}）`, `Numbers (up to 12, ${low} to ${limit})`], SORT_DEFAULT.join(' '), (text) => [
      low ? numbers(text, 12, limit) : naturals(text, 12, limit),
    ]),
    presets: [
      [['有序', 'Sorted'], ascending.join(' ')],
      [['逆序', 'Reversed'], [...ascending].reverse().join(' ')],
      [['随机', 'Random'], () => Array.from({ length: 8 }, () => Math.floor(Math.random() * (limit + 1))).join(' ')],
      [['重复键', 'Duplicate keys'], '3 1 3 2 1 2 3 1'],
    ],
  };
};

/**
 * "Try your own input": a parser per kind, with sizes that keep the frames readable. bfs,
 * dijkstra and union-find keep their fixed graphs. Each parse returns the trace function's
 * leading arguments, in order.
 */
export const demoInputs: Partial<Record<DemoKind, DemoInput>> = {
  'binary-search': input(['有序数组; 目标', 'Sorted array; target'], '2 5 8 12 16 23 38 56; 23', sortedAndTarget),
  'two-pointers': input(['有序数组; 目标和', 'Sorted array; target sum'], '1 3 4 6 8 11 15; 14', sortedAndTarget),
  'sliding-window': input(['字符串（最多 16 个字符）', 'String (up to 16 characters)'], 'abcabcbb', (text) => {
    if (Array.from(text).length > 16) fail('最多 16 个字符', 'At most 16 characters');
    return [text];
  }),
  dp: input(['金额; 硬币面值', 'Amount; coin values'], '6; 1 3 4', (text) => {
    const [amount, coins] = parts(text, 2);
    const total = one(amount);
    if (total < 0 || total > 15) fail('金额要在 0 到 15 之间', 'The amount must be between 0 and 15');
    const list = numbers(coins, 4);
    if (list.some((c) => c < 1)) fail('硬币面值要是正整数', 'Coin values must be positive');
    return [total, list];
  }),
  dfs: input(['网格：每行一串 0 和 1，行之间用空格隔开', 'Grid: one string of 0s and 1s per row, rows separated by spaces'], '110010 100110 001000 101101', (text) => {
    const rows = tokens(text);
    if (rows.length > 6) fail('最多 6 行', 'At most 6 rows');
    if (rows.some((r) => !/^[01]+$/.test(r))) fail('每行只能有 0 和 1', 'Rows hold only 0s and 1s');
    if (rows.some((r) => r.length !== rows[0].length)) fail('每行长度要相同', 'Every row must be the same length');
    if (rows[0].length > 8) fail('每行最多 8 格', 'At most 8 cells per row');
    return [rows];
  }),
  heap: input(['数据流; k', 'Stream; k'], '5 2 9 1 7 8 3; 3', (text) => {
    const [stream, k] = parts(text, 2);
    const list = numbers(stream, 12),
      size = one(k);
    if (size < 1 || size > list.length) fail(`k 要在 1 到 ${list.length} 之间`, `k must be between 1 and ${list.length}`);
    return [list, size];
  }),
  'monotonic-stack': input(['数组（最多 12 个数）', 'Array (up to 12 numbers)'], '3 1 4 1 5 9 2 6', (text) => [numbers(text, 12)]),
  // ponytail: 10, not 16, so the (n + 2)-column table still fits a phone.
  'dp-table': input(['两个字符串（字母或数字，各最多 10 个）', 'Two strings (letters or digits, up to 10 each)'], 'ACBD ABCD', (text) => {
    const list = tokens(text.replace(/[;；|]/g, ' '));
    if (list.length !== 2) fail('填两个字符串，用空格隔开', 'Enter two strings separated by a space');
    for (const w of list)
      if (!/^[A-Za-z0-9]{1,10}$/.test(w)) fail(`「${w}」：只能是 1 到 10 个字母或数字`, `"${w}": 1 to 10 letters or digits only`);
    return list;
  }),
  // ponytail: one digit per number, so the 16 leaf notes of a 4-number tree do not overlap.
  backtracking: input(['数组（最多 4 个，每个 −9 到 9）', 'Numbers (up to 4, each −9 to 9)'], '1 2 3', (text) => [numbers(text, 4, 9)]),
  trie: input(['要插入的单词; 要查找的词', 'Words to insert; words to search'], 'cat car cart dog do; car cap do', (text) => {
    const [insert, search = ''] = parts(text, 2, 1);
    const list = words(insert, 6, 8, ['单词', 'words']);
    if (!list.length) fail('至少插入一个单词', 'Insert at least one word');
    return [list, words(search, 6, 8, ['查找的词', 'searches'])];
  }),
  'topo-sort': input(['边：A–F 之间，写成 A>C', 'Edges between A–F, written A>C'], 'A>C B>C B>D C>E D>E D>F E>F', (text) => {
    const compact = text.toUpperCase().replace(/[\s,，、;；]+/g, '').replace(/->|→/g, '>');
    if (!/^([A-F]>[A-F])+$/.test(compact))
      fail('每条边写成 A>C，只能用 A 到 F', 'Write each edge as A>C, using only A to F');
    const edges = compact.match(/[A-F]>[A-F]/g)!.map((e) => [e[0], e[2]] as [string, string]);
    if (edges.length > 10) fail('最多 10 条边', 'At most 10 edges');
    if (edges.some(([a, b]) => a === b)) fail('边不能指向自己', 'An edge cannot point to its own node');
    if (new Set(edges.map((e) => e.join(''))).size < edges.length) fail('有重复的边', 'An edge is listed twice');
    return [edges];
  }),
  'array-ops': input(['有序数组; 插入的数; 删除的下标', 'Sorted array; value to insert; index to delete'], '1 2 2 4 4 4 6; 3; 0', (text) => {
    const [values, x, del] = parts(text, 3);
    const list = sorted(numbers(values, 10));
    return [list, one(x), within(one(del), 0, list.length, ['删除的下标', 'The index to delete'])];
  }),
  'hash-table': input(['依次插入的键（最多 10 个，0 到 99）', 'Keys to insert (up to 10, 0 to 99)'], '12 7 4 15 9 20 3', (text) => [naturals(text, 10)]),
  'linked-list': input(['链表; 插入的值 位置; 删除的位置', 'List; value and position to insert; position to delete'], '1 2 3 4; 9 2; 0', (text) => {
    const [values, insert, del] = parts(text, 3);
    const list = numbers(values, 6),
      pair = numbers(insert, 2);
    if (pair.length !== 2) fail('插入要填两个数：值和位置', 'Insert takes two numbers: the value and the position');
    const at = within(pair[1], 0, list.length, ['插入位置', 'The insert position']);
    return [list, pair[0], at, within(one(del), 0, list.length, ['删除位置', 'The delete position'])];
  }),
  'tree-traversal': input(['遍历顺序：pre、in、post、level 任选', 'Orders: any of pre, in, post, level'], 'pre in post level', (text) => {
    const list = tokens(text.toLowerCase());
    if (!list.length || list.some((o) => !TREE_ORDERS.includes(o as TreeOrder)) || new Set(list).size < list.length)
      fail('只能写 pre、in、post、level，每种最多一次', 'Use pre, in, post or level, each at most once');
    return [list];
  }),
  bst: input(['初始键; 操作（?查找 +插入 -删除）', 'Starting keys; operations (?find +insert -delete)'], '8 3 10 1 6 14 4 7 13; ?6 +5 -1 -14 -8', (text) => {
    const [keys, ops] = parts(text, 2);
    const list = naturals(keys, 10);
    const steps = tokens(ops.replace(/−/g, '-'));
    if (!steps.length || steps.length > 6) fail('操作要有 1 到 6 个', 'Enter 1 to 6 operations');
    return [
      list,
      steps.map((step): BstOp => {
        const m = /^([?+-])(\d{1,2})$/.exec(step);
        if (!m) fail(`「${step}」：写成 ?6、+5 或 -3`, `"${step}": write ?6, +5 or -3`);
        return [m[1] === '?' ? 'find' : m[1] === '+' ? 'insert' : 'delete', Number(m[2])];
      }),
    ];
  }),
  'n-queens': input(['N（1 到 6）', 'N (1 to 6)'], '4', (text) => [within(one(text), 1, 6, ['N', 'N'])]),
  'interval-dp': input(['字符串（最多 8 个字母或数字）', 'String (up to 8 letters or digits)'], 'agbdba', (text) => {
    if (!/^[A-Za-z0-9]{1,8}$/.test(text)) fail('只能是 1 到 8 个字母或数字', '1 to 8 letters or digits only');
    return [text];
  }),
  'stock-dp': input(['每天的价格（最多 8 天，0 到 99）', 'Daily prices (up to 8 days, 0 to 99)'], '1 2 3 0 2', (text) => [naturals(text, 8)]),
  'lru-cache': input(['容量; 操作（k=v 是 put，k 是 get）', 'Capacity; operations (k=v is put, k is get)'], '2; 1=1 2=2 1 3=3 2 4=4 1 3 4', (text) => {
    const [capacity, ops] = parts(text, 2);
    const steps = tokens(ops);
    if (!steps.length || steps.length > 12) fail('操作要有 1 到 12 个', 'Enter 1 to 12 operations');
    return [
      within(one(capacity), 1, 4, ['容量', 'The capacity']),
      steps.map((step): LruOp => {
        const m = /^(\d{1,2})(?:=(-?\d{1,2}))?$/.exec(step);
        if (!m) fail(`「${step}」：put 写成 1=5，get 写成 1`, `"${step}": write put as 1=5 and get as 1`);
        return m[2] === undefined ? [Number(m[1])] : [Number(m[1]), Number(m[2])];
      }),
    ];
  }),
  'interval-greedy': input(['区间（写成 起点-终点，最多 8 个）', 'Intervals (start-end, up to 8)'], '1-4 3-5 0-6 5-7 3-9 6-10 8-11', (text) => {
    const list = tokens(text);
    if (!list.length || list.length > 8) fail('填 1 到 8 个区间', 'Enter 1 to 8 intervals');
    return [
      list.map((item): [number, number] => {
        const m = /^(\d{1,2})-(\d{1,2})$/.exec(item);
        if (!m || Number(m[1]) >= Number(m[2])) fail(`「${item}」：写成 1-4，起点小于终点`, `"${item}": write 1-4 with start below end`);
        return [Number(m[1]), Number(m[2])];
      }),
    ];
  }),
  'prefix-sum': input(['数组; k', 'Array; k'], '1 2 1 -1 2 1; 3', (text) => {
    const [values, k] = parts(text, 2);
    return [numbers(values, 10), one(k)];
  }),
  bits: input(['x（0 到 255）', 'x (0 to 255)'], '44', (text) => {
    if (tokens(text).length !== 1) fail('这里只填一个整数', 'Enter exactly one whole number here');
    return [naturals(text, 1, 255)[0]];
  }),
  kmp: input(['文本; 模式串（字母）', 'Text; pattern (letters)'], 'abxabcabcaby; abcaby', (text) => {
    const [body, pat] = parts(text.toLowerCase(), 2);
    if (!/^[a-z]{1,14}$/.test(body)) fail('文本是 1 到 14 个英文字母', 'The text is 1 to 14 letters a–z');
    if (!/^[a-z]{1,6}$/.test(pat)) fail('模式串是 1 到 6 个英文字母', 'The pattern is 1 to 6 letters a–z');
    if (pat.length > body.length) fail('模式串不能比文本长', 'The pattern cannot be longer than the text');
    return [body, pat];
  }),
  ...Object.fromEntries(SORT_ALGOS.map((algo) => [`sort-${algo}`, sortInput(algo)])),
};

/** Cells (`c3`) and graph nodes (`nB`) that a frame marks as current. */
export function activeKeys(frame: DemoFrame): Set<string> {
  return new Set([
    ...frame.cells.flatMap((c, i) => (c.state === 'active' ? [`c${i}`] : [])),
    ...(frame.graph?.nodes ?? []).flatMap((n) => (n.state === 'active' ? [`n${n.id}`] : [])),
  ]);
}
/**
 * Predict mode's question for the step from `now` to `next`: what turns current that is not
 * current yet, among what `now` already draws (a node the next step creates can't be clicked).
 * Empty: nothing to guess, the step just plays.
 */
export function guessTargets(now: DemoFrame, next: DemoFrame): Set<string> {
  const before = activeKeys(now);
  const drawn = new Set([...now.cells.map((_, i) => `c${i}`), ...(now.graph?.nodes ?? []).map((n) => `n${n.id}`)]);
  return new Set([...activeKeys(next)].filter((key) => !before.has(key) && drawn.has(key)));
}

export function createDemoTrace(kind: DemoKind, english = false, input?: readonly unknown[]): DemoTrace {
  const t = english ? enText : zhText;
  // ponytail: positional args from demoInputs[kind].parse, unchecked here (its tests cover each
  // kind); a missing one is undefined, which picks the trace function's default.
  const [a, b, c, d] = (input ?? []) as [never?, never?, never?, never?];
  switch (kind) {
    case 'binary-search':
      return binarySearchTrace(a, b, t);
    case 'sliding-window':
      return slidingWindowTrace(a, t);
    case 'bfs':
      return bfsTrace(t);
    case 'dp':
      return dpTrace(a, b, t);
    case 'two-pointers':
      return twoPointersTrace(a, b, t);
    case 'dfs':
      return dfsTrace(a, t);
    case 'dijkstra':
      return dijkstraTrace(t);
    case 'union-find':
      return unionFindTrace(undefined, undefined, t);
    case 'topo-sort':
      return topoSortTrace(a, t);
    case 'heap':
      return heapTrace(a, b, t);
    case 'monotonic-stack':
      return monotonicStackTrace(a, t);
    case 'dp-table':
      return dpTableTrace(a, b, t);
    case 'backtracking':
      return backtrackingTrace(a, t);
    case 'trie':
      return trieTrace(a, b, t);
    case 'array-ops':
      return arrayOpsTrace(a, b, c, t);
    case 'hash-table':
      return hashTableTrace(a, t);
    case 'linked-list':
      return linkedListTrace(a, b, c, d, t);
    case 'tree-traversal':
      return treeTraversalTrace(a, t);
    case 'bst':
      return bstTrace(a, b, t);
    case 'kruskal':
      return kruskalTrace(t);
    case 'n-queens':
      return nQueensTrace(a, t);
    case 'interval-dp':
      return intervalDpTrace(a, t);
    case 'stock-dp':
      return stockDpTrace(a, t);
    case 'lru-cache':
      return lruTrace(a, b, t);
    case 'interval-greedy':
      return intervalGreedyTrace(a, t);
    case 'prefix-sum':
      return prefixSumTrace(a, b, t);
    case 'bits':
      return bitsTrace(a, t);
    case 'kmp':
      return kmpTrace(a, b, t);
    default:
      return sortTrace(kind.slice(5) as SortAlgo, a ?? SORT_DEFAULT, t);
  }
}
