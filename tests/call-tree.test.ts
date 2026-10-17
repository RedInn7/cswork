import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { buildCallTree, MAX_CALL_NODES, type CallNode } from '../lib/call-tree';
import { parseTrace, TRACER_SOURCE, type DebugRequest } from '../lib/python-debugger';

/** The debugger's tracer on this machine's CPython, as in tests/python-debugger.test.ts. */
function run(code: string, request: Partial<DebugRequest> = {}) {
  const result = spawnSync(
    'python3',
    ['-I', '-c', `${TRACER_SOURCE}\nimport sys\nsys.stdout.write(_cswork_debug(sys.stdin.read()))`],
    {
      input: JSON.stringify({ mode: 'acm', stdin: '', entry: '', maxSteps: 5000, maxMs: 3000, code, ...request }),
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const trace = parseTrace(result.stdout);
  return { trace, tree: buildCallTree(trace.steps, trace.params) };
}
const show = (node: CallNode): string =>
  `${node.func}(${node.args})=${node.ret ?? '…'}${node.children.length ? `[${node.children.map(show).join(' ')}]` : ''}`;
const all = (nodes: CallNode[]): CallNode[] => nodes.flatMap((node) => [node, ...all(node.children)]);

const fib = (n: number) =>
  ['def fib(n):', '    if n < 2:', '        return n', '    return fib(n - 1) + fib(n - 2)', `print(fib(${n}))`].join('\n');

test('fib: one node per call in call order, returns, first steps and repeated subproblems', () => {
  const { trace, tree } = run(fib(4));
  assert.equal(tree.recursive, true);
  assert.equal(tree.cut, false);
  assert.equal(tree.size, 1 + 9);
  assert.equal(
    show(tree.roots[0]),
    '<module>()=None[fib(n=4)=3[fib(n=3)=2[fib(n=2)=1[fib(n=1)=1 fib(n=0)=0] fib(n=1)=1] fib(n=2)=1[fib(n=1)=1 fib(n=0)=0]]]',
  );
  const calls = all(tree.roots).filter((node) => node.func === 'fib');
  const repeats = Object.fromEntries(calls.map((node) => [node.args, node.repeat]));
  assert.deepEqual(repeats, { 'n=4': 1, 'n=3': 1, 'n=2': 2, 'n=1': 3, 'n=0': 2 });
  // firstStep is the call's first line, inside that very call.
  for (const node of calls) {
    const step = trace.steps[node.firstStep];
    assert.equal(step.frame, node.frame);
    assert.equal(step.line, 2);
    assert.ok(trace.steps.slice(0, node.firstStep).every((s) => s.frame !== node.frame));
  }
  // fib(5): fib(1) is computed five times.
  const five = all(run(fib(5)).tree.roots).filter((node) => node.args === 'n=1');
  assert.deepEqual(five.map((node) => node.repeat), [5, 5, 5, 5, 5]);
});

test('mutual recursion counts as recursive; plain nested calls do not', () => {
  const { tree } = run(
    [
      'def is_even(n):',
      '    return True if n == 0 else is_odd(n - 1)',
      'def is_odd(n):',
      '    return False if n == 0 else is_even(n - 1)',
      'print(is_even(3))',
    ].join('\n'),
  );
  assert.equal(tree.recursive, true);
  assert.equal(show(tree.roots[0].children[0]), 'is_even(n=3)=False[is_odd(n=2)=False[is_even(n=1)=False[is_odd(n=0)=False]]]');
  const flat = run(['def g(x):', '    return x + 1', 'def f(x):', '    return g(x) * 2', 'print(f(1), f(2))'].join('\n'));
  assert.equal(flat.tree.recursive, false);
  assert.equal(show(flat.tree.roots[0]), '<module>()=None[f(x=1)=4[g(x=1)=2] f(x=2)=6[g(x=2)=3]]');
});

test('arguments are parameters only: no self, no closure variables like a memo', () => {
  const { tree } = run(
    [
      'class Solution:',
      '    def climb(self, n, *rest, step=1, **extra):',
      '        memo = {}',
      '        def go(i):',
      '            if i <= 1:',
      '                return 1',
      '            if i not in memo:',
      '                memo[i] = go(i - 1) + go(i - 2)',
      '            return memo[i]',
      '        return go(n)',
      'print(Solution().climb(4))',
    ].join('\n'),
  );
  const climb = all(tree.roots).find((node) => node.func === 'Solution.climb')!;
  assert.equal(climb.args, 'n=4, step=1, rest=(), extra={}');
  assert.equal(climb.ret, '5');
  const go = all(tree.roots).filter((node) => node.func.endsWith('<locals>.go'));
  assert.deepEqual(go.map((node) => node.args), ['i=4', 'i=3', 'i=2', 'i=1', 'i=0', 'i=1', 'i=2']);
  assert.deepEqual(go.map((node) => node.repeat), [1, 1, 2, 2, 1, 2, 2]);
});

test('a generator stays one call across its resumes, recursive generators nest', () => {
  const { tree } = run(
    [
      'def count(n):',
      '    for i in range(n):',
      '        yield i',
      'def walk(t):',
      '    if t:',
      '        yield from walk(t[0])',
      '        yield t[1]',
      '        yield from walk(t[2])',
      'print(sum(count(3)))',
      'print(list(walk([[None, 1, None], 2, None])))',
    ].join('\n'),
  );
  const module = tree.roots[0];
  assert.deepEqual(module.children.map((node) => `${node.func}(${node.args})`), ['count(n=3)', 'walk(t=[[None, 1, None], 2, None])']);
  assert.equal(show(module.children[1]), 'walk(t=[[None, 1, None], 2, None])=None[walk(t=[None, 1, None])=None[walk(t=None)=None walk(t=None)=None] walk(t=None)=None]');
  assert.equal(tree.recursive, true);
});

test(`more than ${MAX_CALL_NODES} calls are cut; a step-limited trace leaves calls without a return`, () => {
  // fib(12) makes 465 calls.
  const big = run(fib(12)).tree;
  assert.equal(big.cut, true);
  assert.equal(big.size, MAX_CALL_NODES);
  assert.equal(all(big.roots).length, MAX_CALL_NODES);
  // Calls already drawn still return, the outermost included.
  assert.equal(big.roots[0].children[0].ret, '144');
  const { trace, tree } = run(fib(12), { maxSteps: 60 });
  assert.equal(trace.stopped, 'steps');
  assert.equal(tree.cut, false);
  const open = all(tree.roots).filter((node) => node.ret === undefined);
  assert.ok(open.some((node) => node.args === 'n=12'));
  assert.ok(all(tree.roots).some((node) => node.ret !== undefined));
});

test('no steps, no tree', () => {
  assert.deepEqual(buildCallTree([]), { roots: [], size: 0, cut: false, recursive: false });
});
