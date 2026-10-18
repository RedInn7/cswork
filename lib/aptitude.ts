import { mcqRight, reviewMcq, seededRandom, type McqQuestion, type McqReview } from './mock-oa';

/**
 * Aptitude practice (/oa/aptitude): numerical, data, logical and abstract reasoning questions
 * generated from a seed, so `apt-<kind>-<seed>` is the whole question. Every generator fixes the
 * answer first and works the numbers back from it, so answers are whole or one decimal; logic
 * answers are checked by enumeration (Venn models, all 120 seatings). Shared by the page, the
 * review session (through /api/oj/mcq/questions) and the tests.
 */

export type AptShape = 'tri' | 'arrow' | 'flag' | 'ell' | 'eff';
/** n copies of a shape; fill 0 outlined, 1 grey, 2 solid; rot clockwise degrees, after a left-right flip. */
export type AptCell = { shape: AptShape; n: number; fill: number; rot: number; flip?: boolean };
export type AptFig =
  | { kind: 'matrix'; cells: (AptCell | null)[]; choices: AptCell[] }
  | { kind: 'transform'; from: AptCell; axis?: 'v' | 'h'; choices: AptCell[] }
  | { kind: 'bars'; labels: string[]; series: number[]; unit: string };
export type AptQuestion = McqQuestion & { fig?: AptFig };

export const APT_GROUPS = [
  { topic: 'apt-num', name: ['数量计算', 'Numerical'], kinds: ['percent', 'profit', 'ratio', 'work', 'speed', 'interest'] },
  { topic: 'apt-data', name: ['图表读数', 'Data interpretation'], kinds: ['chart'] },
  { topic: 'apt-logic', name: ['逻辑推理', 'Logical reasoning'], kinds: ['series', 'coding', 'syllogism', 'seating', 'direction'] },
  { topic: 'apt-fig', name: ['图形推理', 'Abstract reasoning'], kinds: ['matrix', 'rotate', 'mirror'] },
] as const;
export type AptKind = (typeof APT_GROUPS)[number]['kinds'][number];
export const APT_KINDS = APT_GROUPS.flatMap((g) => g.kinds) as AptKind[];
export const APT_KIND_NAMES: Record<AptKind, [string, string]> = {
  percent: ['百分比', 'Percentages'],
  profit: ['利润与折扣', 'Profit & discount'],
  ratio: ['比例与混合', 'Ratio & mixtures'],
  work: ['工作效率', 'Work & pipes'],
  speed: ['速度与距离', 'Speed & distance'],
  interest: ['单利与复利', 'Interest'],
  chart: ['柱状图', 'Bar charts'],
  series: ['数列', 'Number series'],
  coding: ['字母编码', 'Letter codes'],
  syllogism: ['三段论', 'Syllogisms'],
  seating: ['排座', 'Seating'],
  direction: ['方向与距离', 'Directions'],
  matrix: ['图形矩阵', 'Figure matrix'],
  rotate: ['图形旋转', 'Rotation'],
  mirror: ['镜像', 'Mirror images'],
};

type R = () => number;
type Tx = [zh: string, en: string];
type Choice = { t: Tx; cell?: AptCell };
type DraftFig =
  | { kind: 'matrix'; cells: (AptCell | null)[] }
  | { kind: 'transform'; from: AptCell; axis?: 'v' | 'h' }
  | { kind: 'bars'; labels: string[]; series: number[]; unit: string };
/** A generator's output: the right choice first, then wrong ones in order of preference. */
type Draft = { q: Tx; right: Choice; wrong: Choice[]; explain: Tx; fig?: DraftFig };

const int = (r: R, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: R, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
function shuffle<T>(r: R, xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}
const range = (n: number) => [...Array(n).keys()];
const dp1 = (x: number) => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9;
/** A number as shown: whole, or one decimal. */
const f = (x: number) => {
  const v = Math.round(x * 10) / 10 || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
/** A wrong value at the right answer's precision, so its shape gives nothing away. */
const like = (x: number, answer: number) => (Number.isInteger(answer) ? Math.round(x) : Math.round(x * 10) / 10);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const ratio = (a: number, b: number) => `${a / gcd(a, b)} : ${b / gcd(a, b)}`;
/** 1 + x% as a multiplier: 1.25, 0.9. */
const mul = (x: number) => String(+((100 + x) / 100).toFixed(4));
const tx = (zh: string, en: string): Choice => ({ t: [zh, en] });
const same = (s: string) => tx(s, s);
/** Numbers in one unit: `unit(zhFormat, enFormat)(x)`. */
const unit = (zh: (s: string) => string, en: (s: string) => string) => (x: number) => tx(zh(f(x)), en(f(x)));
const pct = unit((s) => `${s}%`, (s) => `${s}%`);
const money = unit((s) => `${s} 元`, (s) => `$${s}`);
const change = (x: number) =>
  x > 0 ? tx(`增加 ${f(x)}%`, `${f(x)}% increase`) : x < 0 ? tx(`减少 ${f(-x)}%`, `${f(-x)}% decrease`) : tx('不变', 'No change');
const profitLoss = (x: number) =>
  x > 0 ? tx(`盈利 ${f(x)}%`, `${f(x)}% profit`) : x < 0 ? tx(`亏损 ${f(-x)}%`, `${f(-x)}% loss`) : tx('不盈不亏', 'No profit, no loss');

// ---------------------------------------------------------------- numerical

const STEPS = [10, 20, 25, 30, 40, 50];
const SUCCESSIVE = STEPS.flatMap((a) => STEPS.flatMap((b) => [[a, -b], [-a, b], [a, b]])).filter(([a, b]) =>
  dp1(((100 + a) * (100 + b)) / 100),
);
/** [x, y]: x% more one way is y% less the other way (y = 100x / (100 + x)). */
const BASES = [[25, 20], [60, 37.5], [100, 50], [150, 60], [300, 75], [400, 80]];

function percent(r: R): Draft {
  if (r() < 0.5) {
    const [a, b] = pick(r, SUCCESSIVE);
    const net = ((100 + a) * (100 + b)) / 100 - 100;
    const zhStep = (x: number) => (x > 0 ? `涨价 ${x}%` : `降价 ${-x}%`);
    const enStep = (x: number) => (x > 0 ? `raised by ${x}%` : `cut by ${-x}%`);
    return {
      q: [
        `某商品先${zhStep(a)}，再${zhStep(b)}。和最初相比，价格总体变化多少？`,
        `A price is first ${enStep(a)} and then ${enStep(b)}. What is the overall change from the original price?`,
      ],
      right: change(net),
      wrong: [a + b, -net, net + (net >= 0 ? 5 : -5), a - b, net - 10].map(change),
      explain: [
        `连续变化要相乘：${mul(a)} × ${mul(b)} = ${mul(net)}，即${change(net).t[0]}。也可以用 a + b + ab/100 = ${a} + (${b}) + (${f((a * b) / 100)}) = ${f(net)}。直接相加（${a + b}%）是常见错误：第二次变化的基数已经变了。`,
        `Successive changes multiply: ${mul(a)} × ${mul(b)} = ${mul(net)}, a ${change(net).t[1].toLowerCase()}. The shortcut a + b + ab/100 gives ${a} + (${b}) + (${f((a * b) / 100)}) = ${f(net)}. Simply adding them (${a + b}%) is the usual mistake: the second change applies to a new base.`,
      ],
    };
  }
  const [x, y] = pick(r, BASES);
  const up = r() < 0.5;
  const story = int(r, 0, 2);
  const [given, answer] = up ? [x, y] : [y, x];
  const q: Tx = [
    [
      up ? `甲的月薪比乙高 ${x}%。乙的月薪比甲低百分之几？` : `乙的月薪比甲低 ${y}%。甲的月薪比乙高百分之几？`,
      up ? `大米涨价 ${x}%。要使买米的开支不变，用量要减少百分之几？` : `大米降价 ${y}%。开支不变的话，用量可以增加百分之几？`,
      up ? `汽车速度提高 ${x}%。同样的路程，用时减少百分之几？` : `汽车速度降低 ${y}%。同样的路程，用时增加百分之几？`,
    ][story],
    [
      up ? `A earns ${x}% more than B. By what percent does B earn less than A?` : `B earns ${y}% less than A. By what percent does A earn more than B?`,
      up
        ? `The price of rice goes up by ${x}%. By what percent must a family cut the amount it buys to keep its spending the same?`
        : `The price of rice falls by ${y}%. Keeping spending the same, by what percent more rice can a family buy?`,
      up
        ? `A car's speed goes up by ${x}%. By what percent does the time for the same distance fall?`
        : `A car's speed falls by ${y}%. By what percent does the time for the same distance rise?`,
    ][story],
  ];
  const formula = up ? `${x} ÷ (100 + ${x}) × 100 = ${f(y)}` : `${y} ÷ (100 − ${y}) × 100 = ${f(x)}`;
  return {
    q,
    right: pct(answer),
    wrong: [given, up ? x - y : 100 - y, answer + 5, answer - 5, 100 - answer].filter((v) => v > 0).map(pct),
    explain: [
      `比较的基准换了，不能直接用 ${f(given)}%：${formula}%。`,
      `The base changes, so it is not ${f(given)}%: ${formula}%.`,
    ],
  };
}

const MARKUPS = [20, 25, 30, 40, 50, 60, 80, 100].flatMap((m) =>
  [10, 15, 20, 25, 30, 40, 50].map((d) => [m, d]).filter(([, d]) => ((100 + m) * (100 - d)) % 10 === 0),
);
/** [x, y]: the cost of y items equals the selling price of x. */
const SELL_FOR = range(21)
  .flatMap((i) => range(16).map((j) => [i + 5, i + j])) // y from x − 5 to x + 10
  .filter(([x, y]) => y !== x && y > 0 && dp1(((y - x) / x) * 100) && Math.abs(((y - x) / x) * 100) <= 50);

function profit(r: R): Draft {
  const type = int(r, 0, 2);
  if (type === 0) {
    const [m, d] = pick(r, MARKUPS);
    const net = ((100 + m) * (100 - d)) / 100 - 100;
    return {
      q: [
        `商家把商品按成本价提高 ${m}% 标价，再按标价优惠 ${d}% 卖出。盈亏多少？`,
        `A shop marks an item ${m}% above cost, then sells it at ${d}% off the marked price. What is the profit or loss?`,
      ],
      right: profitLoss(net),
      wrong: [m - d, -net, (m * (100 - d)) / 100, net + 5, net - 5].map((v) => profitLoss(like(v, net))),
      explain: [
        `售价 = 成本 × ${mul(m)} × ${mul(-d)} = 成本 × ${mul(net)}，所以${profitLoss(net).t[0]}。不能用 ${m}% − ${d}%：折扣是按标价算的，不是按成本。`,
        `Selling price = cost × ${mul(m)} × ${mul(-d)} = cost × ${mul(net)}: a ${profitLoss(net).t[1].toLowerCase()}. ${m}% − ${d}% is wrong because the discount comes off the marked price, not the cost.`,
      ],
    };
  }
  if (type === 1) {
    const cost = 20 * int(r, 5, 50);
    const p = pick(r, [10, 20, 25, 40, 50, -10, -20, -25]);
    const sell = (cost * (100 + p)) / 100;
    return {
      q: [
        `某商品以 ${sell} 元卖出，${p > 0 ? `赚了成本的 ${p}%` : `亏了成本的 ${-p}%`}。成本是多少？`,
        `An item sells for $${sell}, a ${Math.abs(p)}% ${p > 0 ? 'profit' : 'loss'} on its cost. What did it cost?`,
      ],
      right: money(cost),
      wrong: [(sell * (100 - p)) / 100, sell - p, cost + 20, cost - 20, (sell * 100) / (100 - p)].map((v) => money(like(v, cost))),
      explain: [
        `成本 = 售价 ÷ ${mul(p)} = ${sell} ÷ ${mul(p)} = ${cost} 元。用售价乘 ${mul(-p)} 是常见错误：百分比的基准是成本。`,
        `Cost = selling price ÷ ${mul(p)} = ${sell} ÷ ${mul(p)} = $${cost}. Multiplying the selling price by ${mul(-p)} is the usual mistake: the percent is of the cost.`,
      ],
    };
  }
  const [x, y] = pick(r, SELL_FOR);
  const net = ((y - x) / x) * 100;
  return {
    q: [
      `${y} 支笔的成本价等于 ${x} 支笔的售价。盈亏百分之几？`,
      `The cost price of ${y} pens equals the selling price of ${x} pens. What is the profit or loss percent?`,
    ],
    right: profitLoss(net),
    wrong: [((y - x) / y) * 100, -net, net + 5, net - 5, y - x].map((v) => profitLoss(like(v, net))),
    explain: [
      `设每支成本 1，${x} 支卖 ${y}。盈亏 = (${y} − ${x}) ÷ ${x} × 100 = ${f(net)}%：基准是成本，所以除以 ${x}，不是 ${y}。`,
      `Say each pen costs 1, so ${x} pens sell for ${y}. Profit = (${y} − ${x}) ÷ ${x} × 100 = ${f(net)}%: the base is the cost, so divide by ${x}, not ${y}.`,
    ],
  };
}

const AGES = [[1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [2, 5], [5, 6], [4, 7], [5, 7], [5, 8]];

function ratioQ(r: R): Draft | null {
  const type = int(r, 0, 2);
  if (type === 0) {
    const parts = shuffle(r, [1, 2, 3, 4, 5, 6, 7]).slice(0, 3);
    const k = 5 * int(r, 2, 40);
    const total = k * (parts[0] + parts[1] + parts[2]);
    const j = int(r, 0, 2);
    const who: Tx = [['甲', '乙', '丙'][j], ['A', 'B', 'C'][j]];
    const sum = parts[0] + parts[1] + parts[2];
    return {
      q: [
        `把 ${total} 元按 ${parts.join(' : ')} 分给甲、乙、丙。${who[0]}分到多少？`,
        `$${total} is shared among A, B and C in the ratio ${parts.join(' : ')}. How much does ${who[1]} get?`,
      ],
      right: money(k * parts[j]),
      wrong: [k * parts[(j + 1) % 3], k * parts[(j + 2) % 3], total / 3, k * (parts[j] + 1), total - k * parts[j]].map((v) =>
        money(Math.round(v)),
      ),
      explain: [
        `每份 = ${total} ÷ (${parts.join(' + ')}) = ${total} ÷ ${sum} = ${k}，${who[0]}占 ${parts[j]} 份：${k} × ${parts[j]} = ${k * parts[j]} 元。`,
        `One part = ${total} ÷ (${parts.join(' + ')}) = ${total} ÷ ${sum} = ${k}; ${who[1]} gets ${parts[j]} parts: ${k} × ${parts[j]} = $${k * parts[j]}.`,
      ],
    };
  }
  if (type === 1) {
    const lo = 5 * int(r, 2, 8);
    const hi = lo + 5 * int(r, 2, 8);
    const means = shuffle(r, range(hi - lo - 1).map((i) => lo + 1 + i)).filter((m) => {
      const g = gcd(hi - m, m - lo);
      return (hi - m) / g <= 9 && (m - lo) / g <= 9 && hi - m !== m - lo;
    });
    if (!means.length) return null;
    const m = means[0];
    const right = ratio(hi - m, m - lo);
    const [a, b] = right.split(' : ').map(Number);
    return {
      q: [
        `每千克 ${lo} 元的大米和每千克 ${hi} 元的大米混合，混合后每千克 ${m} 元。便宜的和贵的按什么比例混合？`,
        `Rice at $${lo}/kg is mixed with rice at $${hi}/kg to make a mixture worth $${m}/kg. In what ratio are they mixed (cheaper : dearer)?`,
      ],
      right: same(right),
      wrong: [`${b} : ${a}`, ratio(hi - lo, m - lo), ratio(a + 1, b), ratio(a, b + 1), ratio(m, hi)].map(same),
      explain: [
        `十字交叉法：便宜的 : 贵的 = (${hi} − ${m}) : (${m} − ${lo}) = ${hi - m} : ${m - lo} = ${right}。离均价越近的那种用得越多。`,
        `Alligation: cheaper : dearer = (${hi} − ${m}) : (${m} − ${lo}) = ${hi - m} : ${m - lo} = ${right}. The kind closer to the mean price is used more.`,
      ],
    };
  }
  const [p, q] = pick(r, AGES);
  const k = int(r, 2, Math.min(9, Math.floor(80 / q)));
  const t = int(r, 2, 12);
  const [s1, s2] = ratio(p * k + t, q * k + t).split(' : ').map(Number);
  const age = unit((s) => `${s} 岁`, (s) => s);
  return {
    q: [
      `甲、乙现在的年龄比是 ${p} : ${q}，${t} 年后是 ${s1} : ${s2}。甲现在几岁？`,
      `A's and B's ages are in the ratio ${p} : ${q}. In ${t} years the ratio will be ${s1} : ${s2}. How old is A now?`,
    ],
    right: age(p * k),
    wrong: [p * k + t, q * k, p * k - t, p * (k + 1), q * k + t].filter((v) => v > 0).map(age),
    explain: [
      `设现在是 ${p}k 和 ${q}k 岁。(${p}k + ${t}) : (${q}k + ${t}) = ${s1} : ${s2}，交叉相乘：${s2}(${p}k + ${t}) = ${s1}(${q}k + ${t})，得 k = ${k}，所以甲现在 ${p} × ${k} = ${p * k} 岁。`,
      `Let the ages be ${p}k and ${q}k. (${p}k + ${t}) : (${q}k + ${t}) = ${s1} : ${s2}; cross-multiplying, ${s2}(${p}k + ${t}) = ${s1}(${q}k + ${t}), so k = ${k} and A is ${p} × ${k} = ${p * k}.`,
    ],
  };
}

const PAIRS = range(29).flatMap((i) => range(29).map((j) => [i + 2, j + 2])).filter(([a, b]) => a < b);
const TOGETHER = PAIRS.filter(([a, b]) => dp1((a * b) / (a + b)));
const PIPES = PAIRS.filter(([a, b]) => dp1((a * b) / (b - a)) && (a * b) / (b - a) <= 60);

function work(r: R): Draft {
  const type = int(r, 0, 2);
  const days = unit((s) => `${s} 天`, (s) => `${s} days`);
  if (type === 0) {
    const [a, b] = shuffle(r, [...pick(r, TOGETHER)]);
    const t = (a * b) / (a + b);
    return {
      q: [
        `甲单独做一项工作要 ${a} 天，乙单独做要 ${b} 天。两人合作要几天？`,
        `A can do a job alone in ${a} days and B in ${b} days. How many days do they take working together?`,
      ],
      right: days(t),
      wrong: [(a + b) / 2, Math.abs(a - b), t + 1, t - 1, a + b].filter((v) => v > 0).map((v) => days(like(v, t))),
      explain: [
        `效率相加：1/${a} + 1/${b} = ${a + b}/${a * b}，合作时间 = ${a} × ${b} ÷ (${a} + ${b}) = ${f(t)} 天。`,
        `Add the rates: 1/${a} + 1/${b} = ${a + b}/${a * b}, so together they take ${a} × ${b} ÷ (${a} + ${b}) = ${f(t)} days.`,
      ],
    };
  }
  if (type === 1) {
    const [x, y] = pick(r, TOGETHER.filter(([p, q]) => Number.isInteger((p * q) / (p + q))));
    const [a, b] = r() < 0.5 ? [x, y] : [y, x];
    const t = (a * b) / (a + b);
    return {
      q: [
        `甲、乙合作 ${t} 天完成一项工作，甲单独做要 ${a} 天。乙单独做要几天？`,
        `A and B finish a job together in ${t} days; A alone takes ${a} days. How many days does B take alone?`,
      ],
      right: days(b),
      wrong: [a - t, 2 * t, (a * t) / (a + t), a + t, b + t].filter((v) => v > 0).map((v) => days(Math.round(v))),
      explain: [
        `乙的效率 = 1/${t} − 1/${a} = ${a - t}/${a * t}，所以乙单独要 ${a} × ${t} ÷ (${a} − ${t}) = ${b} 天。`,
        `B's rate = 1/${t} − 1/${a} = ${a - t}/${a * t}, so B alone takes ${a} × ${t} ÷ (${a} − ${t}) = ${b} days.`,
      ],
    };
  }
  const [a, b] = pick(r, PIPES);
  const t = (a * b) / (b - a);
  const hours = unit((s) => `${s} 小时`, (s) => `${s} hours`);
  return {
    q: [
      `进水管单独开 ${a} 小时注满水池，排水管单独开 ${b} 小时排空。两管同时开，空池几小时注满？`,
      `Pipe A fills a tank in ${a} hours; pipe B empties it in ${b} hours. With both open, how long does the empty tank take to fill?`,
    ],
    right: hours(t),
    wrong: [(a * b) / (a + b), b - a, (a + b) / 2, t + 2, t - 2].filter((v) => v > 0).map((v) => hours(like(v, t))),
    explain: [
      `净效率 = 1/${a} − 1/${b} = ${b - a}/${a * b}，时间 = ${a} × ${b} ÷ (${b} − ${a}) = ${f(t)} 小时。`,
      `Net rate = 1/${a} − 1/${b} = ${b - a}/${a * b}, so the time is ${a} × ${b} ÷ (${b} − ${a}) = ${f(t)} hours.`,
    ],
  };
}

const SPEEDS = [20, 24, 30, 36, 40, 45, 48, 50, 54, 60, 72, 75, 80, 90, 100, 120];
const AVERAGES = SPEEDS.flatMap((x) => SPEEDS.map((y) => [x, y])).filter(([x, y]) => x < y && dp1((2 * x * y) / (x + y)));
/** km/h that convert to whole m/s (× 5/18). */
const KMH = [36, 54, 72, 90, 108];

function speed(r: R): Draft | null {
  const type = int(r, 0, 3);
  const kmh = unit((s) => `${s} 千米/时`, (s) => `${s} km/h`);
  const secs = unit((s) => `${s} 秒`, (s) => `${s} s`);
  if (type === 0) {
    const [x, y] = shuffle(r, [...pick(r, AVERAGES)]);
    const v = (2 * x * y) / (x + y);
    return {
      q: [
        `一辆车从甲地去乙地时速 ${x} 千米，沿原路返回时速 ${y} 千米。往返的平均速度是多少？`,
        `A car drives from P to Q at ${x} km/h and comes back the same way at ${y} km/h. What is its average speed for the round trip?`,
      ],
      right: kmh(v),
      wrong: [(x + y) / 2, Math.sqrt(x * y), v + 2, v - 2, Math.abs(y - x)].map((w) => kmh(like(w, v))),
      explain: [
        `平均速度 = 总路程 ÷ 总时间 = 2 × ${x} × ${y} ÷ (${x} + ${y}) = ${f(v)} 千米/时，不是 (${x} + ${y}) ÷ 2：慢的那段用时更长。`,
        `Average speed = total distance ÷ total time = 2 × ${x} × ${y} ÷ (${x} + ${y}) = ${f(v)} km/h, not (${x} + ${y}) ÷ 2: the slow leg takes longer.`,
      ],
    };
  }
  if (type === 1) {
    const v = pick(r, KMH);
    const ms = (v * 5) / 18;
    const pole = r() < 0.4;
    const t = pole ? int(r, 6, 20) : int(r, 12, 45);
    const total = t * ms;
    const len = pole ? total : 10 * Math.max(5, Math.round((total * (0.3 + 0.3 * r())) / 10));
    const platform = total - len;
    return {
      q: pole
        ? [
            `一列长 ${len} 米的火车以每小时 ${v} 千米的速度行驶，经过一根电线杆要几秒？`,
            `A ${len} m train runs at ${v} km/h. How many seconds does it take to pass a pole?`,
          ]
        : [
            `一列长 ${len} 米的火车以每小时 ${v} 千米的速度通过一座长 ${platform} 米的站台，从车头进站到车尾出站要几秒？`,
            `A ${len} m train running at ${v} km/h passes a ${platform} m platform. How many seconds from its front entering to its back leaving?`,
          ],
      right: secs(t),
      wrong: (pole ? [len / v, 2 * t, t + 3, t - 3] : [len / ms, total / v, platform / ms, t + 2, t - 2])
        .filter((w) => w > 0)
        .map((w) => secs(Math.round(w))),
      explain: [
        `先换算单位：${v} 千米/时 × 5/18 = ${ms} 米/秒。要走的路程是车长${pole ? '' : '加站台长'} ${total} 米，时间 = ${total} ÷ ${ms} = ${t} 秒。`,
        `Convert first: ${v} km/h × 5/18 = ${ms} m/s. The train covers its own length${pole ? '' : ' plus the platform'}, ${total} m, in ${total} ÷ ${ms} = ${t} s.`,
      ],
    };
  }
  if (type === 2) {
    const [v1, v2] = shuffle(r, [...KMH]).slice(0, 2).sort((a, b) => b - a);
    const [m1, m2] = [(v1 * 5) / 18, (v2 * 5) / 18];
    const towards = r() < 0.5;
    const rel = towards ? m1 + m2 : m1 - m2;
    const t = int(r, 6, 30);
    const total = t * rel;
    const l1 = 10 * Math.max(5, Math.round((total * (0.35 + 0.3 * r())) / 10));
    const l2 = total - l1;
    if (l2 < 50) return null;
    const other = towards ? m1 - m2 : m1 + m2;
    return {
      q: towards
        ? [
            `两列火车相向而行，长 ${l1} 米和 ${l2} 米，时速分别是 ${v1} 千米和 ${v2} 千米。从车头相遇到车尾离开要几秒？`,
            `Two trains, ${l1} m and ${l2} m long, run towards each other at ${v1} km/h and ${v2} km/h. How many seconds do they take to pass each other completely?`,
          ]
        : [
            `两列火车同向而行，快车长 ${l1} 米、时速 ${v1} 千米，慢车长 ${l2} 米、时速 ${v2} 千米。快车从追上到完全超过慢车要几秒？`,
            `Two trains run the same way: one ${l1} m long at ${v1} km/h, the other ${l2} m long at ${v2} km/h. How many seconds does the faster take to pass the slower completely?`,
          ],
      right: secs(t),
      wrong: [total / other, l1 / rel, total / (towards ? v1 + v2 : v1 - v2), t + 2, t - 2].filter((w) => w > 0).map((w) => secs(Math.round(w))),
      explain: [
        `${v1}、${v2} 千米/时是 ${m1}、${m2} 米/秒。${towards ? '相向' : '同向'}时相对速度 = ${m1} ${towards ? '+' : '−'} ${m2} = ${rel} 米/秒，要走完两车长度之和 ${total} 米：${total} ÷ ${rel} = ${t} 秒。`,
        `${v1} and ${v2} km/h are ${m1} and ${m2} m/s. ${towards ? 'Towards each other' : 'Going the same way'}, the relative speed is ${m1} ${towards ? '+' : '−'} ${m2} = ${rel} m/s, and together they must cover both lengths, ${total} m: ${total} ÷ ${rel} = ${t} s.`,
      ],
    };
  }
  const still = int(r, 6, 20);
  const stream = int(r, 1, 5);
  const [down, up] = [still + stream, still - stream];
  const [t1, t2] = [int(r, 2, 5), int(r, 2, 6)];
  const askStill = r() < 0.5;
  return {
    q: [
      `一艘船顺流 ${t1} 小时行 ${down * t1} 千米，逆流 ${t2} 小时行 ${up * t2} 千米。${askStill ? '船在静水中的速度' : '水流速度'}是多少？`,
      `A boat goes ${down * t1} km downstream in ${t1} hours and ${up * t2} km upstream in ${t2} hours. What is ${askStill ? "the boat's speed in still water" : 'the speed of the current'}?`,
    ],
    right: kmh(askStill ? still : stream),
    wrong: [askStill ? stream : still, down - up, down + up, (askStill ? still : stream) + 1, askStill ? down : up].map(kmh),
    explain: [
      `顺流速度 ${down * t1} ÷ ${t1} = ${down}，逆流速度 ${up * t2} ÷ ${t2} = ${up}。静水速度 = (顺 + 逆) ÷ 2 = ${still}，水速 = (顺 − 逆) ÷ 2 = ${stream}（千米/时）。`,
      `Downstream speed ${down * t1} ÷ ${t1} = ${down}, upstream ${up * t2} ÷ ${t2} = ${up}. Still water = (down + up) ÷ 2 = ${still}; current = (down − up) ÷ 2 = ${stream} (km/h).`,
    ],
  };
}

function interest(r: R): Draft {
  const type = int(r, 0, 3);
  const years = unit((s) => `${s} 年`, (s) => `${s} years`);
  if (type === 0) {
    const p = 500 * int(r, 2, 40);
    const rate = pick(r, [4, 5, 6, 8, 10, 12]);
    const t = int(r, 2, 6);
    const si = (p * rate * t) / 100;
    const amount = r() < 0.4;
    const ci = p * ((1 + rate / 100) ** t - 1);
    return {
      q: [
        `${p} 元按年利率 ${rate}% 存 ${t} 年，单利计息。${amount ? '到期本息合计多少？' : '利息是多少？'}`,
        `$${p} is invested at ${rate}% a year simple interest for ${t} years. ${amount ? 'What is the total at the end, principal plus interest?' : 'How much interest does it earn?'}`,
      ],
      right: money(amount ? p + si : si),
      wrong: (amount ? [si, p + ci, p + (p * rate) / 100, p + si + (p * rate) / 100] : [ci, si + p, (p * rate) / 100, si + (p * rate) / 100]).map((v) =>
        money(Math.round(v)),
      ),
      explain: [
        `单利 I = P × r × t = ${p} × ${rate}% × ${t} = ${si} 元${amount ? `，本息合计 ${p} + ${si} = ${p + si} 元` : ''}。单利每年只按本金计息。`,
        `Simple interest I = P × r × t = ${p} × ${rate}% × ${t} = $${si}${amount ? `, so the total is ${p} + ${si} = $${p + si}` : ''}. Simple interest is paid on the principal only.`,
      ],
    };
  }
  if (type === 1) {
    const p = 1000 * int(r, 1, 20);
    const rate = pick(r, [5, 8, 10, 12, 15, 20]);
    const ci = ((p / 1000) * (200 * rate + rate * rate)) / 10;
    const si = (2 * p * rate) / 100;
    const diff = ci - si;
    return {
      q: [
        `${p} 元按年利率 ${rate}%、每年复利一次存 2 年，利息是多少？`,
        `$${p} is invested at ${rate}% a year, compounded annually, for 2 years. How much interest does it earn?`,
      ],
      right: money(ci),
      wrong: [si, p + ci, (p * rate) / 100, ci + diff].map(money),
      explain: [
        `复利利息 = P × (1 + r)² − P = ${p} × ${mul(rate)}² − ${p} = ${f(ci)} 元。单利只有 ${si} 元，多出的 ${f(diff)} 元是第一年的利息在第二年生的利息。`,
        `Compound interest = P × (1 + r)² − P = ${p} × ${mul(rate)}² − ${p} = $${f(ci)}. Simple interest would be $${si}; the extra $${f(diff)} is interest earned on the first year's interest.`,
      ],
    };
  }
  if (type === 2) {
    const rate = pick(r, [4, 5, 8, 10, 12, 20]);
    const p = 1000 * int(r, 1, 20);
    const d = ((p / 1000) * rate * rate) / 10;
    return {
      q: [
        `某笔钱按年利率 ${rate}% 存 2 年，每年复利一次比单利多 ${f(d)} 元。本金是多少？`,
        `At ${rate}% a year for 2 years, interest compounded annually beats simple interest on a sum by $${f(d)}. What is the sum?`,
      ],
      right: money(p),
      wrong: [(d * 100) / rate, 2 * p, p / 2, p + 1000].map((v) => money(Math.round(v))),
      explain: [
        `两年期复利与单利之差 = P × r²（第一年利息再生的利息），所以 P = ${f(d)} ÷ ${rate / 100}² = ${p} 元。`,
        `Over 2 years compound minus simple interest = P × r² (interest on the first year's interest), so P = ${f(d)} ÷ ${rate / 100}² = $${p}.`,
      ],
    };
  }
  const [rate, m] = pick(
    r,
    [4, 5, 8, 10, 12.5, 16, 20, 25].flatMap((x) => [[x, 2], [x, 3]]).filter(([x, k]) => dp1(((k - 1) * 100) / x)),
  );
  const t = ((m - 1) * 100) / rate;
  return {
    q: [
      `按单利计算，年利率 ${rate}% 时，一笔钱几年后变成原来的 ${m} 倍？`,
      `At ${rate}% a year simple interest, how many years does a sum take to ${m === 2 ? 'double' : 'triple'}?`,
    ],
    right: years(t),
    wrong: [(m * 100) / rate, 72 / rate, t + 2, t - 2, 100 / rate].filter((v) => v > 0).map((v) => years(like(v, t))),
    explain: [
      `变成 ${m} 倍，利息就是本金的 ${m - 1} 倍：${m - 1} = ${rate}% × t，t = ${(m - 1) * 100} ÷ ${rate} = ${f(t)} 年。72 法则只是复利翻倍的近似，这里不适用。`,
      `To become ${m} times itself the interest must equal ${m - 1} × the principal: ${m - 1} = ${rate}% × t, so t = ${(m - 1) * 100} ÷ ${rate} = ${f(t)} years. The rule of 72 approximates compound doubling and does not apply.`,
    ],
  };
}

// ---------------------------------------------------------------- data

const GROWTH = [10, 12.5, 15, 20, 25, 30, 37.5, 40, 50, 60, 75, -10, -12.5, -20, -25, -37.5, -50];

function chart(r: R): Draft | null {
  const start = int(r, 2018, 2021);
  const labels = range(5).map((i) => String(start + i));
  const series = labels.map(() => 10 * int(r, 4, 30));
  const fig: DraftFig = { kind: 'bars', labels, series, unit: '$M' };
  const intro: Tx = ['柱状图是某公司 5 年的销售额（单位：百万美元）。', 'The bar chart shows a company’s sales over five years ($ millions).'];
  const type = int(r, 0, 3);
  if (type === 0) {
    const i = int(r, 0, 3);
    const j = int(r, i + 1, 4);
    const g = pick(r, GROWTH);
    series[i] = 40 * int(r, 1, 6);
    series[j] = (series[i] * (100 + g)) / 100;
    const [a, b] = [series[i], series[j]];
    return {
      fig,
      q: [`${intro[0]}从 ${labels[i]} 年到 ${labels[j]} 年，销售额变化了百分之几？`, `${intro[1]} By what percent did sales change from ${labels[i]} to ${labels[j]}?`],
      right: change(g),
      wrong: [((b - a) / b) * 100, -g, g + (g > 0 ? 5 : -5), b - a, g - (g > 0 ? 5 : -5)].map((v) => change(like(v, g))),
      explain: [
        `变化率 = (${b} − ${a}) ÷ ${a} × 100 = ${f(g)}%。分母是起始年份 ${labels[i]} 的值，不是 ${labels[j]} 的。`,
        `Change = (${b} − ${a}) ÷ ${a} × 100 = ${f(g)}%. Divide by the starting year, ${labels[i]}, not by ${labels[j]}.`,
      ],
    };
  }
  if (type === 1) {
    const [i, j, k] = shuffle(r, range(5)).slice(0, 3);
    if (series[i] === series[j]) return null;
    const right = ratio(series[i], series[j]);
    const [a, b] = right.split(' : ').map(Number);
    return {
      fig,
      q: [`${intro[0]}${labels[i]} 年与 ${labels[j]} 年的销售额之比是多少？`, `${intro[1]} What is the ratio of sales in ${labels[i]} to sales in ${labels[j]}?`],
      right: same(right),
      wrong: [`${b} : ${a}`, ratio(a + 1, b), ratio(series[i], series[k]), ratio(a, b + 1), ratio(series[k], series[j])].map(same),
      explain: [
        `${series[i]} : ${series[j]}，同除以最大公约数 ${gcd(series[i], series[j])}，得 ${right}。`,
        `${series[i]} : ${series[j]}; dividing both by their greatest common divisor, ${gcd(series[i], series[j])}, gives ${right}.`,
      ],
    };
  }
  if (type === 2) {
    const sum = series.reduce((s, v) => s + v, 0);
    const mean = sum / 5;
    const sorted = [...series].sort((a, b) => a - b);
    return {
      fig,
      q: [`${intro[0]}这 5 年的年均销售额是多少（百万美元）？`, `${intro[1]} What were the average annual sales over the five years ($ millions)?`],
      right: same(f(mean)),
      wrong: [sorted[2], (sorted[0] + sorted[4]) / 2, mean + 4, mean - 4, sum / 4].map((v) => same(f(like(v, mean)))),
      explain: [`平均数 = (${series.join(' + ')}) ÷ 5 = ${sum} ÷ 5 = ${f(mean)}。`, `Mean = (${series.join(' + ')}) ÷ 5 = ${sum} ÷ 5 = ${f(mean)}.`],
    };
  }
  const rises = series.slice(1).map((v, i) => v - series[i]);
  const best = Math.max(...rises);
  if (best <= 0 || rises.filter((d) => d === best).length > 1) return null;
  const at = rises.indexOf(best) + 1;
  const steps = rises.map((d, i) => `${labels[i + 1]}: ${d > 0 ? '+' : ''}${d}`).join(', ');
  return {
    fig,
    q: [`${intro[0]}哪一年比上一年增加得最多（按增加的数额）？`, `${intro[1]} In which year did sales rise the most over the year before (in $ millions)?`],
    right: same(labels[at]),
    wrong: labels.slice(1).filter((_, i) => i + 1 !== at).map(same),
    explain: [`逐年相减：${steps}。${labels[at]} 年增加 ${best}，最多。`, `Year-on-year changes: ${steps}. ${labels[at]} rose by ${best}, the most.`],
  };
}

// ---------------------------------------------------------------- logical

function series(r: R): Draft {
  const rule = int(r, 0, 6);
  let terms: number[];
  let next: number;
  let why: Tx;
  const nudge: number[] = [];
  if (rule === 0) {
    const d = int(r, 3, 15) * (r() < 0.3 ? -1 : 1);
    const a = d < 0 ? int(r, 70, 99) : int(r, 1, 30);
    terms = range(5).map((i) => a + i * d);
    next = a + 5 * d;
    why = [`每项${d > 0 ? '加' : '减'} ${Math.abs(d)}（等差数列，aₙ = a₁ + (n − 1)d）`, `each term ${d > 0 ? 'adds' : 'subtracts'} ${Math.abs(d)} (arithmetic: aₙ = a₁ + (n − 1)d)`];
    nudge.push(next + d, next + 1, next - 1);
  } else if (rule === 1) {
    const a = int(r, 1, 6);
    const q = int(r, 2, 3);
    terms = range(5).map((i) => a * q ** i);
    next = a * q ** 5;
    why = [`每项乘 ${q}（等比数列，aₙ = a₁ × q^(n−1)）`, `each term is multiplied by ${q} (geometric: aₙ = a₁ × q^(n−1))`];
    nudge.push(next - q, next + a, terms[4] * (q + 1));
  } else if (rule === 2) {
    const [a, d, e] = [int(r, 1, 20), int(r, 1, 6), int(r, 1, 4)];
    terms = [a];
    for (let i = 0; i < 5; i++) terms.push(terms[i] + d + i * e);
    next = terms.pop()!;
    why = [`相邻两项的差是 ${range(4).map((i) => d + i * e).join(', ')}，每次多 ${e}（二阶等差），下一个差是 ${d + 4 * e}`, `the gaps are ${range(4).map((i) => d + i * e).join(', ')}, growing by ${e} each time, so the next gap is ${d + 4 * e}`];
    nudge.push(next + e, next - 1, next + 1);
  } else if (rule === 3) {
    const p = r() < 0.6 ? 2 : 3;
    const s = int(r, 1, p === 2 ? 6 : 3);
    const c = int(r, -3, 3);
    terms = range(5).map((i) => (s + i) ** p + c);
    next = (s + 5) ** p + c;
    const sup = p === 2 ? '²' : '³';
    const tail: Tx = c ? [`再${c > 0 ? '加' : '减'} ${Math.abs(c)}`, `, ${c > 0 ? 'plus' : 'minus'} ${Math.abs(c)}`] : ['', ''];
    why = [`依次是 ${s}${sup}, ${s + 1}${sup}, ${s + 2}${sup} …${tail[0]}`, `the terms are ${s}${sup}, ${s + 1}${sup}, ${s + 2}${sup} …${tail[1]}`];
    nudge.push(c ? (s + 5) ** p : next + 2, next + 1, next - 1);
  } else if (rule === 4) {
    const [a, d1, b, d2] = [int(r, 1, 20), int(r, 2, 9), int(r, 30, 60), int(r, 1, 6) * (r() < 0.5 ? -1 : 1)];
    terms = range(6).map((i) => (i % 2 ? b + ((i - 1) / 2) * d2 : a + (i / 2) * d1));
    next = a + 3 * d1;
    why = [
      `奇数位和偶数位是两个数列：${a}, ${a + d1}, ${a + 2 * d1} 每次加 ${d1}；${b}, ${b + d2}, ${b + 2 * d2} 每次${d2 > 0 ? '加' : '减'} ${Math.abs(d2)}。下一个在第 7 位，属于第一个数列`,
      `two series take turns: ${a}, ${a + d1}, ${a + 2 * d1} adds ${d1}; ${b}, ${b + d2}, ${b + 2 * d2} ${d2 > 0 ? 'adds' : 'subtracts'} ${Math.abs(d2)}. The 7th term belongs to the first`,
    ];
    nudge.push(b + 3 * d2, next + d1, next - 1);
  } else if (rule === 5) {
    const c = pick(r, [-1, 1, 2, 3]);
    const x0 = int(r, c < 0 ? 2 : 1, 5);
    terms = [x0];
    for (let i = 0; i < 4; i++) terms.push(terms[i] * 2 + c);
    next = terms[4] * 2 + c;
    why = [`每项 × 2 ${c > 0 ? '+' : '−'} ${Math.abs(c)}`, `each term is doubled, then ${c > 0 ? `${c} is added` : `${-c} is subtracted`}`];
    nudge.push(terms[4] * 2, next + 1, next - 1);
  } else {
    terms = [int(r, 1, 5), int(r, 1, 7)];
    for (let i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2]);
    next = terms[4] + terms[5];
    why = ['从第三项起，每项等于前两项之和', 'from the third term on, each term is the sum of the two before it'];
    nudge.push(next + 1, next - 1, 2 * terms[5]);
  }
  const last = terms[terms.length - 1];
  return {
    q: [`下一个数是多少？ ${terms.join(', ')}, ?`, `What number comes next? ${terms.join(', ')}, ?`],
    right: same(String(next)),
    wrong: [last + (last - terms[terms.length - 2]), ...nudge, next + 2].map((v) => same(String(v))),
    explain: [`${why[0]}，所以下一个是 ${next}。`, `${why[1][0].toUpperCase()}${why[1].slice(1)}, so the next term is ${next}.`],
  };
}

const WORDS = ['CAT', 'DOG', 'SUN', 'MAP', 'KEY', 'BOOK', 'CODE', 'DATA', 'LOOP', 'TREE', 'NODE', 'BYTE', 'LINK', 'PATH', 'GRAPH', 'STACK', 'QUEUE', 'ARRAY', 'MOUSE', 'PIXEL'];
const shiftBy = (w: string, k: (i: number) => number) =>
  [...w].map((ch, i) => String.fromCharCode(65 + ((((ch.charCodeAt(0) - 65 + k(i)) % 26) + 26) % 26))).join('');
const rev = (w: string) => [...w].reverse().join('');

function coding(r: R): Draft {
  const [w1, w2] = shuffle(r, [...WORDS]).slice(0, 2);
  const type = int(r, 0, 2);
  if (type === 2) {
    const base = int(r, 1, 2);
    const code = (w: string, b = base) => shiftBy(w, (i) => b + i);
    return {
      q: [`在某种密码中，${w1} 写作 ${code(w1)}。按同样的规则，${w2} 写作什么？`, `In a certain code, ${w1} is written as ${code(w1)}. How is ${w2} written in that code?`],
      right: same(code(w2)),
      wrong: [shiftBy(w2, () => base), code(w2, base + 1), shiftBy(w2, (i) => base + w2.length - 1 - i), shiftBy(w2, () => base + 1)].map(same),
      explain: [
        `第 1 个字母后移 ${base} 位，第 2 个后移 ${base + 1} 位，依此类推（Z 之后回到 A）。所以 ${w2} → ${code(w2)}。`,
        `The 1st letter moves ${base} place${base > 1 ? 's' : ''} forward, the 2nd ${base + 1}, and so on (wrapping from Z to A). So ${w2} → ${code(w2)}.`,
      ],
    };
  }
  const k = pick(r, [-3, -2, -1, 1, 2, 3, 4, 5]);
  const flip = type === 1 ? rev : (w: string) => w;
  const code = (w: string, by = k) => shiftBy(flip(w), () => by);
  const step: Tx = [`${k > 0 ? '后' : '前'}移 ${Math.abs(k)} 位`, `${Math.abs(k)} place${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'forward' : 'back'}`];
  const sample = [...flip(w1)].slice(0, 3).map((ch) => `${ch}→${shiftBy(ch, () => k)}`).join(', ');
  return {
    q: [`在某种密码中，${w1} 写作 ${code(w1)}。按同样的规则，${w2} 写作什么？`, `In a certain code, ${w1} is written as ${code(w1)}. How is ${w2} written in that code?`],
    right: same(code(w2)),
    wrong: [type === 1 ? shiftBy(w2, () => k) : rev(code(w2)), code(w2, k + 1), code(w2, -k), code(w2, k - 1)].map(same),
    explain:
      type === 1
        ? [
            `先把单词倒过来（${w1} → ${rev(w1)}），再把每个字母${step[0]}（${sample}）。所以 ${w2} → ${rev(w2)} → ${code(w2)}。`,
            `Reverse the word (${w1} → ${rev(w1)}), then move each letter ${step[1]} (${sample}). So ${w2} → ${rev(w2)} → ${code(w2)}.`,
          ]
        : [
            `每个字母在字母表中${step[0]}（${sample}），Z 之后回到 A。所以 ${w2} → ${code(w2)}。`,
            `Each letter moves ${step[1]} in the alphabet (${sample}), wrapping from Z to A. So ${w2} → ${code(w2)}.`,
          ],
  };
}

// Syllogisms: three groups as bits 1, 2, 4; a model is which of the 7 Venn regions have members.
type Form = 'all' | 'no' | 'some' | 'not';
type Statement = [Form, number, number];
function holds([form, x, y]: Statement, model: number) {
  let hit = false;
  for (let region = 1; region < 8; region++) {
    if (!((model >> (region - 1)) & 1)) continue;
    const inX = !!(region & x);
    const inY = !!(region & y);
    if ((form === 'all' && inX && !inY) || (form === 'no' && inX && inY)) return false;
    if ((form === 'some' && inX && inY) || (form === 'not' && inX && !inY)) hit = true;
  }
  return form === 'all' || form === 'no' || hit;
}
/** Every group has at least one member, the usual reading (else "All A are B" holds of an empty A). */
const MODELS = range(128).filter((m) => [1, 2, 4].every((g) => range(7).some((i) => (m >> i) & 1 && (i + 1) & g)));
const A = 1, B = 2, C = 4;
const CONCLUSIONS: Statement[] = [['all', A, C], ['all', C, A], ['no', A, C], ['some', A, C], ['not', A, C], ['not', C, A]];
/** Whether a conclusion follows: true in every model where both premises hold. */
function syllogismFollows(premises: Statement[], conclusion: Statement) {
  const models = MODELS.filter((m) => premises.every((p) => holds(p, m)));
  return models.length > 0 && models.every((m) => holds(conclusion, m));
}
const FORMS: Form[] = ['all', 'no', 'some', 'not'];
let syllogisms: { premises: Statement[]; valid: Statement[]; invalid: Statement[] }[] | null = null;
/** Premise pairs with at least one conclusion that follows and three that do not. */
const goodSyllogisms = () =>
  (syllogisms ??= FORMS.flatMap((f1) =>
    FORMS.flatMap((f2) =>
      [[A, B], [B, A]].flatMap(([x1, y1]) =>
        [[B, C], [C, B]].map(([x2, y2]) => {
          const premises: Statement[] = [[f1, x1, y1], [f2, x2, y2]];
          const valid = CONCLUSIONS.filter((c) => syllogismFollows(premises, c));
          return { premises, valid, invalid: CONCLUSIONS.filter((c) => !valid.includes(c)) };
        }),
      ),
    ),
  ).filter((s) => s.valid.length >= 1 && s.invalid.length >= 3));
const GROUPS: Tx[] = [
  ['画家', 'painters'], ['歌手', 'singers'], ['跑者', 'runners'], ['作家', 'writers'], ['棋手', 'chess players'],
  ['厨师', 'cooks'], ['司机', 'drivers'], ['诗人', 'poets'], ['舞者', 'dancers'], ['医生', 'doctors'],
];

function syllogism(r: R): Draft {
  const s = pick(r, goodSyllogisms());
  const names = shuffle(r, [...GROUPS]).slice(0, 3);
  const name = (g: number) => names[g === A ? 0 : g === B ? 1 : 2];
  const say = ([form, x0, y0]: Statement): Tx => {
    // "No" and "some" read the same both ways round; vary the order.
    const [x, y] = (form === 'no' || form === 'some') && r() < 0.5 ? [y0, x0] : [x0, y0];
    const [X, Y] = [name(x), name(y)];
    return {
      all: [`所有${X[0]}都是${Y[0]}`, `All ${X[1]} are ${Y[1]}`],
      no: [`没有${X[0]}是${Y[0]}`, `No ${X[1]} are ${Y[1]}`],
      some: [`有些${X[0]}是${Y[0]}`, `Some ${X[1]} are ${Y[1]}`],
      not: [`有些${X[0]}不是${Y[0]}`, `Some ${X[1]} are not ${Y[1]}`],
    }[form] as Tx;
  };
  const [p1, p2] = s.premises.map(say);
  const answer = say(pick(r, s.valid));
  return {
    q: [
      `假设下面两句话都成立（不管是否符合常识），并且每类人都至少有一个：① ${p1[0]}；② ${p2[0]}。下列哪个结论一定成立？`,
      `Take both statements as true, however odd, and assume each group has at least one member. (1) ${p1[1]}. (2) ${p2[1]}. Which conclusion must follow?`,
    ],
    right: { t: answer },
    wrong: shuffle(r, [...s.invalid]).map((c) => ({ t: say(c) })),
    explain: [
      `画三个圆代表三类人，把两句话排除的区域划掉，再标出一定有人的区域。「${answer[0]}」在所有符合条件的画法里都成立；另外三个结论都能找到一种画法，两句话成立而结论不成立。`,
      `Draw three circles for the groups, cross out the regions the statements rule out and mark the ones they say have members. "${answer[1]}" holds in every diagram that fits both statements; each of the other three fails in at least one diagram that fits them.`,
    ],
  };
}

// Seating: five people in seats 1–5; pos[person] = seat (0-based).
const permutations = (xs: number[]): number[][] =>
  xs.length <= 1 ? [xs] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
const SEATINGS = permutations(range(5));
type Clue = ['end' | 'mid' | 'seat', number, number] | ['left' | 'next' | 'apart' | 'gap' | 'before', number, number];
function clueHolds([type, x, y]: Clue, pos: number[]) {
  const d = pos[y] - pos[x];
  switch (type) {
    case 'end': return pos[x] === 0 || pos[x] === 4;
    case 'mid': return pos[x] !== 0 && pos[x] !== 4;
    case 'seat': return pos[x] === y;
    case 'left': return d === 1;
    case 'next': return Math.abs(d) === 1;
    case 'apart': return Math.abs(d) !== 1;
    case 'gap': return Math.abs(d) === 2;
    case 'before': return d > 0;
  }
}
const PEOPLE: Tx[] = [['小安', 'Ava'], ['小白', 'Ben'], ['小陈', 'Cal'], ['小丁', 'Dana'], ['小范', 'Eli'], ['小高', 'Faye'], ['小何', 'Gus'], ['小金', 'Hana']];
/** Who answers the question for one seating: the person in `seat`, or right of `of` (−1 when none). */
const asked = (q: { seat?: number; of?: number }, pos: number[]) =>
  q.seat !== undefined ? pos.indexOf(q.seat) : pos.indexOf(pos[q.of!] + 1);
function seatingAnswers(clues: Clue[], q: { seat?: number; of?: number }) {
  return new Set(SEATINGS.filter((pos) => clues.every((c) => clueHolds(c, pos))).map((pos) => asked(q, pos)));
}

function seating(r: R): Draft | null {
  const pos = pick(r, SEATINGS);
  const names = shuffle(r, [...PEOPLE]).slice(0, 5);
  const q = r() < 0.5 ? { seat: int(r, 0, 4) } : { of: pos.indexOf(int(r, 0, 3)) };
  const answer = asked(q, pos);
  const all: Clue[] = [];
  for (let x = 0; x < 5; x++) {
    all.push([pos[x] === 0 || pos[x] === 4 ? 'end' : 'mid', x, x], ['seat', x, pos[x]]);
    for (let y = 0; y < 5; y++) {
      if (x === y) continue;
      if (pos[y] === pos[x] + 1) all.push(['left', x, y]);
      if (pos[x] < pos[y]) all.push([pos[y] - pos[x] === 2 ? 'gap' : 'before', x, y], [pos[y] - pos[x] === 1 ? 'next' : 'apart', x, y]);
    }
  }
  // Nothing that names the answer outright.
  const allowed = shuffle(r, all.filter(([type, x, y]) => !(type === 'seat' && x === answer) && !(type === 'left' && x === q.of && y === answer)));
  let chosen: Clue[] = [];
  for (const clue of allowed) {
    if (seatingAnswers(chosen, q).size === 1) break;
    // Only clues that rule something out.
    if (SEATINGS.some((p) => chosen.every((c) => clueHolds(c, p)) && !clueHolds(clue, p))) chosen.push(clue);
  }
  if (seatingAnswers(chosen, q).size !== 1) return null;
  // Drop clues the answer does not need.
  for (const clue of [...chosen]) {
    const without = chosen.filter((c) => c !== clue);
    if (seatingAnswers(without, q).size === 1) chosen = without;
  }
  const say = ([type, x, y]: Clue): Tx => {
    const [X, Y] = [names[x], names[y]];
    return {
      end: [`${X[0]}坐在某一端。`, `${X[1]} sits at one of the ends.`],
      mid: [`${X[0]}不坐在两端。`, `${X[1]} does not sit at either end.`],
      seat: [`${X[0]}坐在 ${y + 1} 号座位。`, `${X[1]} sits in seat ${y + 1}.`],
      left: [`${X[0]}紧挨着坐在${Y[0]}的左边。`, `${X[1]} sits immediately to the left of ${Y[1]}.`],
      next: [`${X[0]}和${Y[0]}相邻。`, `${X[1]} sits next to ${Y[1]}.`],
      apart: [`${X[0]}和${Y[0]}不相邻。`, `${X[1]} does not sit next to ${Y[1]}.`],
      gap: [`${X[0]}和${Y[0]}之间恰好隔着一个人。`, `Exactly one person sits between ${X[1]} and ${Y[1]}.`],
      before: [`${X[0]}坐在${Y[0]}左边的某个位置（不一定相邻）。`, `${X[1]} sits somewhere to the left of ${Y[1]}.`],
    }[type] as Tx;
  };
  const clues = chosen.map(say);
  const ask: Tx = q.seat !== undefined ? [`谁坐在 ${q.seat + 1} 号座位？`, `Who sits in seat ${q.seat + 1}?`] : [`谁紧挨着坐在${names[q.of!][0]}的右边？`, `Who sits immediately to the right of ${names[q.of!][1]}?`];
  const order = range(5).map((s) => names[pos.indexOf(s)]);
  return {
    q: [
      `${names.map((n) => n[0]).join('、')}五人坐成一排，座位从左到右编号 1–5。${clues.map((c) => c[0]).join('')}${ask[0]}`,
      `${names.slice(0, 4).map((n) => n[1]).join(', ')} and ${names[4][1]} sit in a row of seats numbered 1–5 from left to right. ${clues.map((c) => c[1]).join(' ')} ${ask[1]}`,
    ],
    right: { t: names[answer] },
    wrong: shuffle(r, range(5).filter((p) => p !== answer && p !== q.of)).map((p) => ({ t: names[p] })),
    explain: [
      `一种符合全部条件的坐法（从左到右）：${order.map((n) => n[0]).join('、')}。逐条排除后，所有符合条件的坐法里答案都是${names[answer][0]}。`,
      `One seating that fits every clue, left to right: ${order.map((n) => n[1]).join(', ')}. Ruling out seatings clue by clue, every seating that fits gives ${names[answer][1]}.`,
    ],
  };
}

const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25]];
const HEADINGS: { zh: string; en: string; v: [number, number] }[] = [
  { zh: '北', en: 'north', v: [0, 1] },
  { zh: '东', en: 'east', v: [1, 0] },
  { zh: '南', en: 'south', v: [0, -1] },
  { zh: '西', en: 'west', v: [-1, 0] },
];
const diagonal = (x: number, y: number): Tx => [`${x > 0 ? '东' : '西'}${y > 0 ? '北' : '南'}`, `${y > 0 ? 'north' : 'south'}-${x > 0 ? 'east' : 'west'}`];

function direction(r: R): Draft {
  const [ta, tb, c] = pick(r, TRIPLES);
  const legs = int(r, 3, 4);
  const heads = [int(r, 0, 3)];
  const turns: number[] = [];
  for (let i = 1; i < legs; i++) {
    turns.push(r() < 0.5 ? 1 : 3);
    heads.push((heads[i - 1] + turns[i - 1]) % 4);
  }
  const lens = Array<number>(legs).fill(0);
  const [gx, gy] = r() < 0.5 ? [ta, tb] : [tb, ta];
  for (const [axis, target] of [[0, gx], [1, gy]] as const) {
    const idx = range(legs).filter((i) => HEADINGS[heads[i]].v[axis] !== 0);
    if (idx.length === 1) lens[idx[0]] = target;
    else if (HEADINGS[heads[idx[0]]].v[axis] === HEADINGS[heads[idx[1]]].v[axis]) {
      lens[idx[0]] = int(r, 1, target - 1);
      lens[idx[1]] = target - lens[idx[0]];
    } else {
      const small = int(r, 1, 10);
      const big = r() < 0.5 ? 0 : 1;
      lens[idx[big]] = small + target;
      lens[idx[1 - big]] = small;
    }
  }
  const x = lens.reduce((s, l, i) => s + l * HEADINGS[heads[i]].v[0], 0);
  const y = lens.reduce((s, l, i) => s + l * HEADINGS[heads[i]].v[1], 0);
  const who = pick(r, PEOPLE);
  const where = (d: number, [dx, dy]: [number, number]) => tx(`${d} 米，${diagonal(dx, dy)[0]}方向`, `${d} m, ${diagonal(dx, dy)[1]}`);
  const zhLegs = lens.map((l, i) => (i ? `，再向${turns[i - 1] === 1 ? '右' : '左'}转走 ${l} 米` : `先向${HEADINGS[heads[0]].zh}走 ${l} 米`)).join('');
  const enLegs = lens.map((l, i) => (i ? `, then turns ${turns[i - 1] === 1 ? 'right' : 'left'} and walks ${l} m` : `walks ${l} m ${HEADINGS[heads[0]].en}`)).join('');
  const total = lens.reduce((s, l) => s + l, 0);
  return {
    q: [`${who[0]}从某地出发，${zhLegs}。这时${who[0]}离出发点的直线距离是多少，在出发点的什么方向？`, `${who[1]} ${enLegs}. How far is ${who[1]} from the start in a straight line, and in which direction?`],
    right: where(c, [x, y]),
    wrong: [where(c, [-x, -y]), where(c, [-x, y]), where(ta + tb, [x, y]), where(total, [x, y]), where(c, [x, -y])],
    explain: [
      `把每段分成东西和南北两个方向：东西方向净走 ${Math.abs(x)} 米（向${x > 0 ? '东' : '西'}），南北方向净走 ${Math.abs(y)} 米（向${y > 0 ? '北' : '南'}）。直线距离 = √(${x * x} + ${y * y}) = ${c} 米（勾股数 ${Math.min(ta, tb)}-${Math.max(ta, tb)}-${c}），方向是${diagonal(x, y)[0]}。`,
      `Split each leg into east–west and north–south: net ${Math.abs(x)} m ${x > 0 ? 'east' : 'west'} and ${Math.abs(y)} m ${y > 0 ? 'north' : 'south'}. Straight-line distance = √(${x * x} + ${y * y}) = ${c} m (the ${Math.min(ta, tb)}-${Math.max(ta, tb)}-${c} triple), towards the ${diagonal(x, y)[1]}.`,
    ],
  };
}

// ---------------------------------------------------------------- abstract

const SHAPE_NAMES: Record<AptShape, Tx> = {
  tri: ['三角形', 'triangle'],
  arrow: ['箭头', 'arrow'],
  flag: ['旗子', 'flag'],
  ell: ['L 形', 'L-shape'],
  eff: ['F 形', 'F-shape'],
};
// Hollow and solid rather than white and black: they stay true in the dark theme too.
const FILL_NAMES: Tx[] = [['空心', 'outlined'], ['灰色', 'grey'], ['实心', 'solid']];
const norm = (deg: number) => ((deg % 360) + 360) % 360;
/** A cell in words, for screen readers and the choice text: "2 grey flags, turned 90° clockwise". */
export function cellText(cell: AptCell): Tx {
  const [zhShape, enShape] = SHAPE_NAMES[cell.shape];
  const [zhFill, enFill] = FILL_NAMES[cell.fill];
  const zhTail = `${cell.flip ? '，左右翻转' : ''}${cell.rot ? `，${cell.flip ? '再' : ''}顺时针转 ${cell.rot}°` : ''}`;
  const enTail = `${cell.flip ? ', mirrored' : ''}${cell.rot ? `,${cell.flip ? ' then' : ''} turned ${cell.rot}° clockwise` : ''}`;
  return [`${cell.n} 个${zhFill}${zhShape}${zhTail}`, `${cell.n} ${enFill} ${enShape}${cell.n > 1 ? 's' : ''}${enTail}`];
}
const cellChoice = (cell: AptCell): Choice => ({ t: cellText(cell), cell });

type Rule = 'const' | 'row' | 'col' | 'latin' | 'latin2';
const ATTR_NAMES: Record<'shape' | 'n' | 'fill' | 'rot', Tx> = { shape: ['形状', 'Shape'], n: ['数量', 'Count'], fill: ['颜色', 'Shading'], rot: ['方向', 'Rotation'] };

function matrix(r: R): Draft {
  const shapes = shuffle(r, ['tri', 'arrow', 'flag', 'ell'] as AptShape[]);
  const values = { shape: shapes.slice(0, 3), n: shuffle(r, [1, 2, 3]), fill: shuffle(r, [0, 1, 2]) };
  const attrs = ['shape', 'n', 'fill', 'rot'] as const;
  const varying = new Set(shuffle(r, [...attrs]).slice(0, int(r, 2, 3)));
  const rules = Object.fromEntries(
    attrs.map((a) => [a, varying.has(a) ? pick(r, a === 'rot' ? ['col', 'latin'] : ['col', 'latin', 'latin2']) : pick(r, ['const', 'row'])]),
  ) as Record<(typeof attrs)[number], Rule>;
  const base = 90 * int(r, 0, 3);
  const at = (rule: Rule, row: number, col: number) =>
    ({ const: 0, row, col, latin: (row + col) % 3, latin2: (row + 2 * col) % 3 })[rule];
  const cellAt = (row: number, col: number): AptCell => ({
    shape: values.shape[at(rules.shape, row, col)],
    n: values.n[at(rules.n, row, col)],
    fill: values.fill[at(rules.fill, row, col)],
    // Rotation steps 90° per column ('col'), per row and column ('latin'), or per row ('row').
    rot: norm(base + 90 * (rules.rot === 'col' ? col : rules.rot === 'latin' ? row + col : rules.rot === 'row' ? row : 0)),
  });
  const answer = cellAt(2, 2);
  const cells = range(9).map((i) => (i === 8 ? null : cellAt(Math.floor(i / 3), i % 3)));
  // Each wrong choice changes exactly one attribute of the answer.
  const wrong = shuffle(r, [...attrs]).map((a): AptCell => {
    if (a === 'shape') return { ...answer, shape: pick(r, shapes.filter((s) => s !== answer.shape)) };
    if (a === 'n') return { ...answer, n: pick(r, [1, 2, 3].filter((n) => n !== answer.n)) };
    if (a === 'fill') return { ...answer, fill: pick(r, [0, 1, 2].filter((x) => x !== answer.fill)) };
    return { ...answer, rot: norm(answer.rot + 90 * int(r, 1, 3)) };
  });
  const list = (a: 'shape' | 'n' | 'fill', zh: boolean) =>
    (values[a] as (AptShape | number)[])
      .map((v) => (a === 'shape' ? SHAPE_NAMES[v as AptShape][zh ? 0 : 1] : a === 'fill' ? FILL_NAMES[v as number][zh ? 0 : 1] : String(v)))
      .join(zh ? '、' : ', ');
  const ruleText = (a: (typeof attrs)[number]): Tx => {
    const [zhName, enName] = ATTR_NAMES[a];
    const rule = rules[a];
    if (a === 'rot')
      return rule === 'const'
        ? [`${zhName}都一样`, `${enName}: the same everywhere`]
        : rule === 'row'
          ? [`${zhName}：每往下一行顺时针转 90°`, `${enName}: 90° clockwise per row down`]
          : rule === 'col'
            ? [`${zhName}：每往右一格顺时针转 90°`, `${enName}: 90° clockwise per step right`]
            : [`${zhName}：每往右一格、每往下一行都顺时针转 90°`, `${enName}: 90° clockwise per step right and per row down`];
    if (rule === 'const') return [`${zhName}都一样`, `${enName}: the same everywhere`];
    if (rule === 'row') return [`${zhName}：每行一种`, `${enName}: one per row`];
    if (rule === 'col') return [`${zhName}：每列一种（从左到右 ${list(a, true)}）`, `${enName}: one per column (${list(a, false)} left to right)`];
    return [`${zhName}：${list(a, true)}在每行每列各出现一次`, `${enName}: ${list(a, false)} once in every row and every column`];
  };
  const rulesText = attrs.map(ruleText);
  return {
    fig: { kind: 'matrix', cells },
    q: ['3×3 图形矩阵里，每一行都按同样的规律变化。右下角空着的一格应该是哪个？', 'In the 3×3 grid every row follows the same rules. Which figure belongs in the empty bottom-right cell?'],
    right: cellChoice(answer),
    wrong: wrong.map(cellChoice),
    explain: [
      `${rulesText.map((t) => t[0]).join('；')}。所以缺的一格是 ${cellText(answer)[0]}。每个错误选项只改了其中一项。`,
      `${rulesText.map((t) => t[1]).join('; ')}. So the missing cell is ${cellText(answer)[1]}. Each wrong option changes just one of these.`,
    ],
  };
}

/** Orientation maths: a cell is "flip (left-right), then turn rot clockwise". */
const turn = (c: AptCell, deg: number): AptCell => ({ ...c, rot: norm(c.rot + deg) });
const mirrorV = (c: AptCell): AptCell => ({ ...c, rot: norm(-c.rot), flip: !c.flip });
const mirrorH = (c: AptCell): AptCell => ({ ...c, rot: norm(180 - c.rot), flip: !c.flip });
/** Shapes with no symmetry at all, so the 8 turns and mirror images all look different. */
const LOPSIDED: AptShape[] = ['flag', 'ell', 'eff'];

function rotate(r: R): Draft {
  const from: AptCell = { shape: pick(r, LOPSIDED), n: 1, fill: 1, rot: 90 * int(r, 0, 3), flip: r() < 0.5 };
  const deg = pick(r, [90, 180, 270]);
  const how: Tx = deg === 90 ? ['顺时针旋转 90°', 'turned 90° clockwise'] : deg === 270 ? ['逆时针旋转 90°', 'turned 90° anticlockwise'] : ['旋转 180°', 'turned 180°'];
  const answer = turn(from, deg);
  const side: Tx = deg === 90 ? ['右边', 'right'] : deg === 180 ? ['下边', 'bottom'] : ['左边', 'left'];
  return {
    fig: { kind: 'transform', from },
    q: [`左边的图形${how[0]}后是哪一个？`, `Which option shows the figure ${how[1]}?`],
    right: cellChoice(answer),
    wrong: [turn(from, -deg), mirrorV(answer), mirrorH(answer), turn(from, deg + 90)].map(cellChoice),
    explain: [
      `${how[0]}后，图形原来的顶端转到${side[0]}。镜像（翻转过的）图形怎么转都得不到，可以先排除。`,
      `${how[1][0].toUpperCase()}${how[1].slice(1)}, the top of the figure ends up on the ${side[1]}. A mirror image can never be reached by turning, so rule those out first.`,
    ],
  };
}

function mirror(r: R): Draft {
  const from: AptCell = { shape: pick(r, LOPSIDED), n: 1, fill: 1, rot: 90 * int(r, 0, 3), flip: r() < 0.5 };
  const axis = r() < 0.5 ? 'v' : 'h';
  const answer = axis === 'v' ? mirrorV(from) : mirrorH(from);
  return {
    fig: { kind: 'transform', from, axis },
    q:
      axis === 'v'
        ? ['一面镜子竖着立在图形右边（虚线）。镜子里的像是哪一个？', 'A mirror stands upright to the right of the figure (dashed line). Which option is its mirror image?']
        : ['一面镜子平放在图形下方（虚线），像水中倒影。镜子里的像是哪一个？', 'A mirror lies flat below the figure (dashed line), like the surface of water. Which option is its reflection?'],
    right: cellChoice(answer),
    wrong: [axis === 'v' ? mirrorH(from) : mirrorV(from), turn(from, 180), from, turn(answer, 90)].map(cellChoice),
    explain:
      axis === 'v'
        ? ['竖着的镜子只把左右对调，上下不变。转 180° 会把上下也对调，那不是镜像。', 'An upright mirror swaps left and right and keeps top and bottom. Turning 180° swaps top and bottom as well, so it is not the mirror image.']
        : ['平放的镜子只把上下对调，左右不变。转 180° 会把左右也对调，那不是倒影。', 'A flat mirror swaps top and bottom and keeps left and right. Turning 180° swaps left and right as well, so it is not the reflection.'],
  };
}

const GEN: Record<AptKind, (r: R) => Draft | null> = {
  percent, profit, ratio: ratioQ, work, speed, interest, chart, series, coding, syllogism, seating, direction, matrix, rotate, mirror,
};
const TOPIC = Object.fromEntries(APT_GROUPS.flatMap((g) => g.kinds.map((k) => [k, g.topic]))) as Record<AptKind, string>;
const ID = /^apt-([a-z]+)-(0|[1-9]\d{0,9})$/;

/** The kind of an aptitude id, or null when it is not one. */
export function aptKind(id: string): AptKind | null {
  const m = ID.exec(id);
  return m && Object.hasOwn(GEN, m[1]) && +m[2] <= 0xffffffff ? (m[1] as AptKind) : null;
}

/**
 * The question `apt-<kind>-<seed>`, the same every time; null for an unknown kind or seed. A
 * draft whose options collide is drawn again from the same stream, at most 20 times.
 */
export function aptitudeById(id: string): AptQuestion | null {
  const kind = aptKind(id);
  if (!kind) return null;
  const r = seededRandom(+id.slice(id.lastIndexOf('-') + 1));
  for (let attempt = 0; attempt < 20; attempt++) {
    const draft = GEN[kind](r);
    if (!draft) continue;
    const chosen = [draft.right];
    for (const c of draft.wrong)
      if (chosen.length < 4 && chosen.every((o) => o.t[0] !== c.t[0] && o.t[1] !== c.t[1])) chosen.push(c);
    if (chosen.length < 4) continue;
    const order = shuffle(r, [0, 1, 2, 3]);
    const choices = order.map((i) => chosen[i]);
    const drawn = draft.fig;
    const fig: AptFig | undefined = !drawn || drawn.kind === 'bars' ? drawn : { ...drawn, choices: choices.map((c) => c.cell!) };
    return {
      id,
      section: 'quant',
      topic: TOPIC[kind],
      zh: { q: draft.q[0], choices: choices.map((c) => c.t[0]), explain: draft.explain[0] },
      en: { q: draft.q[1], choices: choices.map((c) => c.t[1]), explain: draft.explain[1] },
      answer: [order.indexOf(0)],
      ...(fig && { fig }),
    };
  }
  return null;
}

// ---------------------------------------------------------------- speed test

/** 50 questions in 15 minutes, 18 s each on average; a wrong answer costs a third with negative marking. */
export const SPEED = { count: 50, minutes: 15, perQ: 18_000, penalty: 1 / 3, sections: [18, 18, 14] } as const;
export const SPEED_SECTION_NAMES: Tx[] = [['数量与图表', 'Numbers & charts'], ['逻辑', 'Logic'], ['图形', 'Figures']];
const SECTION_KINDS: AptKind[][] = [
  [...APT_GROUPS[0].kinds, 'chart'],
  [...APT_GROUPS[2].kinds],
  [...APT_GROUPS[3].kinds],
];
/** Which speed-test section an id belongs to: 0 numbers and charts, 1 logic, 2 figures. */
export const aptSection = (id: string) => SECTION_KINDS.findIndex((kinds) => kinds.includes(aptKind(id)!));

/** The test's 50 ids: 18 numbers and charts, 18 logic, 14 figures; mixed unless `sectioned`. */
export function speedSet(seed: number, sectioned = false) {
  const r = seededRandom(seed);
  const ids: string[] = [];
  SPEED.sections.forEach((count, s) => {
    const kinds = shuffle(r, [...SECTION_KINDS[s]]);
    for (let i = 0; i < count; i++) {
      let id: string;
      do id = `apt-${kinds[i % kinds.length]}-${Math.floor(r() * 2 ** 32)}`;
      while (ids.includes(id) || !aptitudeById(id));
      ids.push(id);
    }
  });
  return sectioned ? ids : shuffle(r, ids);
}

/** Right, wrong, skipped (or never reached) and the net score; wrong costs SPEED.penalty when `negative`. */
export function scoreSpeed(ids: readonly string[], picks: readonly (number | null)[], negative: boolean) {
  let correct = 0;
  let wrong = 0;
  ids.forEach((id, i) => {
    const pick = picks[i];
    if (pick === null || pick === undefined) return;
    if (aptitudeById(id)?.answer[0] === pick) correct++;
    else wrong++;
  });
  return { correct, wrong, skipped: ids.length - correct - wrong, net: correct - (negative ? wrong * SPEED.penalty : 0) };
}

export type PaceAdvice = 'out-of-time' | 'skip-sooner' | 'drill-kinds' | 'on-pace';
/**
 * Where the time went: each section's average seconds, kinds averaging over 1.5× the pace (27 s),
 * questions over 2× (36 s) that still went wrong, and how many were never reached.
 */
export function paceReport(ids: readonly string[], picks: readonly (number | null)[], ms: readonly (number | null)[]) {
  const sections = SPEED.sections.map((_, s) => {
    const shown = ids.flatMap((id, i) => (aptSection(id) === s && ms[i] !== null && ms[i] !== undefined ? [ms[i]!] : []));
    return { shown: shown.length, avg: shown.length ? shown.reduce((a, b) => a + b, 0) / shown.length / 1000 : 0 };
  });
  const byKind = new Map<AptKind, number[]>();
  ids.forEach((id, i) => {
    if (ms[i] === null || ms[i] === undefined) return;
    const kind = aptKind(id)!;
    byKind.set(kind, [...(byKind.get(kind) ?? []), ms[i]!]);
  });
  const slowKinds = [...byKind]
    .filter(([, times]) => times.reduce((a, b) => a + b, 0) / times.length > SPEED.perQ * 1.5)
    .map(([kind]) => kind);
  const slowWrong = ids.flatMap((id, i) =>
    (ms[i] ?? 0) > SPEED.perQ * 2 && picks[i] !== null && picks[i] !== undefined && aptitudeById(id)?.answer[0] !== picks[i] ? [i] : [],
  );
  const unreached = ids.filter((_, i) => ms[i] === null || ms[i] === undefined).length;
  const advice: PaceAdvice[] = [];
  if (unreached) advice.push('out-of-time');
  if (slowWrong.length) advice.push('skip-sooner');
  if (slowKinds.length) advice.push('drill-kinds');
  if (!advice.length) advice.push('on-pace');
  return { sections, slowKinds, slowWrong, unreached, advice };
}

/**
 * The MCQ review after answering an aptitude question: only a miss, or a question already in the
 * review, is written, so right answers to fresh questions do not fill the 20 KB `mcq:answers` note.
 * Returns `review` itself when nothing changes.
 */
export function aptReview(review: McqReview, id: string, answer: readonly number[], picks: number[], today: number) {
  if (mcqRight(answer, picks) && !review[id]) return review;
  return { ...review, [id]: reviewMcq(review[id], answer, picks, today) };
}

/** A speed test in progress (or finished), as kept in this browser. */
export type SpeedState = {
  seed: number;
  negative: boolean;
  sectioned: boolean;
  startedAt: number;
  /** When the current section started (sectioned): its time left does not carry over. */
  secAt: number;
  at: number;
  picks: (number | null)[];
  /** Time on each question; null = never reached. */
  ms: (number | null)[];
  shownAt: number;
  finishedAt?: number;
  /** Misses already written to the review. */
  saved?: boolean;
};
export const SPEED_KEY = 'cswork:apt-speed:v1';

export function newSpeed(seed: number, negative: boolean, sectioned: boolean, now: number): SpeedState {
  return { seed, negative, sectioned, startedAt: now, secAt: now, at: 0, picks: Array(SPEED.count).fill(null), ms: Array(SPEED.count).fill(null), shownAt: now };
}
/** The section the question at `at` is in (by position: sectioned tests keep the sections in order). */
const sectionAt = (at: number) => (at < SPEED.sections[0] ? 0 : at < SPEED.sections[0] + SPEED.sections[1] ? 1 : 2);
const sectionEnd = (s: number) => SPEED.sections.slice(0, s + 1).reduce((a, b) => a + b, 0);
/** When the current question's clock runs out: the whole test's, or its section's. */
export function speedDeadline(s: SpeedState) {
  return s.sectioned ? s.secAt + SPEED.sections[sectionAt(s.at)] * SPEED.perQ : s.startedAt + SPEED.minutes * 60_000;
}
/** Moves past the current question at `now` (Next or Skip: the pick is in `picks[at]`). */
export function speedStep(s: SpeedState, now: number, jump = s.at + 1): SpeedState {
  const ms = [...s.ms];
  ms[s.at] = now - s.shownAt;
  const at = Math.min(jump, SPEED.count);
  const newSection = s.sectioned && at < SPEED.count && sectionAt(at) !== sectionAt(s.at);
  return { ...s, ms, at, shownAt: now, secAt: newSection ? now : s.secAt, ...(at >= SPEED.count && { finishedAt: now }) };
}
/** Applies every clock that ran out by `now`: a section ends (sectioned) or the test is handed in. */
export function speedSettle(s: SpeedState, now: number): SpeedState {
  let t = s;
  while (!t.finishedAt && now >= speedDeadline(t)) {
    const end = speedDeadline(t);
    t = speedStep(t, end, t.sectioned ? sectionEnd(sectionAt(t.at)) : SPEED.count);
  }
  return t;
}
/** A stored test, or null when missing or malformed. */
export function parseSpeed(raw: string | null): SpeedState | null {
  try {
    const s = JSON.parse(raw || 'null') as SpeedState;
    const slots = (xs: unknown) => Array.isArray(xs) && xs.length === SPEED.count && xs.every((x) => x === null || Number.isInteger(x));
    return s && Number.isInteger(s.seed) && [s.startedAt, s.secAt, s.at, s.shownAt].every(Number.isFinite) && s.at >= 0 && s.at <= SPEED.count && slots(s.picks) && slots(s.ms)
      ? { ...s, negative: !!s.negative, sectioned: !!s.sectioned }
      : null;
  } catch {
    return null;
  }
}
