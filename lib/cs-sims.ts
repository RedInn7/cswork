/**
 * OS and networking simulators for the arithmetic in OA multiple choice: CPU scheduling, page
 * replacement, the banker's algorithm, TCP open and close, congestion control and sliding-window
 * ARQ. Each has a pure function (tested on its own) and a trace in the algorithm demo's frame
 * format, so components/algorithm-demo.tsx plays it and course Markdown embeds it with
 * ```algorithm-demo + a kind name. The kinds are kept out of DemoKind, which the topic pages pin.
 */
import {
  enText,
  fail,
  input,
  numbers,
  one,
  parts,
  tokens,
  zhText,
  type DemoCell,
  type DemoFrame,
  type DemoGraph,
  type DemoInput,
  type DemoTrace,
  type Pair,
  type Tr,
} from './algorithm-demo';

export type SimKind =
  | 'cpu-scheduling'
  | 'page-replacement'
  | 'bankers'
  | 'tcp-handshake'
  | 'tcp-congestion'
  // ponytail: not 'sliding-window', which is already the string-window DemoKind.
  | 'sliding-window-arq';
export const simKinds: SimKind[] = [
  'cpu-scheduling',
  'page-replacement',
  'bankers',
  'tcp-handshake',
  'tcp-congestion',
  'sliding-window-arq',
];
export function isSimKind(kind: string): kind is SimKind {
  return simKinds.includes(kind as SimKind);
}

/** Bank questions whose answer a simulator works out: /oa/mcq links them to /oa/sims#kind once answered. */
export const MCQ_SIMS: Record<string, SimKind> = {
  'mcq-os-3': 'cpu-scheduling',
  'mcq-os-9': 'page-replacement',
  'mcq-os-10': 'page-replacement',
  'mcq-os-15': 'cpu-scheduling',
  'mcq-network-2': 'tcp-handshake',
  'mcq-network-8': 'tcp-handshake',
  'mcq-network-11': 'sliding-window-arq',
  'mcq-network-12': 'tcp-congestion',
};

const round2 = (n: number) => String(Math.round(n * 100) / 100);
const vec = (v: number[]) => `(${v.join(', ')})`;
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i);
/** Comma-separated rows of one part ("A 0 5, B 1 3"). */
const rows = (text: string) =>
  text
    .split(/[,，]/)
    .map((r) => r.trim())
    .filter(Boolean);

// ---------------------------------------------------------------- CPU scheduling

export type Proc = { id: string; arrive: number; burst: number; prio: number };
export type SchedAlgo = 'fcfs' | 'sjf' | 'srtf' | 'rr' | 'prio' | 'prio-p';
/** One stretch on the CPU (id null: idle), with the ready queue when it starts. */
export type Slice = { id: string | null; start: number; end: number; ready: string[] };
export type SchedRow = { id: string; wait: number; tat: number; resp: number; finish: number };
const SCHED_ALGOS: SchedAlgo[] = ['fcfs', 'sjf', 'srtf', 'rr', 'prio', 'prio-p'];

/**
 * Simulates one time unit at a time. Ties go to the earlier arrival, then the earlier input
 * line; a smaller priority number runs first; in RR a process arriving at the moment a
 * quantum runs out queues ahead of the preempted one. Preemption needs a strictly better key.
 */
export function schedule(procs: Proc[], algo: SchedAlgo, q = 2) {
  const rem = procs.map((p) => p.burst),
    first = procs.map(() => -1),
    finish = procs.map(() => 0),
    slices: Slice[] = [],
    ready: number[] = [];
  const preemptive = algo === 'srtf' || algo === 'prio-p';
  const key = (i: number) =>
    algo === 'sjf' ? procs[i].burst : algo === 'srtf' ? rem[i] : algo === 'prio' || algo === 'prio-p' ? procs[i].prio : 0;
  const ahead = (i: number, j: number) =>
    key(i) < key(j) || (key(i) === key(j) && (procs[i].arrive < procs[j].arrive || (procs[i].arrive === procs[j].arrive && i < j)));
  const pick = () => (algo === 'rr' ? ready[0] : ready.reduce((best, i) => (best < 0 || ahead(i, best) ? i : best), -1));
  let cur = -1,
    used = 0,
    left = procs.length;
  for (let t = 0; left; t++) {
    procs.forEach((p, i) => p.arrive === t && ready.push(i));
    if (algo === 'rr' && cur >= 0 && used === q) {
      ready.push(cur);
      cur = -1;
    }
    if (preemptive && cur >= 0 && ready.length && key(pick()) < key(cur)) {
      ready.push(cur);
      cur = -1;
    }
    let fresh = false;
    if (cur < 0 && ready.length) {
      cur = pick();
      ready.splice(ready.indexOf(cur), 1);
      used = 0;
      fresh = true;
    }
    const id = cur < 0 ? null : procs[cur].id,
      prev = slices.at(-1);
    if (prev && !fresh && prev.id === id) prev.end = t + 1;
    else slices.push({ id, start: t, end: t + 1, ready: ready.map((i) => procs[i].id) });
    if (cur < 0) continue;
    if (first[cur] < 0) first[cur] = t;
    used++;
    if (!--rem[cur]) {
      finish[cur] = t + 1;
      left--;
      cur = -1;
    }
  }
  const table: SchedRow[] = procs.map((p, i) => ({
    id: p.id,
    finish: finish[i],
    tat: finish[i] - p.arrive,
    wait: finish[i] - p.arrive - p.burst,
    resp: first[i] - p.arrive,
  }));
  const mean = (k: 'wait' | 'tat' | 'resp') => table.reduce((s, r) => s + r[k], 0) / table.length;
  return { slices, rows: table, avg: { wait: mean('wait'), tat: mean('tat'), resp: mean('resp') } };
}

const SCHED_NAMES: Record<SchedAlgo, Pair> = {
  fcfs: ['先来先服务 FCFS', 'First come, first served (FCFS)'],
  sjf: ['短作业优先 SJF（非抢占）', 'Shortest job first (SJF, non-preemptive)'],
  srtf: ['最短剩余时间优先 SRTF（抢占）', 'Shortest remaining time first (SRTF, preemptive)'],
  rr: ['时间片轮转 RR', 'Round robin (RR)'],
  prio: ['优先级调度（非抢占）', 'Priority (non-preemptive)'],
  'prio-p': ['优先级调度（抢占）', 'Priority (preemptive)'],
};
export const DEFAULT_PROCS: Proc[] = [
  { id: 'A', arrive: 0, burst: 5, prio: 3 },
  { id: 'B', arrive: 1, burst: 3, prio: 1 },
  { id: 'C', arrive: 2, burst: 1, prio: 4 },
  { id: 'D', arrive: 3, burst: 2, prio: 2 },
];

export function schedulingTrace(procs = DEFAULT_PROCS, algo: SchedAlgo = 'rr', q = 2, t: Tr = zhText): DemoTrace {
  const { slices, rows: table, avg } = schedule(procs, algo, q);
  const name = t(...SCHED_NAMES[algo]) + (algo === 'rr' ? ` q=${q}` : '');
  const usesPrio = algo === 'prio' || algo === 'prio-p';
  const proc = new Map(procs.map((p) => [p.id, p]));
  const done = new Map(table.map((r) => [r.id, r]));
  /** Time left for each process at moment `at`, replayed from the slices. */
  const remAt = (at: number) => {
    const left = new Map(procs.map((p) => [p.id, p.burst]));
    for (const s of slices) if (s.id && s.start < at) left.set(s.id, left.get(s.id)! - (Math.min(s.end, at) - s.start));
    return left;
  };
  const cells = (upto: number, final = false): DemoCell[] =>
    slices.slice(0, upto + 1).map((s, i) => ({
      value: s.id ?? '—',
      label: `${s.start}–${s.end}`,
      state: s.id === null ? 'muted' : i === upto && !final ? 'active' : 'visited',
    }));
  const frames: DemoFrame[] = [
    {
      caption: t(
        `${name}：${procs.length} 个进程。每一格是 CPU 上连续运行的一段，格子下方是起止时刻。`,
        `${name}: ${procs.length} processes. Each cell is one stretch on the CPU, with its start and end time below.`,
      ),
      cells: [],
      queue: [],
      stats: procs.map((p) => [
        p.id,
        t(
          `到达 ${p.arrive} · 运行 ${p.burst}${usesPrio ? ` · 优先级 ${p.prio}` : ''}`,
          `arrives ${p.arrive} · burst ${p.burst}${usesPrio ? ` · priority ${p.prio}` : ''}`,
        ),
      ]),
    },
  ];
  slices.forEach((s, k) => {
    const before = remAt(s.start),
      after = remAt(s.end);
    let caption: string;
    if (!s.id) caption = t(`t=${s.start}–${s.end}：还没有进程到达，CPU 空闲。`, `t=${s.start}–${s.end}: no process has arrived yet, so the CPU idles.`);
    else {
      const p = proc.get(s.id)!;
      const why =
        algo === 'rr'
          ? t(`${s.id} 在就绪队列队首`, `${s.id} is at the front of the ready queue`)
          : !s.ready.length
            ? t(`只有 ${s.id} 就绪`, `only ${s.id} is ready`)
            : algo === 'fcfs'
              ? t(`${s.id} 最早到达（t=${p.arrive}）`, `${s.id} arrived first (t=${p.arrive})`)
              : algo === 'sjf'
                ? t(`就绪进程里 ${s.id} 的运行时间最短（${p.burst}）`, `${s.id} has the shortest burst of the ready processes (${p.burst})`)
                : algo === 'srtf'
                  ? t(`${s.id} 的剩余时间最短（${before.get(s.id)}）`, `${s.id} has the least time left (${before.get(s.id)})`)
                  : t(`${s.id} 的优先级数字最小（${p.prio}）`, `${s.id} has the smallest priority number (${p.prio})`);
      const end =
        done.get(s.id)!.finish === s.end
          ? t(`运行到 t=${s.end} 结束`, `it runs until it finishes at t=${s.end}`)
          : algo === 'rr'
            ? t(
                `运行到 t=${s.end} 用完时间片，回到队尾（同一时刻新到达的排在它前面）`,
                `it runs until its quantum ends at t=${s.end} and rejoins the back of the queue, behind anything arriving at that moment`,
              )
            : t(`运行到 t=${s.end}，被 ${slices[k + 1].id} 抢占`, `it runs until ${slices[k + 1].id} preempts it at t=${s.end}`);
      caption = t(`t=${s.start}：${why}，${end}。`, `t=${s.start}: ${why}; ${end}.`);
    }
    frames.push({
      caption,
      cells: cells(k),
      queue: s.ready.map((id) => `${id}:${usesPrio ? proc.get(id)!.prio : before.get(id)}`),
      stats: [
        [t('时间', 'Time'), `${s.start}–${s.end}`],
        [t('运行', 'Running'), s.id ?? t('空闲', 'idle')],
        [
          t('剩余时间', 'Time left'),
          procs
            .filter((p) => p.arrive <= s.end && after.get(p.id)! > 0)
            .map((p) => `${p.id} ${after.get(p.id)}`)
            .join(' · ') || '—',
        ],
        [t('已完成', 'Finished'), table.filter((r) => r.finish <= s.end).map((r) => r.id).join(' ') || '—'],
      ],
    });
  });
  const line = (w: number, tat: number, r: number) =>
    t(`等待 ${w} · 周转 ${tat} · 响应 ${r}`, `wait ${w} · turnaround ${tat} · response ${r}`);
  frames.push({
    caption: t(
      `全部完成。平均等待时间 ${round2(avg.wait)}，平均周转时间 ${round2(avg.tat)}，平均响应时间 ${round2(avg.resp)}。`,
      `All done. Average waiting time ${round2(avg.wait)}, turnaround ${round2(avg.tat)}, response ${round2(avg.resp)}.`,
    ),
    cells: cells(slices.length - 1, true),
    queue: [],
    stats: [
      ...table.map((r): [string, string] => [r.id, line(r.wait, r.tat, r.resp)]),
      [t('平均', 'Average'), line(+round2(avg.wait), +round2(avg.tat), +round2(avg.resp))],
    ],
    done: true,
  });
  return {
    title: t('CPU 调度 · 甘特图', 'CPU scheduling · Gantt chart'),
    question: t(`${name}：平均等待时间是多少？`, `${name}: what is the average waiting time?`),
    invariant: t(
      '周转 = 完成 − 到达，等待 = 周转 − 运行时间，响应 = 第一次上 CPU − 到达。约定：同时到达按输入顺序；优先级数字越小越优先；RR 中同一时刻新到达的进程排在刚用完时间片的进程前面。',
      'Turnaround = finish − arrival, waiting = turnaround − burst, response = first run − arrival. Ties go by input order; a smaller priority number runs first; in RR a process arriving as a quantum ends queues ahead of the preempted one.',
    ),
    queueLabel: usesPrio
      ? t('就绪队列（进程:优先级）', 'Ready queue (process:priority)')
      : t('就绪队列（进程:剩余时间）', 'Ready queue (process:time left)'),
    frames,
  };
}

// ---------------------------------------------------------------- page replacement

export type ReplAlgo = 'fifo' | 'lru' | 'opt' | 'clock';
/** After one reference: the frames, which slot it hit or filled, and (Clock) the hand and reference bits. */
export type ReplStep = {
  page: number;
  frames: (number | null)[];
  hit: boolean;
  slot: number;
  victim?: number;
  hand?: number;
  refBits?: number[];
};
const REPL_ALGOS: ReplAlgo[] = ['fifo', 'lru', 'opt', 'clock'];
const REPL_NAMES: Record<ReplAlgo, string> = { fifo: 'FIFO', lru: 'LRU', opt: 'OPT', clock: 'Clock' };

/**
 * Free frames fill in order. OPT evicts the page used furthest ahead (never again counts as
 * furthest; ties take the lower slot). Clock sets a page's bit on load and on a hit, and on a
 * fault with memory full clears and skips set bits from the hand, evicting the first clear one.
 */
export function replace(refs: number[], size: number, algo: ReplAlgo) {
  const frames: (number | null)[] = Array(size).fill(null),
    loaded: number[] = Array(size).fill(0),
    used: number[] = Array(size).fill(0),
    bits: number[] = Array(size).fill(0);
  let hand = 0,
    faults = 0;
  const lowest = (score: (i: number) => number) => frames.reduce<number>((best, _, i) => (score(i) < score(best) ? i : best), 0);
  const steps = refs.map((page, now): ReplStep => {
    let slot = frames.indexOf(page);
    const hit = slot >= 0;
    let victim: number | undefined;
    if (!hit) {
      faults++;
      slot = frames.indexOf(null);
      if (slot < 0) {
        if (algo === 'clock') {
          while (bits[hand]) {
            bits[hand] = 0;
            hand = (hand + 1) % size;
          }
          slot = hand;
        } else
          slot =
            algo === 'fifo'
              ? lowest((i) => loaded[i])
              : algo === 'lru'
                ? lowest((i) => used[i])
                : lowest((i) => {
                    const next = refs.indexOf(frames[i]!, now + 1);
                    return next < 0 ? -Infinity : -next;
                  });
        victim = frames[slot]!;
      }
      frames[slot] = page;
      loaded[slot] = now;
    }
    used[slot] = now;
    if (algo !== 'clock') return { page, frames: [...frames], hit, slot, victim };
    bits[slot] = 1;
    if (!hit) hand = (slot + 1) % size;
    return { page, frames: [...frames], hit, slot, victim, hand, refBits: [...bits] };
  });
  return { steps, faults };
}
/** Faults with 1, 2, … `most` frames. */
export function faultCurve(refs: number[], algo: ReplAlgo, most = 7) {
  return range(1, most + 1).map((size) => replace(refs, size, algo).faults);
}
/** The first frame count where one more frame faults more: [frames, faults, frames + 1, faults]. */
export function belady(curve: number[]) {
  const i = curve.findIndex((f, k) => k + 1 < curve.length && curve[k + 1] > f);
  return i < 0 ? null : [i + 1, curve[i], i + 2, curve[i + 1]];
}
export const DEFAULT_REFS = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];

export function pageTrace(refs = DEFAULT_REFS, size = 3, algo: ReplAlgo = 'fifo', t: Tr = zhText): DemoTrace {
  const { steps, faults } = replace(refs, size, algo);
  const name = REPL_NAMES[algo];
  const grid = (upto: number, final = false): DemoCell[] => [
    ...refs.map((page, j): DemoCell => ({
      value: page,
      label: `#${j + 1}`,
      state: j > upto ? 'muted' : j === upto && !final ? 'visited' : undefined,
    })),
    ...range(0, size).flatMap((r) =>
      refs.map((_, j): DemoCell => {
        const s = steps[j];
        if (j > upto) return { value: '', label: `F${r + 1}`, state: 'muted' };
        return {
          value: s.frames[r] ?? '',
          label: `F${r + 1}`,
          state: s.slot !== r ? undefined : j === upto && !final ? 'active' : s.hit ? 'visited' : 'blocked',
        };
      }),
    ),
  ];
  const clockStats = (s?: ReplStep): [string, string][] =>
    algo === 'clock'
      ? [
          [t('指针', 'Hand'), `F${(s?.hand ?? 0) + 1}`],
          [t('访问位', 'Reference bits'), (s?.refBits ?? Array(size).fill(0)).join(' ')],
        ]
      : [];
  const frames: DemoFrame[] = [
    {
      caption: t(
        `${size} 个页框，开始都是空的。第一行是访问序列，下面每行是一个页框，每一列是访问完这一页之后的内存。`,
        `${size} frames, all empty to start. The top row is the reference string; each row below is a frame, and each column shows memory after that access.`,
      ),
      cells: grid(-1),
      stats: [[t('缺页', 'Faults'), '0'], [t('命中', 'Hits'), '0'], ...clockStats()],
    },
  ];
  let seen = 0;
  steps.forEach((s, j) => {
    const at = `F${s.slot + 1}`;
    let caption: string;
    if (s.hit)
      caption = t(
        `访问 ${s.page}：已在 ${at}，命中。${algo === 'lru' ? '它成了最近使用的页。' : algo === 'clock' ? '访问位置 1。' : ''}`,
        `Access ${s.page}: already in ${at}, a hit.${algo === 'lru' ? ' It is now the most recently used page.' : algo === 'clock' ? ' Its reference bit is set to 1.' : ''}`,
      );
    else if (s.victim === undefined)
      caption = t(
        `访问 ${s.page}：不在内存，缺页。还有空页框，装入 ${at}。`,
        `Access ${s.page}: not in memory, a page fault. A frame is free, so it goes into ${at}.`,
      );
    else {
      const v = s.victim,
        next = refs.indexOf(v, j + 1),
        from = `F${(steps[j - 1]?.hand ?? 0) + 1}`;
      const why =
        algo === 'fifo'
          ? t(`换出最早装入的 ${v}`, `evict ${v}, the page loaded earliest`)
          : algo === 'lru'
            ? t(`换出最久没被访问的 ${v}`, `evict ${v}, the least recently used page`)
            : algo === 'opt'
              ? next < 0
                ? t(`换出以后不再访问的 ${v}`, `evict ${v}, which is never used again`)
                : t(`换出下次访问最晚的 ${v}（第 ${next + 1} 次访问才用到）`, `evict ${v}, whose next use (access #${next + 1}) is furthest away`)
              : t(
                  `指针从 ${from} 出发，访问位为 1 的清零跳过，换出第一个访问位为 0 的 ${v}`,
                  `the hand starts at ${from}, clears and skips each set bit, and evicts ${v}, the first page whose bit is 0`,
                );
      caption = t(`访问 ${s.page}：缺页，页框已满，${why}（${at}）。`, `Access ${s.page}: a page fault with every frame full, so ${why} (${at}).`);
    }
    if (!s.hit) seen++;
    frames.push({
      caption,
      cells: grid(j),
      stats: [[t('缺页', 'Faults'), String(seen)], [t('命中', 'Hits'), String(j + 1 - seen)], ...clockStats(s)],
    });
  });
  const curve = faultCurve(refs, algo);
  const anomaly = belady(curve);
  const beladyText = anomaly
    ? t(`${anomaly[0]} 帧 ${anomaly[1]} 次 → ${anomaly[2]} 帧 ${anomaly[3]} 次`, `${anomaly[0]} frames ${anomaly[1]} → ${anomaly[2]} frames ${anomaly[3]}`)
    : algo === 'lru' || algo === 'opt'
      ? t('不会出现（栈算法）', 'never (a stack algorithm)')
      : t('这组输入没有', 'not with this input');
  frames.push({
    caption:
      t(`访问结束：${name} 共缺页 ${faults} 次（${refs.length} 次访问）。`, `Done: ${name} faults ${faults} times in ${refs.length} accesses.`) +
      (anomaly
        ? t(
            `Belady 异常：多给一个页框反而多缺页，${beladyText}。`,
            ` Belady's anomaly: one more frame means more faults, ${beladyText}.`,
          )
        : ''),
    cells: grid(refs.length - 1, true),
    stats: [
      ...REPL_ALGOS.map((a): [string, string] => [
        t(`${REPL_NAMES[a]} 缺页`, `${REPL_NAMES[a]} faults`),
        String(replace(refs, size, a).faults),
      ]),
      [t(`${name} 缺页（1–7 帧）`, `${name} faults (1–7 frames)`), curve.join(' ')],
      [t('Belady 异常', "Belady's anomaly"), beladyText],
    ],
    done: true,
  });
  return {
    title: t('页面置换 · 数缺页', 'Page replacement · count the faults'),
    question: t(
      `${size} 个页框，用 ${name} 置换，访问 ${refs.join(' ')} 一共缺页几次？`,
      `With ${size} frames and ${name}, how many page faults does ${refs.join(' ')} cause?`,
    ),
    invariant: t(
      'FIFO 换出最早装入的页；LRU 换出最久没访问的页；OPT 换出下次访问最晚的页；Clock 给每页一个访问位（装入或命中时置 1），缺页时指针转圈，把 1 清成 0，换出第一个为 0 的页。LRU 和 OPT 是栈算法，页框越多缺页不会越多；FIFO 和 Clock 不是，会出现 Belady 异常。',
      'FIFO evicts the page loaded first; LRU the one used least recently; OPT the one used furthest ahead; Clock keeps a bit per page (set on load and on a hit) and on a fault sweeps the hand, clearing set bits, to evict the first clear one. LRU and OPT are stack algorithms, so more frames never mean more faults; FIFO and Clock are not and can show Belady’s anomaly.',
    ),
    columns: refs.length,
    frames,
  };
}

// ---------------------------------------------------------------- banker's algorithm

export type BankerReq = { p: number; vec: number[] };
export type BankerStep = { p: number; skipped: number[]; work: number[] };
const fits = (a: number[], b: number[]) => a.every((x, r) => x <= b[r]);

/**
 * The safety check scans from P0 each round and takes the first unfinished process whose
 * Need fits in Work. A request is checked against Need and Available, then granted on trial;
 * the returned Need/Available/Allocation are after that trial. `safe` is null when no order works.
 */
export function banker(avail: number[], alloc: number[][], max: number[][], req?: BankerReq | null) {
  const need = max.map((row, i) => row.map((m, r) => m - alloc[i][r]));
  let available = [...avail];
  const allocation = alloc.map((row) => [...row]);
  const steps: BankerStep[] = [];
  if (req && !fits(req.vec, need[req.p])) return { need, available, allocation, steps, safe: null, request: 'exceeds-need' as const };
  if (req && !fits(req.vec, available)) return { need, available, allocation, steps, safe: null, request: 'wait' as const };
  if (req) {
    available = available.map((a, r) => a - req.vec[r]);
    allocation[req.p] = allocation[req.p].map((a, r) => a + req.vec[r]);
    need[req.p] = need[req.p].map((n, r) => n - req.vec[r]);
  }
  let work = [...available];
  const finished = alloc.map(() => false);
  for (;;) {
    const skipped: number[] = [];
    const p = finished.findIndex((f, i) => !f && (fits(need[i], work) || (skipped.push(i), false)));
    if (p < 0) break;
    finished[p] = true;
    work = work.map((w, r) => w + allocation[p][r]);
    steps.push({ p, skipped, work });
  }
  const safe = finished.every(Boolean) ? steps.map((s) => s.p) : null;
  return { need, available, allocation, steps, safe, request: req ? (safe ? ('granted' as const) : ('unsafe' as const)) : undefined };
}
export const DEFAULT_AVAIL = [3, 3, 2];
export const DEFAULT_ALLOC = [
  [0, 1, 0],
  [2, 0, 0],
  [3, 0, 2],
  [2, 1, 1],
  [0, 0, 2],
];
export const DEFAULT_MAX = [
  [7, 5, 3],
  [3, 2, 2],
  [9, 0, 2],
  [2, 2, 2],
  [4, 3, 3],
];
export const DEFAULT_REQ: BankerReq = { p: 1, vec: [1, 0, 2] };

export function bankersTrace(
  avail = DEFAULT_AVAIL,
  alloc = DEFAULT_ALLOC,
  max = DEFAULT_MAX,
  req: BankerReq | null = DEFAULT_REQ,
  t: Tr = zhText,
): DemoTrace {
  const result = banker(avail, alloc, max, req);
  const first = max.map((row, i) => row.map((m, r) => m - alloc[i][r]));
  const P = (i: number) => `P${i}`;
  const list = (ids: number[]) => ids.map(P).join(t('、', ', '));
  const reqText = req ? `${P(req.p)} ${vec(req.vec)}` : '—';
  const frames: DemoFrame[] = [];
  const frame = (caption: string, need: number[][], state: (i: number) => DemoCell['state'], work: number[] | null, seq: number[], done = false) =>
    frames.push({
      caption,
      // One row per process: its name, then its Need for each resource type (A, B, C).
      cells: need.flatMap((n, i) => [
        { value: P(i), label: 'Need', state: state(i) },
        ...n.map((v, r) => ({ value: v, label: 'ABC'[r], state: state(i) })),
      ]),
      stats: [
        ['Available', vec(work === null && !done ? avail : result.available)],
        ['Work', work ? vec(work) : '—'],
        [t('请求', 'Request'), reqText],
      ],
      queue: seq.map(P),
      done,
    });
  frame(
    t(
      `每行是一个进程的 Need = Max − Allocation，也就是它还要多少 A、B、C 资源才能运行完。Available = ${vec(avail)}。`,
      `Each row is a process's Need = Max − Allocation: how much of resources A, B, C it still needs to finish. Available = ${vec(avail)}.`,
    ),
    first,
    () => undefined,
    null,
    [],
  );
  if (req) {
    const at = (i: number) => (i === req.p ? 'active' : undefined);
    if (result.request === 'exceeds-need' || result.request === 'wait') {
      frame(
        result.request === 'exceeds-need'
          ? t(
              `${P(req.p)} 请求 ${vec(req.vec)}，超过了它声明还需要的 ${vec(first[req.p])}：出错，直接拒绝。`,
              `${P(req.p)} asks for ${vec(req.vec)}, more than the ${vec(first[req.p])} it declared it still needs: an error, refused outright.`,
            )
          : t(
              `${P(req.p)} 请求 ${vec(req.vec)}，没超过 Need ${vec(first[req.p])}，但超过了 Available ${vec(avail)}：资源不够，${P(req.p)} 只能等待。`,
              `${P(req.p)} asks for ${vec(req.vec)}: within its Need ${vec(first[req.p])} but more than Available ${vec(avail)}, so ${P(req.p)} has to wait.`,
            ),
        first,
        at,
        null,
        [],
        true,
      );
      return bankersShape(frames, req, avail.length, t);
    }
    frame(
      t(
        `${P(req.p)} 请求 ${vec(req.vec)}：不超过 Need ${vec(first[req.p])}，也不超过 Available ${vec(avail)}。先试着分配：Available 变为 ${vec(result.available)}，${P(req.p)} 的 Need 变为 ${vec(result.need[req.p])}。再检查分配后是否安全。`,
        `${P(req.p)} asks for ${vec(req.vec)}: within its Need ${vec(first[req.p])} and within Available ${vec(avail)}. Grant it on trial: Available becomes ${vec(result.available)} and ${P(req.p)}'s Need ${vec(result.need[req.p])}. Then check that the new state is safe.`,
      ),
      result.need,
      at,
      result.available,
      [],
    );
  }
  let work = result.available;
  const order: number[] = [];
  for (const step of result.steps) {
    order.push(step.p);
    const before = work;
    work = step.work;
    frame(
      t(
        `Work = ${vec(before)}。${step.skipped.length ? `${list(step.skipped)} 的 Need 超过 Work，跳过；` : ''}${P(step.p)} 的 Need ${vec(result.need[step.p])} ≤ Work，让它运行完并归还 Allocation ${vec(result.allocation[step.p])}，Work 变为 ${vec(work)}。`,
        `Work = ${vec(before)}. ${step.skipped.length ? `${list(step.skipped)} need more than Work, so skip them; ` : ''}${P(step.p)}'s Need ${vec(result.need[step.p])} ≤ Work, so it runs to completion and returns its Allocation ${vec(result.allocation[step.p])}: Work becomes ${vec(work)}.`,
      ),
      result.need,
      (i) => (i === step.p ? 'active' : order.includes(i) ? 'visited' : undefined),
      work,
      [...order],
    );
  }
  const stuck = range(0, alloc.length).filter((i) => !order.includes(i));
  if (result.safe)
    frame(
      t(
        `找到安全序列 ${result.safe.map(P).join(' → ')}，系统处于安全状态。${req ? `${P(req.p)} 的请求可以批准。` : ''}`,
        `Safe sequence ${result.safe.map(P).join(' → ')}: the state is safe.${req ? ` ${P(req.p)}'s request can be granted.` : ''}`,
      ),
      result.need,
      () => 'answer',
      work,
      order,
      true,
    );
  else
    frame(
      t(
        `Work = ${vec(work)}，剩下的 ${list(stuck)} 的 Need 都超过 Work：找不到安全序列，系统不安全。${req ? `撤销试分配，${P(req.p)} 的请求不能批准，只能等待。` : ''}`,
        `Work = ${vec(work)}, and ${list(stuck)} all need more than that: there is no safe sequence, so the state is unsafe.${req ? ` Undo the trial grant: ${P(req.p)}'s request is refused and it waits.` : ''}`,
      ),
      result.need,
      (i) => (stuck.includes(i) ? 'blocked' : 'visited'),
      work,
      order,
      true,
    );
  return bankersShape(frames, req, avail.length, t);
}
function bankersShape(frames: DemoFrame[], req: BankerReq | null, kinds: number, t: Tr): DemoTrace {
  return {
    columns: kinds + 1,
    title: t('银行家算法 · 安全序列', "Banker's algorithm · safe sequence"),
    question: req
      ? t(`P${req.p} 请求 ${vec(req.vec)}，能批准吗？`, `P${req.p} asks for ${vec(req.vec)}. Can it be granted?`)
      : t('系统处于安全状态吗？安全序列是什么？', 'Is the state safe, and in what order can the processes finish?'),
    invariant: t(
      '每轮从 P0 开始扫描，选第一个 Need ≤ Work 的进程，它运行完把 Allocation 还回来：Work += Allocation。所有进程都能完成才是安全状态。请求先要满足 Request ≤ Need 和 Request ≤ Available，再试分配并做安全检查。安全序列可以不止一个，这里按"从 P0 扫描"的约定给出一个。',
      'Each round scans from P0 and picks the first process whose Need ≤ Work; it finishes and returns its Allocation: Work += Allocation. The state is safe only if every process can finish. A request must satisfy Request ≤ Need and Request ≤ Available, then is granted on trial and checked for safety. There can be several safe sequences; this one follows the scan-from-P0 rule.',
    ),
    queueLabel: t('安全序列（已找到的部分）', 'Safe sequence so far'),
    frames,
  };
}

// ---------------------------------------------------------------- TCP open and close

export type TcpState =
  | 'CLOSED'
  | 'LISTEN'
  | 'SYN_SENT'
  | 'SYN_RCVD'
  | 'ESTABLISHED'
  | 'FIN_WAIT_1'
  | 'FIN_WAIT_2'
  | 'CLOSE_WAIT'
  | 'CLOSING'
  | 'LAST_ACK'
  | 'TIME_WAIT';
export type TcpScenario = 'normal' | 'syn-loss' | 'simul-close';
export type TcpSeg = { from: 'C' | 'S'; flags: string; seq: number; ack?: number; lost?: boolean };
/** One step: the segments sent (crossing ones together), the states each side enters, in order, and what happened. */
export type TcpStep = { segs: TcpSeg[]; client: TcpState[]; server: TcpState[]; say: Pair };
const TCP_SCENARIOS: TcpScenario[] = ['normal', 'syn-loss', 'simul-close'];

/** Both sides start CLOSED; the client opens actively and, except in simul-close, closes first. No data flows. */
export function tcpSteps(kind: TcpScenario, x = 100, y = 300): TcpStep[] {
  const seg = (from: 'C' | 'S', flags: string, seq: number, ack?: number, lost?: boolean): TcpSeg => ({
    from,
    flags,
    seq,
    ...(ack === undefined ? {} : { ack }),
    ...(lost ? { lost } : {}),
  });
  const listen: TcpStep = {
    segs: [],
    client: [],
    server: ['LISTEN'],
    say: [
      `服务器先被动打开，进入 LISTEN；客户端在 CLOSED。初始序号：客户端 x = ${x}，服务器 y = ${y}。`,
      `The server opens passively and enters LISTEN; the client is CLOSED. Initial sequence numbers: client x = ${x}, server y = ${y}.`,
    ],
  };
  const syn: TcpStep = {
    segs: [seg('C', 'SYN', x)],
    client: ['SYN_SENT'],
    server: ['SYN_RCVD'],
    say: [
      `第一次握手：客户端发 SYN，seq = x = ${x}，进入 SYN_SENT；服务器收到后进入 SYN_RCVD。`,
      `Handshake 1: the client sends SYN with seq = x = ${x} and enters SYN_SENT; the server receives it and enters SYN_RCVD.`,
    ],
  };
  const open: TcpStep[] = [
    {
      segs: [seg('S', 'SYN+ACK', y, x + 1)],
      client: ['ESTABLISHED'],
      server: [],
      say: [
        `第二次握手：服务器回 SYN+ACK，seq = y = ${y}，ack = x + 1 = ${x + 1}（SYN 占一个序号）。客户端收到后进入 ESTABLISHED。`,
        `Handshake 2: the server answers SYN+ACK with seq = y = ${y} and ack = x + 1 = ${x + 1} (a SYN uses one sequence number). The client enters ESTABLISHED.`,
      ],
    },
    {
      segs: [seg('C', 'ACK', x + 1, y + 1)],
      client: [],
      server: ['ESTABLISHED'],
      say: [
        `第三次握手：客户端回 ACK，seq = ${x + 1}，ack = y + 1 = ${y + 1}。服务器进入 ESTABLISHED，连接建立。这一段已经可以带数据。`,
        `Handshake 3: the client sends ACK with seq = ${x + 1} and ack = y + 1 = ${y + 1}. The server enters ESTABLISHED. This segment may already carry data.`,
      ],
    },
  ];
  const timeWait = (who: Pair): Pair => [
    `2MSL 到时，${who[0]}进入 CLOSED。等 2MSL 一是防止最后的 ACK 丢失、对方重发 FIN 时无人应答，二是让这个连接的迟到报文在网络里消失，不会混进下一个同端口的连接。`,
    `After 2MSL ${who[1]} enters CLOSED. The wait answers a resent FIN if the last ACK was lost, and lets stray segments of this connection die out before the same ports are reused.`,
  ];
  if (kind === 'simul-close')
    return [
      listen,
      syn,
      ...open,
      {
        segs: [seg('C', 'FIN+ACK', x + 1, y + 1), seg('S', 'FIN+ACK', y + 1, x + 1)],
        client: ['FIN_WAIT_1', 'CLOSING'],
        server: ['FIN_WAIT_1', 'CLOSING'],
        say: [
          `双方同时关闭：各发 FIN 进入 FIN_WAIT_1。两个 FIN 在路上交叉，各自在 FIN_WAIT_1 收到对方的 FIN，进入 CLOSING 并回 ACK。`,
          `Both close at once: each sends FIN and enters FIN_WAIT_1. The FINs cross; each side receives the other's FIN in FIN_WAIT_1, enters CLOSING and acknowledges it.`,
        ],
      },
      {
        segs: [seg('C', 'ACK', x + 2, y + 2), seg('S', 'ACK', y + 2, x + 2)],
        client: ['TIME_WAIT'],
        server: ['TIME_WAIT'],
        say: [
          `双方的 ACK 交叉到达，各自的 FIN 都被确认，两边都进入 TIME_WAIT：同时关闭时双方都是主动关闭方。`,
          `The ACKs cross; each FIN is acknowledged, so both sides enter TIME_WAIT: in a simultaneous close both are active closers.`,
        ],
      },
      { segs: [], client: ['CLOSED'], server: ['CLOSED'], say: timeWait(['双方', 'both sides']) },
    ];
  return [
    listen,
    ...(kind === 'syn-loss'
      ? [
          {
            segs: [seg('C', 'SYN', x, undefined, true)],
            client: ['SYN_SENT' as const],
            server: [],
            say: [
              `客户端发 SYN（seq = ${x}），进入 SYN_SENT，但这个 SYN 在路上丢了，服务器还在 LISTEN。`,
              `The client sends SYN (seq = ${x}) and enters SYN_SENT, but the SYN is lost; the server stays in LISTEN.`,
            ] as Pair,
          },
          {
            ...syn,
            client: [],
            say: [
              `重传计时器超时，客户端重发 SYN，序号还是 ${x}（重传不换序号）。这次服务器收到，进入 SYN_RCVD。`,
              `The retransmission timer expires and the client resends SYN with the same seq ${x}. This time the server gets it and enters SYN_RCVD.`,
            ] as Pair,
          },
        ]
      : [syn]),
    ...open,
    {
      segs: [seg('C', 'FIN+ACK', x + 1, y + 1)],
      client: ['FIN_WAIT_1'],
      server: ['CLOSE_WAIT'],
      say: [
        `第一次挥手：客户端主动关闭，发 FIN（seq = ${x + 1}），进入 FIN_WAIT_1；服务器收到后进入 CLOSE_WAIT。`,
        `Close 1: the client closes first, sends FIN (seq = ${x + 1}) and enters FIN_WAIT_1; the server enters CLOSE_WAIT.`,
      ],
    },
    {
      segs: [seg('S', 'ACK', y + 1, x + 2)],
      client: ['FIN_WAIT_2'],
      server: [],
      say: [
        `第二次挥手：服务器先回 ACK（ack = ${x + 2}，FIN 也占一个序号），客户端进入 FIN_WAIT_2。这时服务器还能继续发数据（半关闭）。`,
        `Close 2: the server acknowledges the FIN (ack = ${x + 2}; a FIN uses one sequence number too) and the client enters FIN_WAIT_2. The server may still send data (half-close).`,
      ],
    },
    {
      segs: [seg('S', 'FIN+ACK', y + 1, x + 2)],
      client: ['TIME_WAIT'],
      server: ['LAST_ACK'],
      say: [
        `第三次挥手：服务器数据发完，发 FIN（seq = ${y + 1}），进入 LAST_ACK；客户端收到后进入 TIME_WAIT。`,
        `Close 3: done sending, the server sends its FIN (seq = ${y + 1}) and enters LAST_ACK; the client enters TIME_WAIT.`,
      ],
    },
    {
      segs: [seg('C', 'ACK', x + 2, y + 2)],
      client: [],
      server: ['CLOSED'],
      say: [
        `第四次挥手：客户端回最后一个 ACK（ack = ${y + 2}），服务器收到后进入 CLOSED；客户端还要在 TIME_WAIT 等 2MSL。`,
        `Close 4: the client sends the last ACK (ack = ${y + 2}); the server enters CLOSED, while the client waits 2MSL in TIME_WAIT.`,
      ],
    },
    { segs: [], client: ['CLOSED'], server: [], say: timeWait(['客户端', 'the client']) },
  ];
}

const segText = (s: TcpSeg) => `${s.flags} seq=${s.seq}${s.ack === undefined ? '' : ` ack=${s.ack}`}`;

export function tcpTrace(kind: TcpScenario = 'normal', x = 100, y = 300, t: Tr = zhText): DemoTrace {
  const steps = tcpSteps(kind, x, y);
  const rowY = (i: number) => 8 + i * 11;
  const height = rowY(steps.length - 1) + 12;
  let c: TcpState = 'CLOSED',
    s: TcpState = 'CLOSED';
  const at = steps.map((step) => {
    c = step.client.at(-1) ?? c;
    s = step.server.at(-1) ?? s;
    return { c, s };
  });
  const frames: DemoFrame[] = steps.map((step, k) => {
    const graph: DemoGraph = { width: 100, height, nodes: [], edges: [] };
    for (let i = 0; i <= k; i++) {
      const now = i === k,
        st = steps[i];
      graph.nodes.push(
        {
          id: `C${i}`,
          label: i ? '' : 'C',
          x: 14,
          y: rowY(i),
          note: i === 0 ? at[0].c : st.client.at(-1),
          state: now && st.client.length ? 'active' : undefined,
        },
        {
          id: `S${i}`,
          label: i ? '' : 'S',
          x: 86,
          y: rowY(i),
          note: i === 0 ? at[0].s : st.server.at(-1),
          state: now && st.server.length ? 'active' : undefined,
        },
      );
      if (!i) continue;
      graph.edges.push({ from: `C${i - 1}`, to: `C${i}`, state: 'muted' }, { from: `S${i - 1}`, to: `S${i}`, state: 'muted' });
      for (const seg of st.segs) {
        const to = seg.lost ? `X${i}` : `${seg.from === 'C' ? 'S' : 'C'}${i}`;
        if (seg.lost) graph.nodes.push({ id: to, label: '×', x: 60, y: rowY(i), note: t('丢失', 'lost'), state: 'blocked' });
        graph.edges.push({
          from: `${seg.from}${i - 1}`,
          to,
          label: segText(seg),
          directed: true,
          state: seg.lost ? 'blocked' : now ? 'active' : 'visited',
        });
      }
    }
    return {
      caption: t(...step.say),
      cells: [],
      graph,
      stats: [
        [t('客户端', 'Client'), at[k].c],
        [t('服务器', 'Server'), at[k].s],
        [t('本步报文', 'Segments'), step.segs.map((g) => `${g.from}→${g.from === 'C' ? 'S' : 'C'} ${segText(g)}${g.lost ? ' ×' : ''}`).join(' / ') || '—'],
      ],
      ...(k === steps.length - 1 ? { done: true } : {}),
    };
  });
  return {
    title: t('TCP 连接 · 握手与挥手', 'TCP connection · handshake and close'),
    question:
      kind === 'syn-loss'
        ? t('第一次握手的 SYN 丢了，接下来会怎样？', 'What happens when the first SYN is lost?')
        : kind === 'simul-close'
          ? t('双方同时关闭时，会经过哪些状态？', 'Which states does a simultaneous close pass through?')
          : t('三次握手和四次挥手时，seq、ack 和两端状态怎样变化？', 'How do seq, ack and both states change through the handshake and the close?'),
    invariant: t(
      'C 是客户端，S 是服务器，从上往下是时间。SYN 和 FIN 各占一个序号，所以确认它们的 ack 是对方 seq + 1；ack 总是“下一个想收到的序号”。主动关闭的一方最后进入 TIME_WAIT，等 2MSL 才关闭。',
      'C is the client, S the server, and time runs downward. SYN and FIN each use one sequence number, so the ack for one is the peer’s seq + 1; an ack always names the next sequence number expected. The side that closes first ends in TIME_WAIT and waits 2MSL before it closes.',
    ),
    frames,
  };
}

// ---------------------------------------------------------------- congestion control

export type CwndEvent = { round: number; kind: 'timeout' | 'dup3' };
export type CwndRow = { round: number; cwnd: number; ssthresh: number; event?: CwndEvent['kind'] };

/**
 * cwnd per transmission round, starting at 1. Below ssthresh it doubles but never passes it;
 * from ssthresh up it grows by 1. A loss in round r sets ssthresh = max(⌊cwnd/2⌋, 2) for round
 * r + 1, with cwnd 1 after a timeout (and after 3 duplicate ACKs in Tahoe). Reno after 3
 * duplicate ACKs sets cwnd = ssthresh: the textbook shortcut for fast recovery, which RFC 5681
 * starts at ssthresh + 3 and deflates to ssthresh once new data is acknowledged.
 */
export function cwnd(rounds: number, ssthresh: number, events: CwndEvent[], variant: 'reno' | 'tahoe' = 'reno'): CwndRow[] {
  const out: CwndRow[] = [];
  let w = 1,
    th = ssthresh;
  for (let round = 1; round <= rounds; round++) {
    const event = events.find((e) => e.round === round)?.kind;
    out.push({ round, cwnd: w, ssthresh: th, ...(event ? { event } : {}) });
    if (event) {
      th = Math.max(Math.floor(w / 2), 2);
      w = event === 'dup3' && variant === 'reno' ? th : 1;
    } else w = w < th ? Math.min(w * 2, th) : w + 1;
  }
  return out;
}
export const DEFAULT_EVENTS: CwndEvent[] = [
  { round: 9, kind: 'timeout' },
  { round: 15, kind: 'dup3' },
];

export function congestionTrace(
  variant: 'reno' | 'tahoe' = 'reno',
  ssthresh = 8,
  rounds = 20,
  events = DEFAULT_EVENTS,
  t: Tr = zhText,
): DemoTrace {
  const table = cwnd(rounds, ssthresh, events, variant);
  const width = Math.max(100, 16 + (rounds - 1) * 7),
    top = Math.max(...table.map((r) => Math.max(r.cwnd, r.ssthresh)));
  const px = (round: number) => 8 + ((round - 1) * (width - 16)) / (rounds - 1),
    py = (v: number) => 52 - (v / top) * 42;
  const Name = variant === 'reno' ? 'Reno' : 'Tahoe';
  const frames = table.map((row, k): DemoFrame => {
    const next = table[k + 1]?.cwnd ?? (row.cwnd < row.ssthresh ? Math.min(row.cwnd * 2, row.ssthresh) : row.cwnd + 1);
    const half = Math.max(Math.floor(row.cwnd / 2), 2);
    const r = row.round,
      w = row.cwnd,
      th = row.ssthresh;
    const caption =
      row.event === 'timeout'
        ? t(
            `第 ${r} 轮：发出 ${w} 个报文段后超时。ssthresh = max(⌊${w}/2⌋, 2) = ${half}，cwnd 降到 1，重新慢启动。`,
            `Round ${r}: ${w} segments out, then a timeout. ssthresh = max(⌊${w}/2⌋, 2) = ${half}; cwnd drops to 1 and slow start begins again.`,
          )
        : row.event === 'dup3' && variant === 'tahoe'
          ? t(
              `第 ${r} 轮：收到 3 个重复 ACK，快重传丢失的段。Tahoe 和超时一样：ssthresh = ${half}，cwnd 降到 1。`,
              `Round ${r}: 3 duplicate ACKs, so the lost segment is fast-retransmitted. Tahoe treats it like a timeout: ssthresh = ${half}, cwnd back to 1.`,
            )
          : row.event === 'dup3'
            ? t(
                `第 ${r} 轮：收到 3 个重复 ACK，快重传丢失的段。Reno：ssthresh = max(⌊${w}/2⌋, 2) = ${half}，下一轮 cwnd 直接取 ${half}，进入拥塞避免。这是教材的简化；RFC 5681 先把 cwnd 设为 ssthresh + 3 进入快恢复，新的 ACK 到达后再降到 ssthresh。`,
                `Round ${r}: 3 duplicate ACKs, so the lost segment is fast-retransmitted. Reno: ssthresh = max(⌊${w}/2⌋, 2) = ${half} and next round cwnd is ${half}, in congestion avoidance. That is the textbook shortcut; RFC 5681 sets cwnd to ssthresh + 3 for fast recovery and deflates it to ssthresh when new data is acknowledged.`,
              )
            : w < th
              ? t(
                  `第 ${r} 轮：cwnd = ${w} < ssthresh = ${th}，慢启动，每轮翻倍${w * 2 > th ? `，但不超过 ssthresh，下一轮取 ${th}` : `，下一轮 ${next}`}。`,
                  `Round ${r}: cwnd = ${w} < ssthresh = ${th}, slow start doubles it each round${w * 2 > th ? `, capped at ssthresh: next round ${th}` : `: next round ${next}`}.`,
                )
              : t(
                  `第 ${r} 轮：cwnd = ${w} ≥ ssthresh = ${th}，拥塞避免，每轮加 1${k + 1 < rounds ? `，下一轮 ${next}` : ''}。`,
                  `Round ${r}: cwnd = ${w} ≥ ssthresh = ${th}, congestion avoidance adds 1 per round${k + 1 < rounds ? `: next round ${next}` : ''}.`,
                );
    const shown = table.slice(0, k + 1);
    // The ssthresh step line only needs a point where it starts, bends or (now) ends.
    const bends = shown.filter((p, i) => !i || i === k || p.ssthresh !== shown[i - 1].ssthresh || p.ssthresh !== shown[i + 1].ssthresh);
    const graph: DemoGraph = {
      width,
      height: 60,
      nodes: [
        ...bends.map((p) => ({
          id: `T${p.round}`,
          label: '',
          x: px(p.round),
          y: py(p.ssthresh),
          state: 'muted' as const,
          // Named once, above its start, where cwnd is still low.
          ...(p.round === 1 ? { note: 'ssthresh', noteDy: -12.6 } : {}),
        })),
        ...shown.map((p) => ({
          id: `R${p.round}`,
          label: '',
          x: px(p.round),
          y: py(p.cwnd),
          state: p.round === r ? ('active' as const) : p.event ? ('blocked' as const) : undefined,
          ...(p.round === r || p.event ? { note: String(p.cwnd) } : {}),
        })),
      ],
      edges: [
        ...bends.slice(1).map((p, i) => ({ from: `T${bends[i].round}`, to: `T${p.round}`, state: 'muted' as const })),
        ...shown.slice(1).map((p) => ({ from: `R${p.round - 1}`, to: `R${p.round}`, state: 'visited' as const })),
      ],
    };
    return {
      caption,
      graph,
      cells: shown.map((p) => ({
        value: p.cwnd,
        label: `#${p.round}`,
        state: p.round === r ? 'active' : p.event ? 'blocked' : p.cwnd < p.ssthresh ? 'visited' : undefined,
      })),
      stats: [
        ['cwnd', String(w)],
        ['ssthresh', String(th)],
        [t('阶段', 'Phase'), w < th ? t('慢启动', 'slow start') : t('拥塞避免', 'congestion avoidance')],
        [t('轮次', 'Round'), `${r} / ${rounds}`],
      ],
      ...(k === rounds - 1 ? { done: true } : {}),
    };
  });
  return {
    title: t(`拥塞控制 · ${Name} 的 cwnd 曲线`, `Congestion control · ${Name}'s cwnd`),
    question: t(
      `初始 ssthresh = ${ssthresh}，每轮的 cwnd 是多少？`,
      `Starting from ssthresh = ${ssthresh}, what is cwnd in each round?`,
    ),
    invariant: t(
      'cwnd 从 1 开始；小于 ssthresh 时慢启动，每轮翻倍但不超过 ssthresh；达到 ssthresh 后拥塞避免，每轮加 1。超时：ssthresh = max(⌊cwnd/2⌋, 2)，cwnd = 1。3 个重复 ACK：Tahoe 同超时；Reno 按教材简化取 cwnd = 新 ssthresh（RFC 5681 是 ssthresh + 3 进入快恢复）。虚线是 ssthresh，红点是出事件的那一轮。',
      'cwnd starts at 1. Below ssthresh, slow start doubles it each round without passing ssthresh; from there congestion avoidance adds 1 a round. Timeout: ssthresh = max(⌊cwnd/2⌋, 2), cwnd = 1. Three duplicate ACKs: Tahoe acts as on a timeout; Reno takes cwnd = the new ssthresh, the textbook shortcut (RFC 5681 enters fast recovery at ssthresh + 3). The dashed line is ssthresh; red dots mark the rounds with an event.',
    ),
    frames,
  };
}

// ---------------------------------------------------------------- sliding window

export type ArqProto = 'gbn' | 'sr';
export type ArqSend = { k: number; lost: boolean; again: boolean };
/** One round trip: what was sent (retransmissions first), the ACKs that came back, and the state after them. */
export type ArqRound = {
  timeout: boolean;
  sent: ArqSend[];
  discarded: number[];
  acks: number[];
  base: number;
  next: number;
  expected: number;
  buffered: number[];
  acked: number[];
};
const ARQ_NAMES: Record<ArqProto, Pair> = {
  gbn: ['回退 N 步 GBN', 'Go-Back-N'],
  sr: ['选择重传 SR', 'Selective Repeat'],
};

/**
 * Packets 0..n−1, one round trip per round. Packet `lose` is lost on its first send only. An
 * unacknowledged packet times out the round after it was sent: GBN then resends everything
 * from base, SR only the packets that timed out. Sequence numbers never wrap.
 */
export function slide(n: number, win: number, lose: number | null = null, proto: ArqProto = 'gbn') {
  const sentAt: number[] = [],
    acked = new Set<number>(),
    buffer = new Set<number>(),
    out: ArqRound[] = [];
  let base = 0,
    next = 0,
    expected = 0,
    lostOnce = false;
  for (let r = 0; base < n; r++) {
    const late = range(base, next).filter((k) => !acked.has(k) && sentAt[k] <= r - 2);
    const again = !late.length ? [] : proto === 'gbn' ? range(base, next) : late;
    const fresh = range(next, Math.min(n, base + win));
    next = Math.max(next, Math.min(n, base + win));
    const sent = [...again, ...fresh].map((k): ArqSend => {
      const lost = k === lose && !lostOnce;
      if (lost) lostOnce = true;
      sentAt[k] = r;
      return { k, lost, again: again.includes(k) };
    });
    const acks: number[] = [],
      discarded: number[] = [];
    for (const { k, lost } of sent) {
      if (lost) continue;
      if (proto === 'gbn') {
        if (k === expected) expected++;
        else discarded.push(k);
        if (expected) acks.push(expected - 1);
      } else {
        if (k >= expected) buffer.add(k);
        acks.push(k);
        while (buffer.delete(expected)) expected++;
      }
    }
    for (const a of acks)
      if (proto === 'gbn') base = Math.max(base, a + 1);
      else {
        acked.add(a);
        while (acked.has(base)) base++;
      }
    out.push({
      timeout: late.length > 0,
      sent,
      discarded,
      acks,
      base,
      next,
      expected,
      buffered: [...buffer].sort((a, b) => a - b),
      acked: [...acked].filter((k) => k >= base).sort((a, b) => a - b),
    });
  }
  return out;
}

export function arqTrace(proto: ArqProto = 'gbn', n = 10, win = 4, lose: number | null = 3, t: Tr = zhText): DemoTrace {
  const rounds = slide(n, win, lose, proto);
  const name = t(...ARQ_NAMES[proto]);
  const join = (ks: number[]) => ks.join(t('、', ', '));
  const frames: DemoFrame[] = [];
  // What the cells show: the sender's view after the last step.
  let base = 0,
    next = 0,
    expected = 0,
    buffered: number[] = [],
    acked: number[] = [],
    sends = 0,
    resends = 0;
  const lost = new Set<number>();
  const frame = (caption: string, queue: string[], flight: ArqSend[] = [], done = false) => {
    const now = new Map(flight.map((s) => [s.k, s]));
    frames.push({
      caption,
      cells: range(0, n).map((k): DemoCell => {
        const s = now.get(k);
        const [label, state]: [string, DemoCell['state']] =
          k < base || acked.includes(k)
            ? [t('已确认', 'acked'), 'visited']
            : k >= base + win
              ? [t('不能发', 'not yet'), 'muted']
              : lost.has(k)
                ? [t('丢失', 'lost'), 'blocked']
                : s
                  ? [s.again ? t('重传', 'resent') : t('发出', 'sent'), 'active']
                  : [k < next ? t('等确认', 'waiting') : t('可发送', 'usable'), 'active'];
        return { value: k, label, state };
      }),
      queue,
      stats: [
        ['base', String(base)],
        ['next', String(next)],
        [t('接收方期望', 'Receiver expects'), String(expected)],
        ...(proto === 'sr' ? [[t('接收方缓存', 'Receiver buffer'), buffered.join(' ') || '—'] as [string, string]] : []),
        [t('发送 / 其中重传', 'Sends / resends'), `${sends} / ${resends}`],
      ],
      ...(done ? { done: true } : {}),
    });
  };
  frame(
    t(
      `${name}：${n} 个分组，窗口大小 ${win}${lose === null ? '' : `，分组 ${lose} 第一次发送时会丢失`}。蓝色是发送窗口 [base, base + ${win})，窗口里的分组不用等确认就能发。`,
      `${name}: ${n} packets, window ${win}${lose === null ? '' : `; packet ${lose} is lost the first time it is sent`}. Blue is the send window [base, base + ${win}): packets in it go out without waiting for ACKs.`,
    ),
    [],
  );
  rounds.forEach((round, i) => {
    const again = round.sent.filter((s) => s.again).map((s) => s.k),
      fresh = round.sent.filter((s) => !s.again).map((s) => s.k),
      gone = round.sent.filter((s) => s.lost).map((s) => s.k);
    next = round.next;
    sends += round.sent.length;
    resends += again.length;
    for (const k of again) lost.delete(k);
    for (const k of gone) lost.add(k);
    const what = [
      round.timeout
        ? proto === 'gbn'
          ? t(`分组 ${base} 超时，回退 N 步，从 base 起重传 ${join(again)}`, `packet ${base} times out, so go back N and resend ${join(again)} from base`)
          : t(`分组 ${join(again)} 超时，只重传它`, `packet ${join(again)} times out, and only it is resent`)
        : '',
      fresh.length ? t(`发送新分组 ${join(fresh)}`, `send new packets ${join(fresh)}`) : t('窗口里没有新分组可发', 'no new packet fits in the window'),
    ].filter(Boolean);
    frame(
      t(
        `第 ${i + 1} 轮：${what.join('；')}${gone.length ? `。${join(gone)} 在路上丢失` : ''}。`,
        `Round ${i + 1}: ${what.join('; ')}${gone.length ? `. ${join(gone)} is lost on the way` : ''}.`,
      ),
      round.sent.map((s) => `${s.k}${s.lost ? '×' : ''}`),
      round.sent,
    );
    ({ base, expected, buffered, acked } = round);
    const unique = [...new Set(round.acks)];
    const got =
      proto === 'gbn'
        ? t(
            `${round.discarded.length ? `接收方丢弃失序的 ${join(round.discarded)}` : '接收方按序收下'}，${round.acks.length ? `回 ACK ${join(unique)}${unique.length < round.acks.length ? '（有重复 ACK）' : ''}` : '没有能确认的分组'}`,
            `${round.discarded.length ? `The receiver discards out-of-order ${join(round.discarded)}` : 'The receiver takes them in order'} and ${round.acks.length ? `sends ACK ${join(unique)}${unique.length < round.acks.length ? ' (with duplicates)' : ''}` : 'has nothing to acknowledge'}`,
          )
        : t(
            `接收方逐个确认 ${join(round.acks)}${buffered.length ? `，失序的 ${join(buffered)} 先缓存` : ''}${expected ? `，按序交付到 ${expected - 1}` : ''}`,
            `The receiver acknowledges ${join(round.acks)} one by one${buffered.length ? `, buffers out-of-order ${join(buffered)}` : ''}${expected ? ` and delivers in order up to ${expected - 1}` : ''}`,
          );
    const finished = base >= n;
    frame(
      t(
        `${got}。base 移到 ${base}${finished ? '，全部确认完毕' : `，窗口变为 ${base}–${Math.min(base + win, n) - 1}`}。`,
        `${got}. base moves to ${base}${finished ? ': everything is acknowledged' : `; the window is now ${base}–${Math.min(base + win, n) - 1}`}.`,
      ),
      round.acks.map((a) => `ACK ${a}`),
      [],
      finished,
    );
  });
  return {
    title: t('滑动窗口 · GBN 与 SR', 'Sliding window · Go-Back-N and Selective Repeat'),
    question: t(
      `${name}，窗口 ${win}：发完 ${n} 个分组一共要发送几次？`,
      `${name} with window ${win}: how many transmissions does it take to deliver ${n} packets?`,
    ),
    invariant: t(
      '发送方只能发 [base, base + 窗口) 里的分组。GBN 接收方只收按序到达的分组，用累计 ACK 确认最后一个按序分组，超时后发送方从 base 起全部重传；SR 接收方缓存失序分组并逐个确认，只重传超时的分组。这里一轮是一个往返，没确认的分组在下一轮结束时超时；序号不回绕（真实的 SR 要求窗口不超过序号空间的一半）。',
      'The sender may only send packets in [base, base + window). A GBN receiver accepts only in-order packets and acknowledges the last of them cumulatively; on a timeout the sender resends everything from base. An SR receiver buffers out-of-order packets and acknowledges each one; only the timed-out packet is resent. One round is one round trip, and an unacknowledged packet times out at the end of the next round; sequence numbers never wrap (real SR needs a window of at most half the sequence space).',
    ),
    queueLabel: t('这一步的分组（× 丢失）或 ACK', 'This step’s packets (× lost) or ACKs'),
    frames,
  };
}

// ---------------------------------------------------------------- inputs and dispatch

const nonNegative = (values: number[]) => {
  if (values.some((v) => v < 0)) fail('这里的数都不能是负数', 'These numbers cannot be negative');
  return values;
};
const word = <T extends string>(text: string, allowed: readonly T[], what: Pair): T => {
  const w = text.trim().toLowerCase() as T;
  if (!allowed.includes(w)) fail(`${what[0]}只能是 ${allowed.join('、')} 之一`, `${what[1]} must be one of ${allowed.join(', ')}`);
  return w;
};
const between = (value: number, lo: number, hi: number, what: Pair) => {
  if (value < lo || value > hi) fail(`${what[0]}要在 ${lo} 到 ${hi} 之间`, `${what[1]} must be between ${lo} and ${hi}`);
  return value;
};

/** "Try your own input" for each simulator; each parse returns its trace function's leading arguments. */
export const simInputs: Record<SimKind, DemoInput> = {
  'cpu-scheduling': input(
    ['算法 [时间片]; 进程 到达 运行 [优先级]，用逗号隔开', 'Algorithm [quantum]; process arrival burst [priority], comma-separated'],
    'rr 2; A 0 5 3, B 1 3 1, C 2 1 4, D 3 2 2',
    (text) => {
      const [head, list] = parts(text, 2);
      const [first = '', quantum, ...extra] = tokens(head);
      const algo = word(first, SCHED_ALGOS, ['算法', 'The algorithm']);
      if (extra.length || (quantum !== undefined && algo !== 'rr')) fail('只有 rr 后面要写时间片，例如 rr 2', 'Only rr takes a number: its quantum, as in rr 2');
      if (algo === 'rr' && quantum === undefined) fail('rr 后面要写时间片，例如 rr 2', 'Give rr a quantum, as in rr 2');
      const q = algo === 'rr' ? between(one(quantum!), 1, 10, ['时间片', 'The quantum']) : 2;
      const lines = rows(list);
      if (!lines.length || lines.length > 6) fail('写 1 到 6 个进程，用逗号隔开', 'List 1 to 6 processes, separated by commas');
      const procs = lines.map((line): Proc => {
        const [id, ...rest] = tokens(line);
        if (!/^[A-Za-z][A-Za-z0-9]{0,2}$/.test(id))
          fail(`「${id}」：进程名是 1 到 3 个字母或数字，以字母开头`, `"${id}": a process name is 1 to 3 letters or digits, starting with a letter`);
        if (rest.length < 2 || rest.length > 3) fail(`进程 ${id} 要写：到达时间 运行时间 [优先级]`, `Process ${id} needs: arrival burst [priority]`);
        const [arrive, burst, prio = 0] = numbers(rest.join(' '), 3);
        return {
          id,
          arrive: between(arrive, 0, 30, ['到达时间', 'Arrival times']),
          burst: between(burst, 1, 20, ['运行时间', 'Bursts']),
          prio: between(prio, 0, 9, ['优先级', 'Priorities']),
        };
      });
      if (new Set(procs.map((p) => p.id)).size < procs.length) fail('进程名不能重复', 'Process names must be unique');
      if (procs.reduce((sum, p) => sum + p.burst, 0) > 40) fail('运行时间加起来最多 40', 'The bursts can add up to at most 40');
      return [procs, algo, q];
    },
  ),
  // ponytail: pages 0–9, one digit each, so a 15-column table still fits a phone.
  'page-replacement': input(
    ['算法 页框数; 访问序列（页号 0–9，最多 15 个）', 'Algorithm frames; reference string (pages 0–9, up to 15)'],
    'fifo 3; 1 2 3 4 1 2 5 1 2 3 4 5',
    (text) => {
      const [head, list] = parts(text, 2);
      const [first = '', size, ...extra] = tokens(head);
      const algo = word(first, REPL_ALGOS, ['算法', 'The algorithm']);
      if (size === undefined || extra.length) fail('算法后面写页框数，例如 fifo 3', 'Follow the algorithm with a frame count, as in fifo 3');
      const frames = between(one(size), 1, 6, ['页框数', 'The frame count']);
      const refs = numbers(list, 15, 9);
      if (refs.some((p) => p < 0)) fail('页号要在 0 到 9 之间', 'Page numbers are 0 to 9');
      return [refs, frames, algo];
    },
  ),
  bankers: input(
    [
      'Available; 每个进程写成 Allocation/Max，用逗号隔开; 可选的请求，如 P1 1 0 2',
      'Available; each process as Allocation/Max, comma-separated; optional request such as P1 1 0 2',
    ],
    '3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2, 3 0 2/9 0 2, 2 1 1/2 2 2, 0 0 2/4 3 3; P1 1 0 2',
    (text) => {
      const [first, list, request = ''] = parts(text, 3, 1);
      const avail = nonNegative(numbers(first, 3, 20));
      const m = avail.length;
      const lines = rows(list);
      if (!lines.length || lines.length > 5) fail('写 1 到 5 个进程，用逗号隔开', 'List 1 to 5 processes, separated by commas');
      const alloc: number[][] = [],
        max: number[][] = [];
      lines.forEach((line, i) => {
        const halves = line.split('/');
        if (halves.length !== 2) fail(`P${i} 写成 Allocation/Max，例如 0 1 0/7 5 3`, `Write P${i} as Allocation/Max, as in 0 1 0/7 5 3`);
        const [a, b] = halves.map((h) => nonNegative(numbers(h, 3, 20)));
        if (a.length !== m || b.length !== m) fail(`P${i} 的两组各要 ${m} 个数，和 Available 一样多`, `Both halves of P${i} need ${m} numbers, as many as Available`);
        if (a.some((v, r) => v > b[r])) fail(`P${i} 的 Allocation 不能超过 Max`, `P${i}'s Allocation cannot exceed its Max`);
        alloc.push(a);
        max.push(b);
      });
      if (!request.trim()) return [avail, alloc, max, null];
      const [who = '', ...amounts] = tokens(request);
      const p = /^p(\d)$/i.exec(who);
      if (!p || Number(p[1]) >= lines.length)
        fail(`请求写成 P1 1 0 2，进程在 P0 到 P${lines.length - 1} 之间`, `Write the request as P1 1 0 2, with a process from P0 to P${lines.length - 1}`);
      const v = nonNegative(numbers(amounts.join(' '), 3, 20));
      if (v.length !== m) fail(`请求要有 ${m} 个数`, `The request needs ${m} numbers`);
      return [avail, alloc, max, { p: Number(p![1]), vec: v }];
    },
  ),
  'tcp-handshake': input(
    ['场景（normal、syn-loss、simul-close）; 客户端和服务器的初始序号', 'Scenario (normal, syn-loss, simul-close); client and server initial sequence numbers'],
    'normal; 100 300',
    (text) => {
      const [scenario, isn] = parts(text, 2);
      const kind = word(scenario, TCP_SCENARIOS, ['场景', 'The scenario']);
      const v = numbers(isn, 2, 99999);
      if (v.length !== 2 || v.some((x) => x < 0)) fail('写两个 0 到 99999 之间的初始序号', 'Give two initial sequence numbers from 0 to 99999');
      return [kind, v[0], v[1]];
    },
  ),
  'tcp-congestion': input(
    ['reno 或 tahoe; 初始 ssthresh; 轮数; 事件，如 timeout 9, dup 15', 'reno or tahoe; initial ssthresh; rounds; events such as timeout 9, dup 15'],
    'reno; 8; 20; timeout 9, dup 15',
    (text) => {
      const [v, th, n, list = ''] = parts(text, 4, 1);
      const variant = word(v, ['reno', 'tahoe'] as const, ['第一段', 'The first part']);
      const ssthresh = between(one(th), 2, 64, ['ssthresh', 'ssthresh']);
      const rounds = between(one(n), 3, 30, ['轮数', 'The number of rounds']);
      const events = rows(list).map((e): CwndEvent => {
        const [kind, at, ...extra] = tokens(e.toLowerCase());
        if ((kind !== 'timeout' && kind !== 'dup') || at === undefined || extra.length)
          fail(`「${e}」：事件写成 timeout 9 或 dup 15`, `"${e}": write an event as timeout 9 or dup 15`);
        return { round: between(one(at), 1, rounds, ['事件的轮次', 'An event round']), kind: kind === 'dup' ? 'dup3' : 'timeout' };
      });
      if (events.length > 8) fail('最多 8 个事件', 'At most 8 events');
      if (new Set(events.map((e) => e.round)).size < events.length) fail('同一轮只能有一个事件', 'One event per round');
      return [variant, ssthresh, rounds, events];
    },
  ),
  'sliding-window-arq': input(
    ['gbn 或 sr; 分组数; 窗口大小; 第一次发送时丢失的分组（可不填）', 'gbn or sr; packets; window size; packet lost on its first send (optional)'],
    'gbn; 10; 4; 3',
    (text) => {
      const [p, count, w, l = ''] = parts(text, 4, 1);
      const proto = word(p, ['gbn', 'sr'] as const, ['第一段', 'The first part']);
      const n = between(one(count), 1, 16, ['分组数', 'The packet count']);
      const win = between(one(w), 1, 8, ['窗口大小', 'The window']);
      const lose = l.trim() ? between(one(l), 0, n - 1, ['丢失的分组', 'The lost packet']) : null;
      return [proto, n, win, lose];
    },
  ),
};

export function createSimTrace(kind: SimKind, english = false, input?: readonly unknown[]): DemoTrace {
  const t = english ? enText : zhText;
  // ponytail: positional args from simInputs[kind].parse, unchecked here (tests parse each
  // placeholder); a missing one is undefined, which picks the trace function's default.
  const [a, b, c, d] = (input ?? []) as [never?, never?, never?, never?];
  switch (kind) {
    case 'cpu-scheduling':
      return schedulingTrace(a, b, c, t);
    case 'page-replacement':
      return pageTrace(a, b, c, t);
    case 'bankers':
      return bankersTrace(a, b, c, d, t);
    case 'tcp-handshake':
      return tcpTrace(a, b, c, t);
    case 'tcp-congestion':
      return congestionTrace(a, b, c, d, t);
    case 'sliding-window-arq':
      return arqTrace(a, b, c, d, t);
  }
}
