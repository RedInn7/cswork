import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  changedNames,
  entryMethod,
  moveTo,
  parseTrace,
  PYODIDE_URL,
  stackAt,
  stdoutAt,
  TRACER_SOURCE,
  workerSource,
  type DebugRequest,
} from '../lib/python-debugger.ts';

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
      steps: [[2, 0, 1, 'f', 0, 0, [['a', '1'], [3, 'x']]], 'junk', [null], [3, 1, 2, 'g', 1, 4, [], '7']],
      stdout: 'hi',
      error: { type: 'ValueError', message: 'm', line: 'x' },
      stopped: 'nope',
      note: { code: 'other' },
    }),
  );
  assert.equal(parsed.steps.length, 2);
  assert.deepEqual(parsed.steps[0].vars, [['a', '1']]);
  assert.equal(parsed.steps[1].ret, '7');
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
