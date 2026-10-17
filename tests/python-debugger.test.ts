import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  changedNames,
  entryMethod,
  moveTo,
  parseTrace,
  previousInFrame,
  PYODIDE_URL,
  SANDBOX_CSP,
  sandboxSource,
  stackAt,
  stdoutAt,
  TRACER_SOURCE,
  workerSource,
  type DebugRequest,
  type Trace,
} from '../lib/python-debugger';
import { nodeGraph, parseShape, pointers, shapeAt, stepViews, type NodesShape, type Shape } from '../lib/debug-shapes';
import { MAX_GRID } from '../components/structure-view';

/** The tracer on this machine's CPython: what Pyodide runs, minus the browser. */
function trace(request: Partial<DebugRequest>) {
  const run = spawnSync(
    'python3',
    ['-I', '-c', `${TRACER_SOURCE}\nimport sys\nsys.stdout.write(_cswork_debug(sys.stdin.read()))`],
    {
      input: JSON.stringify({ mode: 'acm', stdin: '', entry: '', maxSteps: 5000, maxMs: 3000, ...request }),
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    },
  );
  assert.equal(run.status, 0, run.stderr);
  return parseTrace(run.stdout);
}

const factorial = [
  'n = int(input())',
  'def f(x):',
  '    if x <= 1:',
  '        return 1',
  '    return x * f(x - 1)',
  'print(f(n))',
  'print("done")',
].join('\n');

test('a run records lines, depths, locals, returns and stdout offsets', () => {
  const result = trace({ code: factorial, stdin: '3\n' });
  const { steps } = result;
  assert.deepEqual(
    steps.map((s) => s.line),
    [1, 2, 6, 3, 5, 3, 5, 3, 4, 4, 5, 5, 7, 7],
  );
  assert.deepEqual(
    steps.map((s) => s.depth),
    [0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 2, 1, 0, 0],
  );
  assert.equal(result.stdout, '6\ndone\n');
  assert.equal(result.error, null);
  // Locals: the module shows n, never the function f; each call its own x.
  assert.deepEqual(steps[2].vars, [['n', '3']]);
  assert.deepEqual(steps[7].vars, [['x', '1']]);
  // Returns carry their value; recursion levels are separate frames.
  assert.equal(steps[9].kind, 'return');
  assert.equal(steps[9].ret, '1');
  assert.equal(steps[11].ret, '6');
  assert.equal(new Set(steps.filter((s) => s.func === 'f').map((s) => s.frame)).size, 3);
  // Output so far: nothing before line 7 runs, "6\n" while it does.
  assert.equal(stdoutAt(result, 11), '');
  assert.equal(stdoutAt(result, 12), '6\n');
  assert.equal(stdoutAt(result, 13), '6\ndone\n');
});

test('call stacks are rebuilt from depths, innermost first', () => {
  const { steps } = trace({ code: factorial, stdin: '3\n' });
  assert.deepEqual(
    stackAt(steps, 8).map((s) => `${s.func}:${s.line}`),
    ['f:4', 'f:5', 'f:5', '<module>:6'],
  );
  assert.deepEqual(stackAt(steps, 12).map((s) => s.func), ['<module>']);
  assert.deepEqual(stackAt(steps, 99), []);
});

test('controls: into, back, over skips deeper calls, continue stops on breakpoints', () => {
  const { steps } = trace({ code: factorial, stdin: '3\n' });
  const none = new Set<number>();
  assert.equal(moveTo(steps, 0, 'into', none), 1);
  assert.equal(moveTo(steps, 0, 'back', none), 0);
  assert.equal(moveTo(steps, 13, 'into', none), 13);
  assert.equal(moveTo(steps, 9, 'first', none), 0);
  // Over line 6 (the call to f) lands on line 7 of the same frame.
  assert.equal(moveTo(steps, 2, 'over', none), 12);
  // Over inside f(3) at line 5 goes to its return, not into f(2).
  assert.equal(moveTo(steps, 4, 'over', none), 11);
  assert.equal(moveTo(steps, 0, 'continue', new Set([4])), 8);
  assert.equal(moveTo(steps, 8, 'continue', new Set([4])), 13);
  assert.equal(moveTo(steps, -1, 'continue', new Set([3])), 3);
  assert.equal(moveTo([], 0, 'over', none), 0);
});

test('changed names compare with the same frame only', () => {
  const { steps } = trace({ code: 'a = 1\nb = 2\na = 3\nc = a\n' });
  assert.deepEqual([...changedNames(steps, 0)], []);
  assert.deepEqual([...changedNames(steps, 1)], ['a']);
  assert.deepEqual([...changedNames(steps, 3)], ['a']);
  const recursion = trace({ code: factorial, stdin: '3\n' }).steps;
  // The first line of f(2) is a new frame: nothing "changed" against f(3).
  assert.deepEqual([...changedNames(recursion, 5)], []);
});

test('limits stop endless loops; errors and syntax errors name their line', () => {
  const loop = trace({ code: 'i = 0\nwhile True:\n    i += 1\n', maxSteps: 200 });
  assert.equal(loop.steps.length, 200);
  assert.equal(loop.stopped, 'steps');
  // A broad except can't swallow the stop.
  const guarded = trace({ code: 'while True:\n    try:\n        x = 1\n    except Exception:\n        pass\n', maxSteps: 50 });
  assert.equal(guarded.stopped, 'steps');
  const slow = trace({ code: 'i = 0\nwhile True:\n    i += 1\n', maxMs: 30, maxSteps: 10 ** 9 });
  assert.equal(slow.stopped, 'time');
  const failed = trace({ code: 'x = [1]\nprint("before")\ny = x[5]\n' });
  assert.deepEqual(failed.error, { type: 'IndexError', message: 'list index out of range', line: 3 });
  assert.equal(failed.stdout, 'before\n');
  const syntax = trace({ code: 'x = (\n' });
  assert.equal(syntax.error?.type, 'SyntaxError');
  assert.equal(syntax.error?.line, 1);
  assert.equal(syntax.steps.length, 0);
  assert.equal(trace({ code: 'import sys\nsys.exit(0)\n' }).error, null);
});

test('values are repr-truncated and stdout offsets count UTF-16 units', () => {
  const big = trace({ code: 'xs = list(range(1000))\ns = "a" * 5000\nprint("😀")\nz = 1\n' });
  const last = big.steps.at(-1)!;
  const vars = new Map(last.vars);
  assert.equal(vars.get('xs')!.length <= 200, true);
  assert.equal(vars.get('xs')!.startsWith('[0, 1, 2'), true);
  assert.equal(vars.get('s')!.length <= 200, true);
  assert.equal(stdoutAt(big, big.steps.length - 1), '😀\n');
});

test('LeetCode mode calls Solution with one JSON argument per line', () => {
  const twoSum = trace({
    mode: 'leetcode',
    entry: 'twoSum',
    stdin: '[2,7,11,15]\n9\n',
    code: [
      'class Solution:',
      '    def twoSum(self, nums: List[int], target: int) -> List[int]:',
      '        seen = {}',
      '        for i, x in enumerate(nums):',
      '            if target - x in seen:',
      '                return [seen[target - x], i]',
      '            seen[x] = i',
    ].join('\n'),
  });
  assert.equal(twoSum.result, '[0,1]');
  assert.equal(twoSum.note, null);
  assert.equal(twoSum.steps.some((s) => s.func === 'Solution.twoSum' && s.line === 6), true);
  // Prelude names (List, deque, ...) are not shown as the learner's variables.
  assert.equal(twoSum.steps.every((s) => s.vars.every(([name]) => name !== 'List')), true);

  const tree = trace({
    mode: 'leetcode',
    entry: 'maxDepth',
    stdin: '[3,9,20,null,null,15,7]',
    code: [
      'class Solution:',
      '    def maxDepth(self, root: Optional[TreeNode]) -> int:',
      '        if not root:',
      '            return 0',
      '        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))',
    ].join('\n'),
  });
  assert.equal(tree.result, '3');
  assert.equal(tree.steps.find((s) => s.func === 'Solution.maxDepth')!.vars.find(([n]) => n === 'root')?.[1].startsWith('TreeNode(val=3, left=TreeNode(val=9'), true);

  const lists = trace({
    mode: 'leetcode',
    entry: 'mergeKLists',
    stdin: '[[1,4],[2]]',
    code: [
      'class Solution:',
      '    def mergeKLists(self, lists: List[Optional[ListNode]]) -> Optional[ListNode]:',
      '        values = sorted(v for node in lists for v in self.walk(node))',
      '        head = None',
      '        for v in reversed(values):',
      '            head = ListNode(v, head)',
      '        return head',
      '    def walk(self, node):',
      '        while node:',
      '            yield node.val',
      '            node = node.next',
    ].join('\n'),
  });
  assert.equal(lists.result, '[1,2,4]');

  const design = trace({
    mode: 'leetcode',
    stdin: '["MinStack","push","push","getMin"]\n[[],[3],[1],[]]',
    code: 'class MinStack:\n    def __init__(self):\n        self.s = []\n    def push(self, x):\n        self.s.append(x)\n    def getMin(self):\n        return min(self.s)\n',
  });
  assert.equal(design.result, '[null,null,null,1]');
});

test("LeetCode input it can't call falls back to a plain stdin run with a note", () => {
  const code = 'class Solution:\n    def twoSum(self, nums, target):\n        return []\n';
  const named = trace({ mode: 'leetcode', entry: 'twoSum', stdin: 'nums = [1]', code });
  assert.deepEqual(named.note, { code: 'json', detail: '' });
  assert.equal(named.steps.length > 0, true);
  const short = trace({ mode: 'leetcode', entry: 'twoSum', stdin: '[1]', code });
  assert.deepEqual(short.note, { code: 'arity', detail: 'nums, target' });
  const script = trace({ mode: 'leetcode', stdin: '[1]', code: 'print(input())\n' });
  assert.deepEqual(script.note, { code: 'entry', detail: '' });
  assert.equal(script.stdout, '[1]\n');
});

test('entryMethod reads the Solution method from a template', () => {
  assert.equal(entryMethod('from typing import *\n\nclass Solution:\n    def twoSum(self, nums: List[int], target: int) -> List[int]:\n        pass'), 'twoSum');
  assert.equal(entryMethod('class Solution:\n    def _helper(self): pass\n    def solve(self, s): pass'), 'solve');
  assert.equal(entryMethod('class LRUCache:\n    def get(self, key): pass'), '');
  assert.equal(entryMethod(''), '');
});

test('parseTrace drops malformed steps instead of trusting them', () => {
  const parsed = parseTrace(
    JSON.stringify({
      steps: [
        [2, 0, 1, 'f', 0, 0, [['a', '1'], [3, 'x']], 'x', 1],
        'junk',
        [null],
        [3, 1, 2, 'g', 1, 4, [], '7'],
        [4, 1, 3, 'h', 1, 4, [], 'None', 1],
      ],
      stdout: 'hi',
      error: { type: 'ValueError', message: 'm', line: 'x' },
      stopped: 'nope',
      note: { code: 'other' },
      params: { '2': ['n', 'k'], x: ['a'], '3': [1], '4': 'n' },
      // Only a caller older than its call: no self-parent, no loop, no junk.
      parents: { '3': 1, '4': 4, '5': 9, '6': 'x', '7': 0 },
    }),
  );
  assert.deepEqual(parsed.params, { 2: ['n', 'k'] });
  assert.deepEqual(parsed.parents, { 3: 1 });
  assert.deepEqual(parseTrace('{}').params, {});
  assert.deepEqual(parseTrace('{}').parents, {});
  assert.equal(parsed.steps.length, 3);
  assert.deepEqual(parsed.steps[0].vars, [['a', '1']]);
  assert.equal(parsed.steps[0].raised, undefined);
  assert.equal(parsed.steps[1].ret, '7');
  assert.equal(parsed.steps[1].raised, undefined);
  assert.equal(parsed.steps[2].raised, true);
  assert.deepEqual(parsed.error, { type: 'ValueError', message: 'm', line: null });
  assert.equal(parsed.stopped, null);
  assert.equal(parsed.note, null);
});

test('the worker loads the pinned Pyodide once, then cuts itself off from the network', async () => {
  const posted: Record<string, unknown>[] = [];
  const loads: string[] = [];
  const ran: string[] = [];
  // Like a worker global: the network and storage APIs are its own properties.
  const context: Record<string, unknown> = {
    fetch() {},
    XMLHttpRequest: class {},
    indexedDB: {},
    importScripts(url: string) {
      loads.push(url);
      context.loadPyodide = async ({ indexURL }: { indexURL: string }) => {
        loads.push(indexURL);
        return {
          globals: { set: (_name: string, value: string) => ran.push(value) },
          runPython: (source: string) =>
            source.startsWith('_cswork_debug') ? '{"steps":[]}' : (ran.push('tracer'), undefined),
        };
      };
    },
    postMessage: (message: Record<string, unknown>) => posted.push(message),
  };
  context.self = context;
  vm.createContext(context);
  vm.runInContext(workerSource(), context);
  const send = async (data: unknown) => {
    (context.onmessage as (event: { data: unknown }) => void)({ data });
    await new Promise((resolve) => setTimeout(resolve, 10));
  };
  await send({ code: 'x = 1', stdin: '' });
  await send({ code: 'x = 2', stdin: '' });
  assert.deepEqual(loads, [`${PYODIDE_URL}pyodide.js`, PYODIDE_URL]);
  assert.equal(PYODIDE_URL.startsWith('https://cdn.jsdelivr.net/pyodide/v0.'), true);
  assert.deepEqual(
    posted.map((m) => m.type),
    ['loaded', 'trace', 'loaded', 'trace'],
  );
  assert.equal(ran[0], 'tracer');
  assert.equal(JSON.parse(ran[2]).code, 'x = 2');
  for (const name of ['fetch', 'XMLHttpRequest', 'importScripts', 'indexedDB']) assert.equal(name in context, false, name);
});

test('the sandbox page owns the worker, relays only its parent, and its CSP reaches only pinned Pyodide', async () => {
  const page = sandboxSource();
  assert.equal(page.includes(`http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"`), true);
  // No eval for the learner's code (Pyodide needs only wasm), no fetches beyond the pinned build.
  assert.equal(SANDBOX_CSP.includes("'unsafe-eval'"), false);
  assert.equal(SANDBOX_CSP.endsWith(`connect-src ${PYODIDE_URL}`), true);
  const [, script, ...rest] = page.split('<script>');
  assert.equal(rest.length, 0);
  // The embedded worker source can't end the script early.
  assert.equal(script.indexOf('</'), script.length - '</script>'.length);

  const boot = (Worker: unknown) => {
    const toParent: { type: string }[] = [];
    const blobs: Blob[] = [];
    const context: Record<string, unknown> = {
      Worker,
      Blob,
      URL: { createObjectURL: (blob: Blob) => `blob:${blobs.push(blob)}` },
      parent: { postMessage: (data: { type: string }, origin: string) => origin === '*' && toParent.push(data) },
    };
    vm.createContext(context);
    vm.runInContext(script.slice(0, -'</script>'.length), context);
    return { context, toParent, blobs };
  };
  type Fake = { url: string; posted: unknown[]; onmessage: (e: { data: unknown }) => void; onerror: () => void };
  let worker: Fake | undefined;
  const { context, toParent, blobs } = boot(
    class {
      posted: unknown[] = [];
      constructor(public url: string) {
        worker = this as unknown as Fake;
      }
      postMessage(data: unknown) {
        this.posted.push(data);
      }
    },
  );
  assert.equal(await blobs[0].text(), workerSource());
  assert.equal(worker?.url, 'blob:1');
  const relay = context.onmessage as (event: { source: unknown; data: unknown }) => void;
  relay({ source: {}, data: 'from another window' });
  relay({ source: context.parent, data: 'request' });
  assert.deepEqual(worker?.posted, ['request']);
  worker?.onmessage({ data: { type: 'trace' } });
  worker?.onerror();
  assert.deepEqual(
    toParent.map((m) => m.type),
    ['ready', 'trace', 'crash'],
  );

  const failed = boot(
    class {
      constructor() {
        throw new Error('SecurityError');
      }
    },
  );
  assert.deepEqual(
    failed.toParent.map((m) => m.type),
    ['noworker'],
  );
});

/** The named picture at a step, or undefined. */
const view = (trace: Trace, index: number, name: string): Shape | undefined =>
  stepViews(trace, index).find((v) => v.name === name)?.shape;

test('pictures: a flat list gets cells with i/j pointing at them; a deque is drawn too', () => {
  const code = [
    'nums = [1, 3, 4, 6, 9]',
    'i, j = 0, len(nums) - 1',
    'while i < j:',
    '    s = nums[i] + nums[j]',
    '    if s == 10:',
    '        break',
    '    if s < 10:',
    '        i += 1',
    '    else:',
    '        j -= 1',
    'q = deque([1, 2, 3])',
    'q.popleft()',
  ].join('\n');
  const result = trace({ code: 'from collections import deque\n' + code });
  const at = result.steps.findIndex((s) => s.line === 4);
  assert.deepEqual(view(result, at, 'nums'), { k: 'seq', v: ['1', '3', '4', '6', '9'], n: 5 });
  assert.deepEqual([...pointers(result.steps[at].vars, 5)], [[0, ['i']], [4, ['j']]]);
  // A half-open end (len) still points; past it, or a non-pointer name, doesn't.
  assert.deepEqual([...pointers([['hi', '5'], ['r', '6'], ['n', '2'], ['lo', '-1']], 5)], [[5, ['hi']]]);
  const last = result.steps.length - 1;
  assert.deepEqual(view(result, last, 'q'), { k: 'seq', v: ['2', '3'], n: 2 });
  // Strings are drawn as their characters; dicts as entries; one-character strings not at all.
  const misc = trace({ code: 'w = "abc"\nc = {"a": 1, 2: [3]}\nz = "x"\nend = 0\n' });
  const end = misc.steps.length - 1;
  assert.deepEqual(view(misc, end, 'w'), { k: 'seq', v: ['a', 'b', 'c'], n: 3 });
  assert.deepEqual(view(misc, end, 'c'), { k: 'dict', v: [["'a'", '1'], ['2', '[3]']], n: 2 });
  assert.equal(view(misc, end, 'z'), undefined);
});

test('pictures: a reversed linked list shows prev and cur on different nodes, with the cut edge gone', () => {
  const result = trace({
    mode: 'leetcode',
    entry: 'reverseList',
    stdin: '[1,2,3]',
    code: [
      'class Solution:',
      '    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:',
      '        prev, cur = None, head',
      '        while cur:',
      '            nxt = cur.next',
      '            cur.next = prev',
      '            prev, cur = cur, nxt',
      '        return prev',
    ].join('\n'),
  });
  assert.equal(result.result, '[3,2,1]');
  // Second time at "while cur": 1 is reversed off (prev), 2 -> 3 still ahead (cur).
  const at = result.steps.map((s, i) => [s, i] as const).filter(([s]) => s.line === 4)[1][1];
  const graph = nodeGraph(view(result, at, '#nodes') as NodesShape);
  const holding = (name: string) => graph.nodes.find((n) => n.note?.split(',').includes(name));
  assert.equal(holding('prev')?.label, '1');
  assert.equal(holding('cur')?.label, '2');
  assert.equal(holding('prev')?.state, 'active');
  assert.deepEqual(graph.edges.map((e) => [e.from, e.to, e.directed]), [['1', '2', true]]);
  // Two rows: the reversed part and the part still ahead.
  assert.notEqual(holding('prev')?.y, holding('cur')?.y);
  // One loop later the reversed part reads 2 -> 1 in a row of its own.
  const later = result.steps.map((s, i) => [s, i] as const).filter(([s]) => s.line === 4)[2][1];
  const reversed = nodeGraph(view(result, later, '#nodes') as NodesShape);
  const [two, one] = ['2', '1'].map((label) => reversed.nodes.find((n) => n.label === label)!);
  assert.equal(two.y, one.y);
  assert.ok(two.x < one.x);
});

test('pictures: a cyclic list ends and draws its edge back; a tree is drawn whole from inside a recursive call', () => {
  const cycle = trace({
    code: [
      'class ListNode:',
      '    def __init__(self, val, next=None):',
      '        self.val = val',
      '        self.next = next',
      'a, b, c = ListNode(1), ListNode(2), ListNode(3)',
      'a.next, b.next, c.next = b, c, b',
      'slow = fast = a',
      'while fast and fast.next:',
      '    slow, fast = slow.next, fast.next.next',
      '    if slow is fast:',
      '        break',
    ].join('\n'),
  });
  assert.equal(cycle.error, null);
  assert.equal(cycle.stopped, null);
  const graph = nodeGraph(view(cycle, cycle.steps.length - 1, '#nodes') as NodesShape);
  const node = (label: string) => graph.nodes.find((n) => n.label === label)!;
  assert.equal(graph.nodes.length, 3);
  assert.ok(graph.edges.some((e) => e.from === node('3').id && e.to === node('2').id));
  assert.ok(node('3').x > node('2').x);
  assert.equal(node('3').note, 'c,slow,fast');

  const tree = trace({
    mode: 'leetcode',
    entry: 'maxDepth',
    stdin: '[3,9,20,null,null,15,7]',
    code: [
      'class Solution:',
      '    def maxDepth(self, root: Optional[TreeNode]) -> int:',
      '        if not root:',
      '            return 0',
      '        return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))',
    ].join('\n'),
  });
  const deep = tree.steps.findIndex((s) => s.depth === 2 && s.vars.some(([n, v]) => n === 'root' && v.startsWith('TreeNode(val=15')));
  const drawn = nodeGraph(view(tree, deep, '#nodes') as NodesShape);
  assert.equal(drawn.nodes.length, 5);
  assert.equal(drawn.edges.length, 4);
  assert.deepEqual(drawn.nodes.filter((n) => n.state === 'active').map((n) => [n.label, n.note]), [['15', 'root']]);
  // In-order left to right: 9 3 15 20 7.
  assert.deepEqual([...drawn.nodes].sort((p, q) => p.x - q.x).map((n) => n.label), ['9', '3', '15', '20', '7']);
});

test('pictures: a 2-D dp table highlights exactly the cell the last line wrote; over 40 columns is not drawn', () => {
  const code = ['n = 3', 'dp = [[0] * n for _ in range(n)]', 'for i in range(n):', '    for j in range(n):', '        dp[i][j] = i * n + j + 1', 'end = 0'].join('\n');
  const result = trace({ code });
  let checked = 0;
  result.steps.forEach((step, k) => {
    const before = result.steps[previousInFrame(result.steps, k)];
    if (before?.line !== 5) return;
    const vars = new Map(before.vars);
    const dp = stepViews(result, k).find((v) => v.name === 'dp')!;
    assert.deepEqual([...dp.changed], [`${vars.get('i')},${vars.get('j')}`]);
    checked++;
  });
  assert.equal(checked, 9);
  assert.deepEqual(view(result, result.steps.length - 1, 'dp'), {
    k: 'grid',
    v: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
  });
  const wide = trace({ code: `t = [[0] * ${MAX_GRID + 1} for _ in range(2)]\nok = [[0] * ${MAX_GRID}] * 2\nend = 0\n` });
  const end = wide.steps.length - 1;
  assert.equal(view(wide, end, 't'), undefined);
  assert.equal(view(wide, end, 'ok')?.k, 'grid');
});

test('pictures: snapshots are stored once, and stop for good past their size or time cap', () => {
  const same = trace({ code: 'xs = [1, 2]\nfor _ in range(5):\n    pass\n' });
  assert.equal(same.shapes.length, 1);
  assert.equal(Object.values(same.views).filter((pairs) => pairs[0][1] === 0).length > 5, true);
  assert.equal(same.shapesCut, null);

  // Every write makes a new ~3.6 KB table: past 1.5 MB the rest of the steps go without.
  const big = trace({
    code: 'g = [[100000] * 40 for _ in range(10)]\nfor k in range(3000):\n    g[k % 10][k % 40] = 100000 + k\n',
    maxMs: 60000,
  });
  const cut = big.shapesCut!;
  assert.equal(Number.isInteger(cut), true);
  assert.equal(big.shapes.join('').length <= 1_500_000, true);
  assert.equal(new Set(big.shapes).size, big.shapes.length);
  assert.ok(big.views[cut - 1]);
  assert.equal(Object.keys(big.views).every((key) => Number(key) < cut), true);
  assert.equal(big.steps.length > cut, true);

  // Pictures that eat 30% of the time limit stop too, and the text trace goes on.
  const slow = trace({ code: 'g = [[k] * 40 for k in range(40)]\nk = 0\nwhile True:\n    k += 1\n    g[k % 40][0] = k\n', maxMs: 300, maxSteps: 10 ** 9 });
  assert.equal(slow.stopped, 'time');
  assert.equal(slow.shapesCut !== null && slow.shapesCut < slow.steps.length, true);

  // An object that throws while being looked at stops the pictures, not the learner's run.
  const odd = trace({
    code: 'class N:\n    __slots__ = ()\n    def __getattr__(self, name):\n        raise KeyError(name)\nclass Box:\n    def __init__(self):\n        self.next = N()\nb = Box()\nprint("ok")\n',
  });
  assert.equal(odd.error, null);
  assert.equal(odd.stdout, 'ok\n');
  assert.equal(Number.isInteger(odd.shapesCut), true);
});

test('parseShape and parseTrace refuse snapshots that point outside themselves', () => {
  assert.deepEqual(parseShape('{"k":"nodes","n":[["1",-1,-1,-1]],"p":[["a",0]]}'), { k: 'nodes', n: [['1', -1, -1, -1]], p: [['a', 0]] });
  assert.equal(parseShape('{"k":"nodes","n":[["1",1,-1,-1]],"p":[]}'), null);
  assert.equal(parseShape('{"k":"nodes","n":[["1",-1,-1,-1]],"p":[["a",-1]]}'), null);
  assert.equal(parseShape('{"k":"seq","v":["1",2],"n":2}'), null);
  assert.equal(parseShape('{"k":"seq","v":["1","2"],"n":1}'), null);
  assert.equal(parseShape('{"k":"grid","v":[]}'), null);
  assert.equal(parseShape('{"k":"other"}'), null);
  assert.equal(parseShape('not json'), null);
  const parsed = parseTrace(
    JSON.stringify({
      steps: ['junk', [1, 0, 1, 'f', 0, 0, []], [2, 0, 1, 'f', 0, 0, []]],
      shapes: ['{"k":"seq","v":["1"],"n":1}', 7],
      // Raw step 1 is kept step 0; index 5 is no shape; raw step 0 was dropped.
      views: { '0': [['a', 0]], '1': [['a', 0], ['b', 5], ['c', 1]], '2': [[3, 0]], x: [['a', 0]] },
      shapesCut: 'soon',
    }),
  );
  assert.deepEqual(parsed.views, { 0: [['a', 0], ['c', 1]] });
  assert.equal(parsed.shapesCut, null);
  assert.equal(shapeAt(parsed.shapes, 1), null);
  assert.deepEqual(shapeAt(parsed.shapes, 0), { k: 'seq', v: ['1'], n: 1 });
  assert.equal(shapeAt(parsed.shapes, 9), null);
});
