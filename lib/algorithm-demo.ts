export type DemoKind = 'binary-search' | 'sliding-window' | 'bfs' | 'dp';
export type DemoCell = {
  value: string | number;
  label: string;
  state?: 'active' | 'visited' | 'muted' | 'answer' | 'blocked';
};
export type DemoFrame = {
  caption: string;
  cells: DemoCell[];
  stats: [string, string][];
  queue?: string[];
  done?: boolean;
};
export type DemoTrace = {
  title: string;
  question: string;
  invariant: string;
  columns?: number;
  frames: DemoFrame[];
};
export const demoKinds: DemoKind[] = [
  'binary-search',
  'sliding-window',
  'bfs',
  'dp',
];
export function isDemoKind(kind: string): kind is DemoKind {
  return demoKinds.includes(kind as DemoKind);
}

export function binarySearchTrace(
  values = [2, 5, 8, 12, 16, 23, 38, 56],
  target = 23,
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
        ['目标', String(target)],
        ['left', String(left)],
        ['right', String(right)],
        ['mid', mid < 0 ? '—' : String(mid)],
      ],
    });
  frame('初始搜索区间包含整个有序数组。下方数字是数组下标。');
  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2);
    frame(`检查下标 ${mid}：${values[mid]} 与目标 ${target} 比较。`, mid);
    if (values[mid] === target) {
      frame(`找到目标！返回下标 ${mid}。`, mid, mid, true);
      break;
    }
    if (values[mid] < target) {
      left = mid + 1;
      frame(
        `${values[mid]} < ${target}，左侧连同 mid 都不可能是答案，left 移到 ${left}。`,
      );
    } else {
      right = mid - 1;
      frame(
        `${values[mid]} > ${target}，右侧连同 mid 都不可能是答案，right 移到 ${right}。`,
      );
    }
  }
  if (!frames.at(-1)?.done)
    frame('区间为空，目标不存在，返回 −1。', -1, -1, true);
  return {
    title: '二分查找 · 每次排除一半',
    question: `在有序数组中查找 ${target}`,
    invariant: '如果目标存在，它始终位于闭区间 [left, right] 内。',
    frames,
  };
}

export function slidingWindowTrace(input = 'abcabcbb'): DemoTrace {
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
        ['窗口长度', String(Math.max(0, right - left + 1))],
        ['最长长度', String(best)],
      ],
    });
  frame('从空窗口开始，求不含重复字符的最长子串长度。', -1);
  for (let right = 0; right < chars.length; right++) {
    while (seen.has(chars[right])) {
      const removed = chars[left];
      seen.delete(removed);
      left++;
      frame(
        `下一个字符 ${chars[right]} 已在窗口内：移除左端 ${removed}，继续检查。`,
        right - 1,
      );
    }
    seen.add(chars[right]);
    best = Math.max(best, right - left + 1);
    frame(
      `加入 ${chars[right]}。当前窗口「${chars.slice(left, right + 1).join('')}」没有重复字符，更新最长长度。`,
      right,
    );
  }
  frame(`遍历完成，最长无重复子串长度为 ${best}。`, chars.length - 1, true);
  return {
    title: '滑动窗口 · 无重复字符子串',
    question: `输入：${input || '空字符串'}`,
    invariant: '每次加入右端字符后，窗口内所有字符互不相同；left 只向右移动。',
    frames,
  };
}

export function bfsTrace(): DemoTrace {
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
  const frame = (
    caption: string,
    current = -1,
    path: number[] = [],
    done = false,
  ) =>
    frames.push({
      caption,
      done,
      cells: distance.map((d, i) => ({
        value: walls.has(i)
          ? '■'
          : i === 0
            ? 'S'
            : i === goal
              ? 'T'
              : d < 0
                ? '·'
                : d,
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
        ['已发现', String(distance.filter((d) => d >= 0).length)],
        ['当前距离', current < 0 ? '—' : String(distance[current])],
        ['终点距离', distance[goal] < 0 ? '未到达' : String(distance[goal])],
      ],
      queue: queue.map(name),
    });
  frame('起点 S 入队，距离为 0。每一步只能上下左右移动，深色格不可通行。');
  while (queue.length) {
    const current = queue.shift()!;
    frame(
      `取出队首 ${name(current)}，它与起点的最短距离是 ${distance[current]}。`,
      current,
    );
    if (current === goal) {
      const path: number[] = [];
      for (let i = goal; i >= 0; i = parent[i]) path.push(i);
      frame(
        `到达 T！沿前驱还原最短路径，共 ${distance[goal]} 步。`,
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
      if (
        nr < 0 ||
        nr >= rows ||
        nc < 0 ||
        nc >= columns ||
        walls.has(next) ||
        distance[next] >= 0
      )
        continue;
      distance[next] = distance[current] + 1;
      parent[next] = current;
      queue.push(next);
      frame(
        `发现 ${name(next)}，距离设为 ${distance[next]}，标记后入队，避免重复访问。`,
        next,
      );
    }
  }
  return {
    title: 'BFS · 网格最短路径',
    question: '从左上角 S 到右下角 T，最少走几步？',
    invariant:
      '队列按距离从小到大处理；每个格子第一次被发现时，其最短距离已经确定。',
    columns,
    frames,
  };
}

export function dpTrace(amount = 6, coins = [1, 3, 4]): DemoTrace {
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
        ['目标金额', String(amount)],
        ['当前金额', current < 0 ? '—' : String(current)],
        [
          '最少硬币',
          Number.isFinite(dp[amount]) ? String(dp[amount]) : '尚不可达',
        ],
      ],
    });
  frame(
    'dp[0] = 0，其余状态为 ∞（不可达）。dp[x] 表示凑出金额 x 的最少硬币数。',
  );
  for (let x = 1; x <= amount; x++)
    for (const coin of coins) {
      if (coin > x) continue;
      const candidate = dp[x - coin] + 1,
        before = dp[x];
      dp[x] = Math.min(dp[x], candidate);
      frame(
        `金额 ${x}，尝试最后一枚用 ${coin}：dp[${x - coin}] + 1 = ${Number.isFinite(candidate) ? candidate : '∞'}。${dp[x] < before ? `更新 dp[${x}] = ${dp[x]}` : '不能得到更少硬币，保留原值'}。`,
        x,
        x - coin,
      );
    }
  frame(
    Number.isFinite(dp[amount])
      ? `计算完成，凑出 ${amount} 最少需要 ${dp[amount]} 枚硬币。`
      : `计算完成，无法凑出 ${amount}，返回 −1。`,
    amount,
    -1,
    true,
  );
  return {
    title: '动态规划 · 零钱兑换',
    question: `硬币 ${coins.join('、')}，每种无限枚，凑出 ${amount}`,
    invariant: '按金额递增计算；更新 dp[x] 时，所有更小金额的最优解都已确定。',
    frames,
  };
}
export function createDemoTrace(kind: DemoKind): DemoTrace {
  switch (kind) {
    case 'binary-search':
      return binarySearchTrace();
    case 'sliding-window':
      return slidingWindowTrace();
    case 'bfs':
      return bfsTrace();
    case 'dp':
      return dpTrace();
  }
}
