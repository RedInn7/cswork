// OS and networking simulators (lib/cs-sims.ts): textbook answers, brute-force cross-checks,
// RFC 793 state transitions, input limits, and the same frames in Chinese and English.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlgorithmDemo, DemoGraphView } from '../components/algorithm-demo';
import { demoKinds, type DemoTrace } from '../lib/algorithm-demo';
import {
  DEFAULT_ALLOC,
  DEFAULT_AVAIL,
  DEFAULT_EVENTS,
  DEFAULT_MAX,
  DEFAULT_PROCS,
  DEFAULT_REFS,
  MCQ_SIMS,
  banker,
  createSimTrace,
  cwnd,
  faultCurve,
  replace,
  schedule,
  simInputs,
  simKinds,
  slide,
  tcpSteps,
  type Proc,
  type ReplAlgo,
  type SchedAlgo,
  type SimKind,
  type TcpScenario,
  type TcpState,
} from '../lib/cs-sims';
import bank from '../lib/content/oa-mcq.json';

const CJK = /[一-鿿]/;
const procs = (spec: [number, number, number?][]): Proc[] =>
  spec.map(([arrive, burst, prio = 0], i) => ({ id: `P${i + 1}`, arrive, burst, prio }));
/** A small deterministic generator, so the brute-force checks see the same strings every run. */
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test('scheduling matches the textbook averages and keeps its conventions', () => {
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
  const three = procs([[0, 24], [0, 3], [0, 3]]);
  close(schedule(three, 'fcfs').avg.wait, 17);
  close(schedule(three, 'sjf').avg.wait, 3);
  close(schedule(three, 'rr', 4).avg.wait, 17 / 3);
  close(schedule(procs([[0, 8], [1, 4], [2, 9], [3, 5]]), 'srtf').avg.wait, 6.5);
  const order = (algo: SchedAlgo, q?: number) =>
    schedule(DEFAULT_PROCS, algo, q).slices.map((s) => `${s.id}${s.start}-${s.end}`).join(' ');
  // RR: C arrives at t=2 as A's quantum ends, so C queues ahead of A.
  assert.equal(order('rr', 2), 'A0-2 B2-4 C4-5 A5-7 D7-9 B9-10 A10-11');
  // Priority: a smaller number wins; the preemptive one switches as soon as B arrives.
  assert.equal(order('prio'), 'A0-5 B5-8 D8-10 C10-11');
  assert.equal(order('prio-p'), 'A0-1 B1-4 D4-6 A6-10 C10-11');
  // Same arrival: input order breaks the tie.
  assert.equal(schedule(procs([[0, 2], [0, 2]]), 'fcfs').slices[0].id, 'P1');
  // An idle gap before the first arrival.
  assert.deepEqual(schedule(procs([[3, 1]]), 'fcfs').slices.map((s) => s.id), [null, 'P1']);
});

test('every schedule runs each process exactly its burst, never early, and wait = turnaround − burst', () => {
  const random = rng(7);
  const cases = [DEFAULT_PROCS, procs([[0, 24], [0, 3], [0, 3]])];
  for (let n = 0; n < 40; n++)
    cases.push(
      procs(
        Array.from({ length: 1 + Math.floor(random() * 6) }, (): [number, number, number] => [
          Math.floor(random() * 8),
          1 + Math.floor(random() * 6),
          Math.floor(random() * 4),
        ]),
      ),
    );
  for (const list of cases)
    for (const algo of ['fcfs', 'sjf', 'srtf', 'rr', 'prio', 'prio-p'] as const) {
      const { slices, rows } = schedule(list, algo, 2);
      assert.equal(slices[0].start, 0);
      slices.forEach((s, i) => i && assert.equal(s.start, slices[i - 1].end));
      for (const p of list) {
        const mine = slices.filter((s) => s.id === p.id);
        assert.equal(mine.reduce((sum, s) => sum + s.end - s.start, 0), p.burst, `${algo} ${p.id}`);
        assert.ok(mine[0].start >= p.arrive);
        const row = rows.find((r) => r.id === p.id)!;
        assert.equal(row.wait, row.tat - p.burst);
        assert.equal(row.finish, mine.at(-1)!.end);
        if (['fcfs', 'sjf', 'prio'].includes(algo)) assert.equal(mine.length, 1, `${algo} runs to completion`);
      }
      // The CPU never idles while a process is waiting.
      for (const s of slices) if (s.id === null) assert.equal(s.ready.length, 0);
    }
});

test('page replacement counts textbook faults, shows Belady, and agrees with brute force', () => {
  assert.deepEqual([3, 4].map((f) => replace(DEFAULT_REFS, f, 'fifo').faults), [9, 10]);
  assert.equal(replace(DEFAULT_REFS, 3, 'opt').faults, 7);
  const q = bank.questions.find((x) => x.id === 'mcq-os-9')!;
  assert.equal(String(replace(DEFAULT_REFS, 3, 'lru').faults), q.zh.choices[q.answer[0]]);
  // Brute force: second-chance FIFO (the queue form of Clock) and LRU as a recency list.
  const secondChance = (refs: number[], size: number) => {
    let queue: { page: number; bit: number }[] = [],
      faults = 0;
    for (const page of refs) {
      const hit = queue.find((e) => e.page === page);
      if (hit) {
        hit.bit = 1;
        continue;
      }
      faults++;
      if (queue.length === size) {
        while (queue[0].bit) queue = [...queue.slice(1), { ...queue[0], bit: 0 }];
        queue.shift();
      }
      queue.push({ page, bit: 1 });
    }
    return faults;
  };
  const lru = (refs: number[], size: number) => {
    const list: number[] = [];
    let faults = 0;
    for (const page of refs) {
      const at = list.indexOf(page);
      if (at >= 0) list.splice(at, 1);
      else {
        faults++;
        if (list.length === size) list.shift();
      }
      list.push(page);
    }
    return faults;
  };
  const random = rng(11);
  for (let n = 0; n < 200; n++) {
    const refs = Array.from({ length: 1 + Math.floor(random() * 15) }, () => Math.floor(random() * 6));
    const size = 1 + Math.floor(random() * 5);
    assert.equal(replace(refs, size, 'clock').faults, secondChance(refs, size), `clock ${refs} / ${size}`);
    assert.equal(replace(refs, size, 'lru').faults, lru(refs, size), `lru ${refs} / ${size}`);
    const best = replace(refs, size, 'opt').faults;
    for (const algo of ['fifo', 'lru', 'clock'] as ReplAlgo[]) assert.ok(best <= replace(refs, size, algo).faults, `opt ≤ ${algo}`);
    // Stack algorithms never fault more with more frames.
    for (const algo of ['lru', 'opt'] as ReplAlgo[]) {
      const curve = faultCurve(refs, algo);
      assert.ok(curve.every((f, i) => !i || f <= curve[i - 1]), `${algo} curve ${curve}`);
    }
  }
  const last = createSimTrace('page-replacement').frames.at(-1)!;
  assert.equal(Object.fromEntries(last.stats)['Belady 异常'], '3 帧 9 次 → 4 帧 10 次');
});

test("the banker's algorithm finds Silberschatz's safe sequence, grants P1, and rejects unsafe states", () => {
  const plain = banker(DEFAULT_AVAIL, DEFAULT_ALLOC, DEFAULT_MAX);
  assert.deepEqual(plain.safe, [1, 3, 0, 2, 4]);
  // Replay the sequence: each process's Need fits in Work when its turn comes.
  let work = [...DEFAULT_AVAIL];
  for (const p of plain.safe!) {
    assert.ok(plain.need[p].every((n, r) => n <= work[r]), `P${p}`);
    work = work.map((w, r) => w + DEFAULT_ALLOC[p][r]);
  }
  const granted = banker(DEFAULT_AVAIL, DEFAULT_ALLOC, DEFAULT_MAX, { p: 1, vec: [1, 0, 2] });
  assert.equal(granted.request, 'granted');
  assert.deepEqual(granted.available, [2, 3, 0]);
  assert.deepEqual(granted.safe, [1, 3, 0, 2, 4]);
  const unsafe = banker([1, 1, 1], DEFAULT_ALLOC, DEFAULT_MAX);
  assert.equal(unsafe.safe, null);
  assert.deepEqual(unsafe.steps.map((s) => s.p), [3, 1]);
  assert.equal(banker(DEFAULT_AVAIL, DEFAULT_ALLOC, DEFAULT_MAX, { p: 1, vec: [2, 0, 0] }).request, 'exceeds-need');
  assert.equal(banker(DEFAULT_AVAIL, DEFAULT_ALLOC, DEFAULT_MAX, { p: 0, vec: [4, 0, 0] }).request, 'wait');
  // Granting P4 (3, 3, 0) would leave (0, 0, 2): nobody can finish.
  assert.equal(banker(DEFAULT_AVAIL, DEFAULT_ALLOC, DEFAULT_MAX, { p: 4, vec: [3, 3, 0] }).request, 'unsafe');
});

test('TCP: seq and ack follow x and y + 1, every transition is in RFC 793, and the active closer waits in TIME_WAIT', () => {
  const RFC793 = new Set([
    'CLOSED>LISTEN', 'CLOSED>SYN_SENT', 'LISTEN>SYN_RCVD', 'LISTEN>SYN_SENT', 'LISTEN>CLOSED', 'SYN_SENT>ESTABLISHED',
    'SYN_SENT>SYN_RCVD', 'SYN_SENT>CLOSED', 'SYN_RCVD>ESTABLISHED', 'SYN_RCVD>FIN_WAIT_1', 'SYN_RCVD>LISTEN',
    'ESTABLISHED>FIN_WAIT_1', 'ESTABLISHED>CLOSE_WAIT', 'FIN_WAIT_1>FIN_WAIT_2', 'FIN_WAIT_1>CLOSING', 'FIN_WAIT_1>TIME_WAIT',
    'FIN_WAIT_2>TIME_WAIT', 'CLOSING>TIME_WAIT', 'CLOSE_WAIT>LAST_ACK', 'LAST_ACK>CLOSED', 'TIME_WAIT>CLOSED',
  ]);
  for (const kind of ['normal', 'syn-loss', 'simul-close'] as TcpScenario[])
    for (const [x, y] of [[100, 300], [0, 99999]]) {
      const steps = tcpSteps(kind, x, y);
      const state: Record<'C' | 'S', TcpState> = { C: 'CLOSED', S: 'CLOSED' };
      const path: Record<'C' | 'S', TcpState[]> = { C: [], S: [] };
      const nxt = { C: x, S: y },
        rcv: Record<'C' | 'S', number | undefined> = { C: undefined, S: undefined },
        lostSeqs: string[] = [];
      for (const step of steps) {
        for (const side of ['C', 'S'] as const)
          for (const s of side === 'C' ? step.client : step.server) {
            assert.ok(RFC793.has(`${state[side]}>${s}`), `${kind} ${side}: ${state[side]} → ${s}`);
            state[side] = s;
            path[side].push(s);
          }
        // Segments in one step cross: check them all against the state before any arrives.
        for (const seg of step.segs) {
          const resend = seg.seq !== nxt[seg.from];
          if (resend) assert.ok(lostSeqs.includes(`${seg.from}${seg.flags}${seg.seq}`), `${kind}: unexpected seq ${seg.seq}`);
          if (seg.ack !== undefined) assert.equal(seg.ack, rcv[seg.from], `${kind}: ${seg.flags} ack`);
          if (seg.lost) lostSeqs.push(`${seg.from}${seg.flags}${seg.seq}`);
          if (!resend && /SYN|FIN/.test(seg.flags)) nxt[seg.from]++;
        }
        for (const seg of step.segs)
          if (!seg.lost) rcv[seg.from === 'C' ? 'S' : 'C'] = seg.seq + (/SYN|FIN/.test(seg.flags) ? 1 : 0);
      }
      const all = steps.flatMap((s) => s.segs.filter((g) => !g.lost));
      assert.equal(all.find((g) => g.flags === 'SYN')!.seq, x);
      const synAck = all.find((g) => g.flags === 'SYN+ACK')!;
      assert.deepEqual([synAck.seq, synAck.ack], [y, x + 1]);
      assert.equal(all.find((g) => g.flags === 'ACK')!.ack, y + 1);
      assert.deepEqual(state, { C: 'CLOSED', S: 'CLOSED' }, kind);
      const firstFin = steps.find((s) => s.segs.some((g) => g.flags.startsWith('FIN')))!;
      for (const g of firstFin.segs) assert.ok(path[g.from].includes('TIME_WAIT'), `${kind}: ${g.from} closed first`);
      if (kind === 'normal') assert.ok(!path.S.includes('TIME_WAIT'));
      if (kind === 'simul-close') assert.ok(path.C.includes('CLOSING') && path.S.includes('CLOSING'));
      if (kind === 'syn-loss') assert.equal(steps[1].segs[0].lost, true);
    }
});

test('congestion control: the default cwnd sequence, and Tahoe falls to 1 on 3 duplicate ACKs', () => {
  assert.deepEqual(
    cwnd(20, 8, DEFAULT_EVENTS).map((r) => r.cwnd),
    [1, 2, 4, 8, 9, 10, 11, 12, 13, 1, 2, 4, 6, 7, 8, 4, 5, 6, 7, 8],
  );
  assert.deepEqual(
    cwnd(20, 8, DEFAULT_EVENTS).map((r) => r.ssthresh),
    [8, 8, 8, 8, 8, 8, 8, 8, 8, 6, 6, 6, 6, 6, 6, 4, 4, 4, 4, 4],
  );
  assert.deepEqual(cwnd(18, 8, DEFAULT_EVENTS, 'tahoe').slice(15).map((r) => r.cwnd), [1, 2, 4]);
  // ssthresh never drops below 2.
  assert.equal(cwnd(3, 8, [{ round: 1, kind: 'timeout' }])[1].ssthresh, 2);
  assert.ok(createSimTrace('tcp-congestion', true).invariant.includes('RFC 5681'));
});

test('sliding window: Go-Back-N resends the whole window, Selective Repeat only the lost packet', () => {
  const sends = (proto: 'gbn' | 'sr', lose: number | null) => slide(10, 4, lose, proto).flatMap((r) => r.sent.map((s) => s.k));
  assert.deepEqual(sends('gbn', 3), [0, 1, 2, 3, 4, 5, 6, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(sends('sr', 3), [0, 1, 2, 3, 4, 5, 6, 3, 7, 8, 9]);
  assert.deepEqual(sends('gbn', null), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  for (const proto of ['gbn', 'sr'] as const)
    for (let lose = 0; lose < 10; lose++) {
      const rounds = slide(10, 4, lose, proto);
      assert.equal(rounds.at(-1)!.base, 10);
      assert.equal(rounds.at(-1)!.expected, 10);
      // Every send is inside the window as it stood when the round began.
      rounds.forEach((r, i) => assert.ok(r.sent.every((s) => s.k < (i ? rounds[i - 1].base : 0) + 4), `${proto} lose ${lose}`));
    }
  // The GBN receiver re-acknowledges the last in-order packet for each out-of-order arrival.
  assert.deepEqual(slide(10, 4, 3, 'gbn')[1].acks, [2, 2, 2]);
});

test('each placeholder parses back to the default trace; out-of-range input gets a bilingual error', () => {
  for (const kind of simKinds) {
    const parsed = simInputs[kind].parse(simInputs[kind].placeholder);
    assert.ok('args' in parsed, kind);
    assert.deepEqual(createSimTrace(kind, false, parsed.args), createSimTrace(kind), kind);
  }
  const bad: [SimKind, string][] = [
    ['cpu-scheduling', 'lottery; A 0 5'],
    ['cpu-scheduling', 'rr; A 0 5'],
    ['cpu-scheduling', 'fcfs 2; A 0 5'],
    ['cpu-scheduling', 'fcfs; A 0 5, B 0 5, C 0 5, D 0 5, E 0 5, F 0 5, G 0 5'],
    ['cpu-scheduling', 'fcfs; A 0 20, B 0 20, C 0 1'],
    ['cpu-scheduling', 'fcfs; A 0 0'],
    ['cpu-scheduling', 'fcfs; A 0 5, A 1 2'],
    ['page-replacement', 'fifo 7; 1 2 3'],
    ['page-replacement', 'fifo 3; 1 2 3 4 5 6 7 8 9 1 2 3 4 5 6 7'],
    ['page-replacement', 'lfu 3; 1 2 3'],
    ['page-replacement', 'fifo 3; 1 12 3'],
    ['bankers', '1 1; 0 0/1 1, 0 0/1 1, 0 0/1 1, 0 0/1 1, 0 0/1 1, 0 0/1 1'],
    ['bankers', '1 1; 2 0/1 1'],
    ['bankers', '1 1; 0 0/1 1; P3 1 0'],
    ['bankers', '1 1; 0 0 0/1 1 1'],
    ['tcp-handshake', 'normal; 100'],
    ['tcp-handshake', 'reset; 100 300'],
    ['tcp-congestion', 'reno; 8; 31'],
    ['tcp-congestion', 'reno; 8; 20; timeout 21'],
    ['tcp-congestion', 'cubic; 8; 20'],
    ['tcp-congestion', 'reno; 8; 20; loss 3'],
    ['sliding-window-arq', 'gbn; 17; 4'],
    ['sliding-window-arq', 'gbn; 10; 9'],
    ['sliding-window-arq', 'sr; 10; 4; 10'],
  ];
  for (const [kind, text] of bad) {
    const parsed = simInputs[kind].parse(text);
    assert.ok('error' in parsed, `${kind}: ${text}`);
    const [zh, en] = parsed.error;
    assert.ok(CJK.test(zh) && !CJK.test(en), `${kind}: ${text} → ${zh} / ${en}`);
  }
});

/** Every kind with a few inputs besides the default, all through the parsers. */
const VARIANTS: [SimKind, string[]][] = [
  ['cpu-scheduling', ['fcfs; A 0 5 3, B 1 3 1, C 2 1 4, D 3 2 2', 'sjf; A 0 5, B 1 3, C 9 1', 'srtf; P1 0 8, P2 1 4, P3 2 9, P4 3 5', 'prio; A 0 5 3, B 1 3 1', 'prio-p; A 0 5 3, B 1 3 1, C 2 1 0', 'rr 1; A 2 2']],
  ['page-replacement', ['lru 3; 7 0 1 2 0 3 0 4 2 3 0 3 2', 'opt 4; 1 2 3 4 1 2 5 1 2 3 4 5', 'clock 3; 1 2 3 4 1 2 5 1 2 3 4 5', 'fifo 1; 5']],
  ['bankers', ['3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2, 3 0 2/9 0 2, 2 1 1/2 2 2, 0 0 2/4 3 3', '1 1 1; 0 1 0/7 5 3, 2 0 0/3 2 2, 3 0 2/9 0 2, 2 1 1/2 2 2, 0 0 2/4 3 3', '3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2; P0 4 0 0', '3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2; P1 2 0 0', '3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2, 3 0 2/9 0 2, 2 1 1/2 2 2, 0 0 2/4 3 3; P4 3 3 0']],
  ['tcp-handshake', ['syn-loss; 100 300', 'simul-close; 0 99999']],
  ['tcp-congestion', ['tahoe; 8; 20; timeout 9, dup 15', 'reno; 16; 30', 'reno; 2; 3; dup 1']],
  ['sliding-window-arq', ['sr; 10; 4; 3', 'gbn; 6; 3', 'sr; 1; 1; 0', 'gbn; 16; 8; 0']],
];

test('every simulator builds in both languages: one final done frame, a consistent graph, no Chinese in English', () => {
  const texts = (trace: DemoTrace) => [
    trace.title,
    trace.question,
    trace.invariant,
    trace.queueLabel ?? '',
    ...trace.frames.flatMap((f) => [f.caption, ...f.stats.flat(), ...(f.queue ?? []), ...f.cells.map((c) => `${c.label}${c.value}`), ...(f.graph?.nodes ?? []).map((n) => `${n.label}${n.note ?? ''}`)]),
  ];
  const traces = simKinds.map((kind): [string, DemoTrace, DemoTrace] => [kind, createSimTrace(kind), createSimTrace(kind, true)]);
  for (const [kind, inputs] of VARIANTS)
    for (const text of inputs) {
      const parsed = simInputs[kind].parse(text);
      assert.ok('args' in parsed, `${kind}: ${text}`);
      traces.push([`${kind}: ${text}`, createSimTrace(kind, false, parsed.args), createSimTrace(kind, true, parsed.args)]);
    }
  for (const kind of simKinds) assert.ok(createSimTrace(kind).frames.length >= 3, kind);
  for (const [name, zh, en] of traces) {
    assert.equal(zh.frames.length, en.frames.length, name);
    assert.ok(texts(en).every((s) => !CJK.test(s)), `${name}: ${texts(en).find((s) => CJK.test(s))}`);
    for (const trace of [zh, en]) {
      assert.equal(trace.frames.at(-1)!.done, true, name);
      assert.equal(trace.frames.filter((f) => f.done).length, 1, name);
      for (const frame of trace.frames) {
        assert.ok(frame.caption.length > 0, name);
        if (trace.columns) assert.equal(frame.cells.length % trace.columns, 0, name);
        if (!frame.graph) continue;
        const ids = new Set(frame.graph.nodes.map((n) => n.id));
        assert.equal(ids.size, frame.graph.nodes.length, `${name} duplicate node`);
        const edges = frame.graph.edges.map((e) => `${e.from}>${e.to}`);
        assert.equal(new Set(edges).size, edges.length, `${name} duplicate edge`);
        assert.ok(frame.graph.edges.every((e) => ids.has(e.from) && ids.has(e.to)), `${name} dangling edge`);
        assert.ok(
          frame.graph.nodes.every((n) => n.x >= 0 && n.x <= frame.graph!.width && n.y >= 0 && n.y <= frame.graph!.height),
          `${name} node outside the box`,
        );
      }
    }
  }
});

test('captions match the numbers shown, and graphs read out only named nodes', () => {
  const run = (kind: SimKind, text: string) => {
    const parsed = simInputs[kind].parse(text);
    assert.ok('args' in parsed, text);
    return createSimTrace(kind, true, parsed.args);
  };
  // A gap after A finishes is not "nothing has arrived yet".
  const gap = run('cpu-scheduling', 'fcfs; A 0 2, B 5 2').frames.map((f) => f.caption);
  assert.ok(gap.some((c) => c.startsWith('t=2–5: no process is ready')), gap.join('\n'));
  assert.ok(gap.every((c) => !c.includes('no process has arrived yet')));
  assert.ok(run('cpu-scheduling', 'fcfs; A 3 1').frames[1].caption.includes('no process has arrived yet'));
  // Granting P4 (3, 3, 0) is unsafe: the last frame undoes the trial, back to the old Available and P4's old Need.
  const last = run('bankers', '3 3 2; 0 1 0/7 5 3, 2 0 0/3 2 2, 3 0 2/9 0 2, 2 1 1/2 2 2, 0 0 2/4 3 3; P4 3 3 0').frames.at(-1)!;
  assert.match(last.caption, /Undo the trial grant/);
  assert.equal(Object.fromEntries(last.stats).Available, '(3, 3, 2)');
  assert.deepEqual(last.cells.slice(-4).map((c) => c.value), ['P4', 4, 3, 1]);
  // The ssthresh line the invariant points at is drawn in a state with ≥ 3:1 contrast, not the faint muted grey.
  const curve = createSimTrace('tcp-congestion', true);
  const ssthresh = curve.frames.at(-1)!.graph!.edges.filter((e) => e.from.startsWith('T'));
  assert.ok(ssthresh.length && ssthresh.every((e) => e.state === 'answer') && curve.invariant.includes('green line'));
  // Bare dots (cwnd points, lifeline steps) have no text: their ids stay out of the aria-label and they are not buttons.
  for (const kind of ['tcp-handshake', 'tcp-congestion'] as const) {
    const graph = createSimTrace(kind, true).frames.at(-1)!.graph!;
    const html = renderToStaticMarkup(createElement(DemoGraphView, { graph }));
    const label = html.match(/aria-label="([^"]*)"/)![1];
    assert.ok(label.length > 4 && !/\b[RTCS]\d+\b/.test(label), `${kind}: ${label}`);
    const buttons = renderToStaticMarkup(createElement(DemoGraphView, { graph, onPick: () => {} })).match(/role="button"/g) ?? [];
    assert.equal(buttons.length, graph.nodes.filter((n) => n.label || n.note).length, kind);
    assert.ok(buttons.length < graph.nodes.length, kind);
  }
});

test('MCQ links point at bank questions on OS or networking, and only the practice page shows them', () => {
  const byId = new Map(bank.questions.map((q) => [q.id, q]));
  assert.equal(Object.keys(MCQ_SIMS).length, 8);
  for (const [id, kind] of Object.entries(MCQ_SIMS)) {
    assert.ok(['os', 'network'].includes(byId.get(id)?.topic ?? ''), id);
    assert.ok(simKinds.includes(kind), id);
  }
  const practice = readFileSync('app/oa/mcq/practice.tsx', 'utf8');
  assert.ok(practice.includes('MCQ_SIMS[q.id]'));
  // The client page imports the map from a file with only type imports, never the simulators.
  assert.ok(!practice.includes("from '@/lib/cs-sims'"));
  assert.ok(!/^import (?!type )/m.test(readFileSync('lib/cs-sims-links.ts', 'utf8')));
  // mcq-network-11 asks about flow control: the sliding-window demo has to say where rwnd comes in.
  assert.ok(createSimTrace('sliding-window-arq', true).invariant.includes('min(cwnd, rwnd)'));
  for (const file of ['components/oa-mcq.tsx', 'components/mock-oa.tsx']) assert.ok(!readFileSync(file, 'utf8').includes('cs-sims'), file);
});

test('the demo player renders the simulators, whose kinds never collide with algorithm demos', () => {
  assert.ok(simKinds.every((k) => !demoKinds.includes(k as never)));
  const page = readFileSync('app/oa/sims/page.tsx', 'utf8');
  assert.ok(page.includes('id={kind}') && page.includes("path: '/oa/sims'"));
  for (const kind of simKinds) {
    const html = renderToStaticMarkup(createElement(AlgorithmDemo, { kind }));
    assert.ok(html.includes(createSimTrace(kind, true).title.replace(/'/g, '&#x27;')), kind);
    assert.equal(html.includes('algorithm-demo-graph'), kind === 'tcp-handshake' || kind === 'tcp-congestion', kind);
  }
});

test('an answered OS question links to its simulator; others do not', async () => {
  const { register } = await import('node:module');
  register(
    `data:text/javascript,${encodeURIComponent("export async function load(u,c,n){if(u.endsWith('.css'))return {format:'module',source:'export default {}',shortCircuit:true};return n(u,c);}")}`,
    import.meta.url,
  );
  const { JSDOM } = await import('jsdom');
  const { act } = await import('react');
  const { mcqDay } = await import('../lib/mock-oa');
  const today = mcqDay();
  const window = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://cswork.test/oa/mcq' }).window;
  window.localStorage.setItem('cswork:oa-mcq:v2', JSON.stringify({ 'mcq-os-9': [0, today, 2], 'mcq-os-1': [0, today, 0] }));
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage', 'navigator', 'location', 'history', 'StorageEvent'])
    Object.defineProperty(globalThis, name, { configurable: true, value: window[name as keyof typeof window] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch;
  const { McqPractice } = await import('../app/oa/mcq/practice');
  const { createRoot } = await import('react-dom/client');
  const items = ['mcq-os-9', 'mcq-os-1'].map((id) => {
    const { zh: _zh, en, ...q } = bank.questions.find((x) => x.id === id)!;
    return { ...q, text: en } as never;
  });
  const root = createRoot(window.document.getElementById('root')!);
  try {
    await act(async () => root.render(createElement(McqPractice, { items, zh: false })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const [nine, one] = [...window.document.querySelectorAll('.oa-mcq-list > li')];
    assert.ok(nine.querySelector('.oa-mcq-why'), 'answered and revealed');
    assert.equal(nine.querySelector('a[href^="/oa/sims"]')?.getAttribute('href'), '/oa/sims#page-replacement');
    assert.equal(one.querySelector('a[href^="/oa/sims"]'), null);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = realFetch;
  }
});
