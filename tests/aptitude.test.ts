// Aptitude questions (lib/aptitude.ts): every kind over 500 seeds is reproducible, has four distinct
// choices in both languages and one answer; each answer is recomputed here from the question text
// (numbers by formula, syllogisms by the classical rules, seating by brute force, figures by
// moving the polygon's points); plus the speed test's set, score, pacing and the review rule.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APT_POINTS } from '../components/aptitude-figure';
import {
  APT_KINDS,
  SPEED,
  aptKind,
  aptReview,
  aptSection,
  aptitudeById,
  newSpeed,
  paceReport,
  scoreSpeed,
  speedSet,
  speedSettle,
  speedStep,
  type AptCell,
  type AptKind,
  type AptQuestion,
} from '../lib/aptitude';

const SEEDS = 500;
const all = (kind: AptKind) => Array.from({ length: SEEDS }, (_, s) => aptitudeById(`apt-${kind}-${s * 7919 + 13}`)!);
const right = (q: AptQuestion) => q.en.choices[q.answer[0]];
const fmt = (x: number) => {
  const v = Math.round(x * 10) / 10 || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};
const exact = (x: number) => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const ratio = (a: number, b: number) => `${a / gcd(a, b)} : ${b / gcd(a, b)}`;

test('every kind: same seed, same question; four distinct choices in both languages; one valid answer', () => {
  for (const kind of APT_KINDS) {
    for (let s = 0; s < SEEDS; s++) {
      const id = `apt-${kind}-${s * 7919 + 13}`;
      const q = aptitudeById(id);
      assert.ok(q, id);
      assert.deepEqual(aptitudeById(id), q, `${id} reproducible`);
      assert.equal(q.id, id);
      assert.equal(q.section, 'quant');
      assert.match(q.topic, /^apt-(num|data|logic|fig)$/);
      assert.equal(q.answer.length, 1);
      assert.ok(q.answer[0] >= 0 && q.answer[0] < 4, id);
      for (const lang of ['zh', 'en'] as const) {
        assert.equal(q[lang].choices.length, 4, id);
        assert.equal(new Set(q[lang].choices).size, 4, `${id} ${lang}: ${q[lang].choices.join(' | ')}`);
        assert.ok(q[lang].q && q[lang].explain, id);
        // Answers (and the rest) are whole or one decimal.
        for (const c of q[lang].choices) assert.doesNotMatch(c, /\d\.\d\d/, `${id}: ${c}`);
      }
      if (q.fig && q.fig.kind !== 'bars') assert.equal(q.fig.choices.length, 4, id);
    }
  }
});

test('ids: only known kinds and canonical seeds', () => {
  for (const bad of ['apt-nope-1', 'apt-percent-01', 'apt-percent-4294967296', 'apt-percent-', 'apt-percent-1x', 'mcq-os-1', 'apt-Percent-1'])
    assert.equal(aptitudeById(bad), null, bad);
  assert.equal(aptKind('apt-seating-4294967295'), 'seating');
  assert.ok(aptitudeById('apt-percent-0'));
});

/** The en question's answer worked out again from its text alone. */
function solve(q: AptQuestion): string {
  const s = q.en.q;
  let m: RegExpExecArray | null;
  const change = (x: number) => (x > 0 ? `${fmt(x)}% increase` : x < 0 ? `${fmt(-x)}% decrease` : 'No change');
  const pl = (x: number) => (x > 0 ? `${fmt(x)}% profit` : x < 0 ? `${fmt(-x)}% loss` : 'No profit, no loss');
  const checked = (x: number) => {
    assert.ok(exact(x), `${s} → ${x} is not whole or one decimal`);
    return fmt(x);
  };
  if ((m = /^A price is first (raised|cut) by (\d+)% and then (raised|cut) by (\d+)%/.exec(s))) {
    const a = (m[1] === 'raised' ? 1 : -1) * +m[2];
    const b = (m[3] === 'raised' ? 1 : -1) * +m[4];
    const net = (1 + a / 100) * (1 + b / 100) * 100 - 100;
    checked(Math.round(net * 1e6) / 1e6);
    return change(Math.round(net * 1e6) / 1e6);
  }
  const less = (x: number) => (100 * x) / (100 + x);
  const more = (y: number) => (100 * y) / (100 - y);
  if ((m = /^A earns ([\d.]+)% more than B/.exec(s)) || (m = /^The price of rice goes up by ([\d.]+)%/.exec(s)) || (m = /^A car's speed goes up by ([\d.]+)%/.exec(s)))
    return `${checked(less(+m[1]))}%`;
  if ((m = /^B earns ([\d.]+)% less than A/.exec(s)) || (m = /^The price of rice falls by ([\d.]+)%/.exec(s)) || (m = /^A car's speed falls by ([\d.]+)%/.exec(s)))
    return `${checked(more(+m[1]))}%`;
  if ((m = /marks an item (\d+)% above cost, then sells it at (\d+)% off/.exec(s))) {
    const net = ((100 + +m[1]) * (100 - +m[2])) / 100 - 100;
    checked(net);
    return pl(net);
  }
  if ((m = /^An item sells for \$(\d+), a (\d+)% (profit|loss) on its cost/.exec(s)))
    return `$${checked((+m[1] * 100) / (100 + (m[3] === 'profit' ? 1 : -1) * +m[2]))}`;
  if ((m = /^The cost price of (\d+) pens equals the selling price of (\d+) pens/.exec(s))) {
    const net = ((+m[1] - +m[2]) / +m[2]) * 100;
    checked(net);
    return pl(net);
  }
  if ((m = /^\$(\d+) is shared among A, B and C in the ratio (\d+) : (\d+) : (\d+)\. How much does ([ABC]) get/.exec(s))) {
    const parts = [+m[2], +m[3], +m[4]];
    return `$${checked((+m[1] * parts['ABC'.indexOf(m[5])]) / (parts[0] + parts[1] + parts[2]))}`;
  }
  if ((m = /^Rice at \$(\d+)\/kg is mixed with rice at \$(\d+)\/kg to make a mixture worth \$(\d+)\/kg/.exec(s)))
    return ratio(+m[2] - +m[3], +m[3] - +m[1]);
  if ((m = /ages are in the ratio (\d+) : (\d+)\. In (\d+) years the ratio will be (\d+) : (\d+)/.exec(s))) {
    const [p, qq, t, r1, r2] = m.slice(1).map(Number);
    const ks = Array.from({ length: 100 }, (_, k) => k + 1).filter((k) => (p * k + t) * r2 === (qq * k + t) * r1);
    assert.equal(ks.length, 1, s);
    return String(p * ks[0]);
  }
  if ((m = /^A can do a job alone in (\d+) days and B in (\d+) days/.exec(s))) return `${checked((+m[1] * +m[2]) / (+m[1] + +m[2]))} days`;
  if ((m = /^A and B finish a job together in ([\d.]+) days; A alone takes (\d+) days/.exec(s)))
    return `${checked((+m[2] * +m[1]) / (+m[2] - +m[1]))} days`;
  if ((m = /^Pipe A fills a tank in (\d+) hours; pipe B empties it in (\d+) hours/.exec(s))) return `${checked((+m[1] * +m[2]) / (+m[2] - +m[1]))} hours`;
  if ((m = /at (\d+) km\/h and comes back the same way at (\d+) km\/h/.exec(s))) return `${checked((2 * +m[1] * +m[2]) / (+m[1] + +m[2]))} km/h`;
  const ms = (kmh: number) => (kmh * 1000) / 3600;
  if ((m = /^A (\d+) m train runs at (\d+) km\/h\. How many seconds does it take to pass a pole/.exec(s))) return `${checked(+m[1] / ms(+m[2]))} s`;
  if ((m = /^A (\d+) m train running at (\d+) km\/h passes a (\d+) m platform/.exec(s))) return `${checked((+m[1] + +m[3]) / ms(+m[2]))} s`;
  if ((m = /^Two trains, (\d+) m and (\d+) m long, run towards each other at (\d+) km\/h and (\d+) km\/h/.exec(s)))
    return `${checked((+m[1] + +m[2]) / ms(+m[3] + +m[4]))} s`;
  if ((m = /one (\d+) m long at (\d+) km\/h, the other (\d+) m long at (\d+) km\/h/.exec(s)))
    return `${checked((+m[1] + +m[3]) / ms(+m[2] - +m[4]))} s`;
  if ((m = /^A boat goes (\d+) km downstream in (\d+) hours and (\d+) km upstream in (\d+) hours\. What is (the boat's speed in still water|the speed of the current)/.exec(s))) {
    const [down, up] = [+m[1] / +m[2], +m[3] / +m[4]];
    return `${checked(m[5].includes('still') ? (down + up) / 2 : (down - up) / 2)} km/h`;
  }
  if ((m = /^\$(\d+) is invested at (\d+)% a year simple interest for (\d+) years\. (What is the total|How much interest)/.exec(s))) {
    const si = (+m[1] * +m[2] * +m[3]) / 100;
    return `$${checked(m[4] === 'What is the total' ? +m[1] + si : si)}`;
  }
  if ((m = /^\$(\d+) is invested at (\d+)% a year, compounded annually, for 2 years/.exec(s)))
    return `$${checked(Math.round(+m[1] * ((1 + +m[2] / 100) ** 2 - 1) * 1e6) / 1e6)}`;
  if ((m = /^At (\d+)% a year for 2 years, interest compounded annually beats simple interest on a sum by \$(\d+(?:\.\d)?)\./.exec(s)))
    return `$${checked(Math.round((+m[2] / (+m[1] / 100) ** 2) * 1e6) / 1e6)}`;
  if ((m = /^At ([\d.]+)% a year simple interest, how many years does a sum take to (double|triple)/.exec(s)))
    return `${checked(((m[2] === 'double' ? 1 : 2) * 100) / +m[1])} years`;
  if ((m = /^\S+ walks (\d+) m (north|east|south|west)/.exec(s))) {
    const dirs = ['north', 'east', 'south', 'west'];
    const step: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    let d = dirs.indexOf(m[2]);
    let [x, y] = [step[d][0] * +m[1], step[d][1] * +m[1]];
    for (const leg of s.matchAll(/turns (right|left) and walks (\d+) m/g)) {
      d = (d + (leg[1] === 'right' ? 1 : 3)) % 4;
      x += step[d][0] * +leg[2];
      y += step[d][1] * +leg[2];
    }
    const dist = Math.hypot(x, y);
    assert.ok(Number.isInteger(dist) && x && y, s);
    return `${dist} m, ${y > 0 ? 'north' : 'south'}-${x > 0 ? 'east' : 'west'}`;
  }
  throw new Error(`no solver for: ${s}`);
}

test('numerical kinds and directions: each answer recomputed from the question text', () => {
  for (const kind of ['percent', 'profit', 'ratio', 'work', 'speed', 'interest', 'direction'] as const)
    for (const q of all(kind)) assert.equal(right(q), solve(q), q.id);
});

test('bar charts: the answer recomputed from the plotted values', () => {
  for (const q of all('chart')) {
    assert.ok(q.fig?.kind === 'bars');
    const { labels, series } = q.fig;
    const v = (year: string) => series[labels.indexOf(year)];
    let m: RegExpExecArray | null;
    let want: string;
    if ((m = /change from (\d+) to (\d+)\?/.exec(q.en.q))) {
      const g = ((v(m[2]) - v(m[1])) / v(m[1])) * 100;
      assert.ok(exact(g), q.id);
      want = g > 0 ? `${fmt(g)}% increase` : `${fmt(-g)}% decrease`;
    } else if ((m = /ratio of sales in (\d+) to sales in (\d+)\?/.exec(q.en.q))) want = ratio(v(m[1]), v(m[2]));
    else if (/average annual sales/.test(q.en.q)) want = fmt(series.reduce((a, b) => a + b, 0) / 5);
    else {
      const rises = series.slice(1).map((x, i) => x - series[i]);
      const best = Math.max(...rises);
      assert.equal(rises.filter((d) => d === best).length, 1, q.id);
      want = labels[rises.indexOf(best) + 1];
    }
    assert.equal(right(q), want, q.id);
  }
});

test('series: every rule that fits the terms predicts the answer, and none predicts a wrong choice', () => {
  for (const q of all('series')) {
    const t = /next\? (.+), \?$/.exec(q.en.q)![1].split(', ').map(Number);
    const n = t.length;
    const preds: number[] = [];
    const diffs = t.slice(1).map((x, i) => x - t[i]);
    if (diffs.every((d) => d === diffs[0])) preds.push(t[n - 1] + diffs[0]);
    if (t.every((x) => x !== 0) && t.slice(1).every((x, i) => x / t[i] === t[1] / t[0]) && Number.isInteger(t[1] / t[0])) preds.push((t[n - 1] * t[1]) / t[0]);
    const d2 = diffs.slice(1).map((x, i) => x - diffs[i]);
    if (d2.every((d) => d === d2[0])) preds.push(t[n - 1] + diffs[diffs.length - 1] + d2[0]);
    const odd = t.filter((_, i) => i % 2 === 0);
    const even = t.filter((_, i) => i % 2 === 1);
    const arith = (xs: number[]) => xs.length >= 3 && xs.slice(1).every((x, i) => x - xs[i] === xs[1] - xs[0]);
    if (n % 2 === 0 && arith(odd) && arith(even)) preds.push(odd[odd.length - 1] + odd[1] - odd[0]);
    for (const k of [2, 3])
      if (t.slice(1).every((x, i) => x === k * t[i] + (t[1] - k * t[0]))) preds.push(k * t[n - 1] + (t[1] - k * t[0]));
    if (t.slice(2).every((x, i) => x === t[i] + t[i + 1])) preds.push(t[n - 1] + t[n - 2]);
    for (const p of [2, 3])
      for (let s = 0; s <= 10; s++) {
        const c = t[0] - s ** p;
        if (t.every((x, i) => x === (s + i) ** p + c)) preds.push((s + n) ** p + c);
      }
    assert.ok(preds.length, `${q.id}: no rule fits ${t}`);
    for (const p of preds) assert.equal(String(p), right(q), `${q.id}: ${t} → ${preds}`);
  }
});

test('letter codes: the one rule that maps the example word gives the answer and no other choice', () => {
  const shift = (w: string, k: (i: number) => number) => [...w].map((c, i) => String.fromCharCode(65 + ((((c.charCodeAt(0) - 65 + k(i)) % 26) + 26) % 26))).join('');
  const rules: ((w: string) => string)[] = [];
  for (let k = 1; k < 26; k++) {
    rules.push((w) => shift(w, () => k));
    rules.push((w) => shift([...w].reverse().join(''), () => k));
    rules.push((w) => shift(w, (i) => k + i));
  }
  for (const q of all('coding')) {
    const [, w1, c1, w2] = /^In a certain code, (\w+) is written as (\w+)\. How is (\w+) written/.exec(q.en.q)!;
    const fits = rules.filter((rule) => rule(w1) === c1).map((rule) => rule(w2));
    assert.ok(fits.length, q.id);
    for (const answer of fits) assert.equal(answer, right(q), q.id);
  }
});

test('syllogisms: exactly the answer passes the classical rules (every group non-empty)', () => {
  const names = 'painters|singers|runners|writers|chess players|cooks|drivers|poets|dancers|doctors';
  const statement = new RegExp(`^(All|No|Some) (${names}) are (not )?(${names})$`);
  type S = { form: 'all' | 'no' | 'some' | 'not'; x: string; y: string };
  const parse = (text: string): S => {
    const m = statement.exec(text)!;
    assert.ok(m, text);
    return { form: m[1] === 'All' ? 'all' : m[1] === 'No' ? 'no' : m[3] ? 'not' : 'some', x: m[2], y: m[4] };
  };
  const distributed = (s: S) => ({ all: [s.x], no: [s.x, s.y], some: [], not: [s.y] })[s.form];
  const negative = (s: S) => s.form === 'no' || s.form === 'not';
  // Aristotelian validity (existential import): middle distributed once; nothing distributed in the
  // conclusion that is not distributed in its premise; negative premises = negative conclusion, at most one.
  const valid = (p: S[], c: S) => {
    const middle = [p[0].x, p[0].y].find((t) => t === p[1].x || t === p[1].y)!;
    if (!p.some((s) => distributed(s).includes(middle))) return false;
    for (const term of distributed(c)) if (!p.some((s) => (s.x === term || s.y === term) && distributed(s).includes(term))) return false;
    return p.filter(negative).length === (negative(c) ? 1 : 0);
  };
  for (const q of all('syllogism')) {
    const m = /\(1\) (.+)\. \(2\) (.+)\. Which/.exec(q.en.q)!;
    const premises = [parse(m[1]), parse(m[2])];
    const follows = q.en.choices.map((c) => valid(premises, parse(c)));
    assert.deepEqual(
      follows.map((v, i) => (v ? i : -1)).filter((i) => i >= 0),
      q.answer,
      `${q.id}: ${q.en.q} ${q.en.choices.join(' | ')}`,
    );
  }
});

test('seating: brute force over all 120 seatings gives exactly the answer', () => {
  const perms = (xs: number[]): number[][] => (xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms(xs.filter((_, j) => j !== i)).map((p) => [x, ...p])));
  const seatings = perms([0, 1, 2, 3, 4]); // seatings[k][seat] = person
  for (const q of all('seating')) {
    const intro = /^(.+) sit in a row of seats numbered 1–5 from left to right\. (.+)$/.exec(q.en.q)!;
    const people = intro[1].replace(' and ', ', ').split(', ');
    assert.equal(people.length, 5, q.id);
    const who = (name: string) => people.indexOf(name);
    const sentences = intro[2].split(/(?<=[.?])\s/);
    const ask = sentences.pop()!;
    const tests = sentences.map((c) => {
      let m: RegExpExecArray | null;
      if ((m = /^(\w+) sits at one of the ends\.$/.exec(c))) { const x = who(m[1]); return (s: number[]) => s[0] === x || s[4] === x; }
      if ((m = /^(\w+) does not sit at either end\.$/.exec(c))) { const x = who(m[1]); return (s: number[]) => s[0] !== x && s[4] !== x; }
      if ((m = /^(\w+) sits in seat (\d)\.$/.exec(c))) { const x = who(m[1]), k = +m[2] - 1; return (s: number[]) => s[k] === x; }
      if ((m = /^(\w+) sits immediately to the left of (\w+)\.$/.exec(c))) { const [x, y] = [who(m[1]), who(m[2])]; return (s: number[]) => s.indexOf(y) - s.indexOf(x) === 1; }
      if ((m = /^(\w+) sits next to (\w+)\.$/.exec(c))) { const [x, y] = [who(m[1]), who(m[2])]; return (s: number[]) => Math.abs(s.indexOf(y) - s.indexOf(x)) === 1; }
      if ((m = /^(\w+) does not sit next to (\w+)\.$/.exec(c))) { const [x, y] = [who(m[1]), who(m[2])]; return (s: number[]) => Math.abs(s.indexOf(y) - s.indexOf(x)) !== 1; }
      if ((m = /^Exactly one person sits between (\w+) and (\w+)\.$/.exec(c))) { const [x, y] = [who(m[1]), who(m[2])]; return (s: number[]) => Math.abs(s.indexOf(y) - s.indexOf(x)) === 2; }
      if ((m = /^(\w+) sits somewhere to the left of (\w+)\.$/.exec(c))) { const [x, y] = [who(m[1]), who(m[2])]; return (s: number[]) => s.indexOf(x) < s.indexOf(y); }
      throw new Error(`${q.id}: unknown clue ${c}`);
    });
    let m = /^Who sits in seat (\d)\?$/.exec(ask);
    const answerOf = m
      ? ((k: number) => (s: number[]) => people[s[k]])(+m[1] - 1)
      : ((x: number) => (s: number[]) => people[s[s.indexOf(x) + 1]] ?? 'nobody')(who((m = /^Who sits immediately to the right of (\w+)\?$/.exec(ask))![1]));
    const answers = new Set(seatings.filter((s) => tests.every((fits) => fits(s))).map(answerOf));
    assert.deepEqual([...answers], [right(q)], `${q.id}: ${q.en.q}`);
  }
});

/** The polygon's corners as drawn: flipped left-right first, then turned clockwise (SVG, y down). */
function corners(cell: Pick<AptCell, 'shape' | 'rot' | 'flip'>) {
  return APT_POINTS[cell.shape].split(' ').map((p) => {
    let [x, y] = p.split(',').map(Number);
    if (cell.flip) x = 10 - x;
    const a = (cell.rot * Math.PI) / 180;
    const [dx, dy] = [x - 5, y - 5];
    return [5 + dx * Math.cos(a) - dy * Math.sin(a), 5 + dx * Math.sin(a) + dy * Math.cos(a)];
  });
}
const key = (pts: number[][]) => pts.map(([x, y]) => `${Math.round(x * 100) / 100 || 0},${Math.round(y * 100) / 100 || 0}`).sort().join(' ');

test('rotation and mirror images: moving the actual corners matches the answer and only the answer', () => {
  for (const kind of ['rotate', 'mirror'] as const)
    for (const q of all(kind)) {
      assert.ok(q.fig?.kind === 'transform', q.id);
      const { from, choices } = q.fig;
      let want: number[][];
      const pts = corners(from);
      if (kind === 'rotate') {
        const deg = /90° clockwise/.test(q.en.q) ? 90 : /anticlockwise/.test(q.en.q) ? -90 : 180;
        const a = (deg * Math.PI) / 180;
        want = pts.map(([x, y]) => [5 + (x - 5) * Math.cos(a) - (y - 5) * Math.sin(a), 5 + (x - 5) * Math.sin(a) + (y - 5) * Math.cos(a)]);
      } else want = pts.map(([x, y]) => (q.fig!.kind === 'transform' && q.fig.axis === 'v' ? [10 - x, y] : [x, 10 - y]));
      const keys = choices.map((c) => key(corners(c)));
      assert.equal(new Set(keys).size, 4, `${q.id}: two choices look the same`);
      assert.deepEqual(keys.flatMap((k, i) => (k === key(want) ? [i] : [])), q.answer, q.id);
    }
});

test('figure matrix: the answer completes a rule for every attribute; each wrong choice changes one attribute and breaks it', () => {
  const attrs = ['shape', 'n', 'fill', 'rot'] as const;
  const rows = (g: AptCell[], a: (typeof attrs)[number]) => [0, 1, 2].map((r) => [0, 1, 2].map((c) => g[r * 3 + c][a]));
  const ok = (g: AptCell[], a: (typeof attrs)[number]) => {
    const m = rows(g, a);
    const cols = [0, 1, 2].map((c) => m.map((r) => r[c]));
    const same = (xs: unknown[]) => xs.every((x) => x === xs[0]);
    const perm = (xs: unknown[]) => new Set(xs).size === 3;
    if (m.every(same) || cols.every(same)) return true;
    if (a !== 'rot') return m.every(perm) && cols.every(perm) && m.every((r) => [...r].sort().join() === [...m[0]].sort().join());
    const step = (xs: number[]) => xs.every((x, i) => i === 0 || (x - xs[i - 1] + 360) % 360 === 90);
    return m.every((r) => step(r as number[])) && (cols.every((c) => same(c)) || cols.every((c) => step(c as number[])));
  };
  for (const q of all('matrix')) {
    assert.ok(q.fig?.kind === 'matrix', q.id);
    const { cells, choices } = q.fig;
    assert.equal(cells[8], null);
    const grid = (last: AptCell) => [...cells.slice(0, 8), last] as AptCell[];
    const answer = choices[q.answer[0]];
    for (const a of attrs) assert.ok(ok(grid(answer), a), `${q.id}: ${a}`);
    choices.forEach((c, i) => {
      if (i === q.answer[0]) return;
      assert.equal(attrs.filter((a) => c[a] !== answer[a]).length, 1, q.id);
      assert.ok(attrs.some((a) => !ok(grid(c), a)), `${q.id}: choice ${i} also fits`);
    });
  }
});

test('speed set: 50 distinct ids, 18 / 18 / 14 per section, in order when sectioned', () => {
  for (const seed of [1, 42, 2 ** 31]) {
    const mixed = speedSet(seed);
    const split = speedSet(seed, true);
    assert.deepEqual(speedSet(seed), mixed);
    for (const ids of [mixed, split]) {
      assert.equal(ids.length, SPEED.count);
      assert.equal(new Set(ids).size, SPEED.count);
      assert.ok(ids.every((id) => aptitudeById(id)));
      assert.deepEqual([0, 1, 2].map((s) => ids.filter((id) => aptSection(id) === s).length), [18, 18, 14]);
    }
    assert.deepEqual(split.map(aptSection), [...Array(18).fill(0), ...Array(18).fill(1), ...Array(14).fill(2)]);
    assert.deepEqual([...mixed].sort(), [...split].sort());
  }
  assert.equal(SPEED.count * SPEED.perQ, SPEED.minutes * 60_000);
});

test('scoring: a third off per miss with negative marking, so guessing averages zero', () => {
  const ids = speedSet(7);
  const answers = ids.map((id) => aptitudeById(id)!.answer[0]);
  const picks = answers.map((a, i) => (i < 30 ? a : i < 39 ? (a + 1) % 4 : null));
  assert.deepEqual(scoreSpeed(ids, picks, false), { correct: 30, wrong: 9, skipped: 11, net: 30 });
  assert.deepEqual(scoreSpeed(ids, picks, true), { correct: 30, wrong: 9, skipped: 11, net: 27 });
  // One right and three wrong guesses out of four: expected net 0.
  assert.equal(1 - 3 * SPEED.penalty, 0);
});

test('pace report: slow kinds, slow misses, unreached questions and the advice', () => {
  const ids = speedSet(11);
  const answers = ids.map((id) => aptitudeById(id)!.answer[0]);
  const slow = ids.map((id) => aptKind(id) === 'seating');
  const ms = ids.map((_, i) => (i >= 45 ? null : slow[i] ? 40_000 : 10_000));
  const picks = answers.map((a, i) => (i >= 45 ? null : slow[i] ? (a + 1) % 4 : a));
  const pace = paceReport(ids, picks, ms);
  assert.deepEqual(pace.slowKinds, ['seating']);
  assert.deepEqual(pace.slowWrong, ids.flatMap((_, i) => (slow[i] && i < 45 ? [i] : [])));
  assert.equal(pace.unreached, 5);
  assert.deepEqual(pace.advice, ['out-of-time', 'skip-sooner', 'drill-kinds']);
  assert.equal(pace.sections.reduce((n, s) => n + s.shown, 0), 45);
  const calm = paceReport(ids, answers, ids.map(() => 15_000));
  assert.deepEqual(calm.advice, ['on-pace']);
  assert.deepEqual(calm.sections.map((s) => s.avg), [15, 15, 15]);
});

test('review: a right answer to a new question writes nothing; a miss, or one already in review, does', () => {
  const review = { 'mcq-os-1': [1, 100, 2] };
  assert.equal(aptReview(review, 'apt-percent-5', [2], [2], 200), review);
  assert.deepEqual(aptReview(review, 'apt-percent-5', [2], [1], 200), { ...review, 'apt-percent-5': [0, 200, 1] });
  const due = { 'apt-percent-5': [0, 199, 1] };
  assert.deepEqual(aptReview(due, 'apt-percent-5', [2], [2], 200), { 'apt-percent-5': [1, 200, 2] });
});

test('speed clock: next, a section running out does not lend its time, and time up hands the test in', () => {
  const t0 = 1_000_000;
  let s = newSpeed(3, true, true, t0);
  s = speedStep({ ...s, picks: [1, ...s.picks.slice(1)] }, t0 + 5_000);
  assert.equal(s.at, 1);
  assert.equal(s.ms[0], 5_000);
  // Section 1 is 18 × 18 s; it runs out with the learner on question 2.
  s = speedSettle(s, t0 + 18 * SPEED.perQ + 1);
  assert.equal(s.at, 18);
  assert.equal(s.secAt, t0 + 18 * SPEED.perQ);
  assert.equal(s.ms[1], 18 * SPEED.perQ - 5_000);
  assert.ok(s.ms.slice(2, 18).every((m) => m === null));
  // Finishing section 2 early starts section 3 with its own full 14 × 18 s, not the leftover.
  for (let i = 18; i < 36; i++) s = speedStep(s, s.shownAt + 1_000);
  assert.equal(s.at, 36);
  assert.equal(s.secAt, t0 + 18 * SPEED.perQ + 18_000);
  assert.equal(speedSettle(s, s.secAt + 14 * SPEED.perQ - 1), s);
  const done = speedSettle(s, s.secAt + 14 * SPEED.perQ);
  assert.equal(done.finishedAt, s.secAt + 14 * SPEED.perQ);
  // Mixed: one 15-minute clock.
  const mixed = speedSettle(newSpeed(3, false, false, t0), t0 + 15 * 60_000);
  assert.equal(mixed.finishedAt, t0 + 15 * 60_000);
  assert.equal(mixed.ms[0], 15 * 60_000);
  assert.equal(speedSettle(newSpeed(3, false, false, t0), t0 + 15 * 60_000 - 1).finishedAt, undefined);
});
