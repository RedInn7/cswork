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
  | 'trie';
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
    t(
      `箭头 X → Y 表示先修 X 才能修 Y。入度为 0 的 ${queue.join('、')} 没有先修要求，先入队。`,
      `An arrow X → Y means X must come before Y. ${queue.join(', ')} have in-degree 0, so they join the queue first.`,
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

/** [中文, English]: input labels and parse errors are shown in the page's language. */
export type Pair = [string, string];
export type DemoParse = { args: unknown[] } | { error: Pair };
export type DemoInput = { label: Pair; placeholder: string; parse: (text: string) => DemoParse };

class InputError extends Error {
  constructor(readonly pair: Pair) {
    super(pair[1]);
  }
}
function fail(zh: string, en: string): never {
  throw new InputError([zh, en]);
}
/** "a; b" → ['a', 'b']: the parts a kind's input is split into. */
function parts(text: string, count: number, optional = 0): string[] {
  const found = text.split(/[;；|]/).map((p) => p.trim());
  if (found.length < count - optional || found.length > count)
    fail(`格式是 ${count} 段，用分号隔开`, `Use ${count} parts separated by semicolons`);
  return found;
}
const tokens = (text: string) => text.split(/[\s,，、]+/).filter(Boolean);
/** Whole numbers with |v| ≤ limit, between 1 and `max` of them. */
function numbers(text: string, max: number, limit = 99): number[] {
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
const one = (text: string) => numbers(text, 1)[0];
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
const input = (label: Pair, placeholder: string, read: (text: string) => unknown[]): DemoInput => ({
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
  const [a, b] = (input ?? []) as [never?, never?];
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
  }
}
