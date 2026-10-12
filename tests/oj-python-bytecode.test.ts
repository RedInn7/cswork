import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PYTHON_BYTECODE } from '../lib/server/oj-engine';
import { leetcodeSource } from '../lib/server/leetcode-mode';

const python = (dir: string, args: string[], input = '') =>
  spawnSync('python3', ['-I', ...args], { cwd: dir, input, encoding: 'utf8' });

// Reports how many support modules were precompiled, whether any module source
// string survived, and the future flags each precompiled module carries.
const INSPECT = `
import marshal, sys, json
code = marshal.loads(open(sys.argv[1], 'rb').read()[16:])
blobs = [marshal.loads(k) for k in code.co_consts if isinstance(k, bytes)]
left = [k for k in code.co_consts if isinstance(k, str) and len(k) > 500]
print(json.dumps({'precompiled': len(blobs), 'sourceLeft': len(left), 'flags': sorted({b.co_flags & 0x1000000 for b in blobs})}))
`;
/** Builds name.pyc like the runner does, then runs .py and .pyc on the same input. */
function both(name: string, source: string, input: string, flags: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-pyc-'));
  try {
    writeFileSync(join(dir, name), source);
    const built = python(dir, ['-c', PYTHON_BYTECODE, name]);
    assert.equal(built.status, 0, built.stderr);
    const pyc = name.replace(/\.py$/, '.pyc');
    assert.ok(existsSync(join(dir, pyc)));
    const plain = python(dir, [name], input);
    const bytecode = python(dir, [...flags, pyc], input);
    const inspected = python(dir, ['-c', INSPECT, pyc]);
    assert.equal(inspected.status, 0, inspected.stderr);
    return { plain, bytecode, shape: JSON.parse(inspected.stdout) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const twoSum =
  'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, value in enumerate(nums):\n            if target-value in seen: return [seen[target-value],i]\n            seen[value] = i\n';
const lc1 = (code: string) =>
  leetcodeSource('lc-1', 'python', code, 262144).source;

test('LeetCode Python bytecode answers exactly like the source', () => {
  const { plain, bytecode, shape } = both('main.py', lc1(twoSum), '4\n1 2 4 8\n9\n');
  // All twelve embedded support modules ship as code, none as source to recompile.
  assert.deepEqual(shape, { precompiled: 12, sourceLeft: 0, flags: [0] });
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(bytecode.stdout, plain.stdout);
  assert.equal(bytecode.stderr, plain.stderr);
  assert.equal(bytecode.status, plain.status);
});

test('runtime errors keep the same traceback, file name and quoted line', () => {
  const failing = twoSum.replace(
    '        seen = {}\n',
    "        seen = {}\n        raise ValueError('boom')\n",
  );
  const { plain, bytecode } = both('main.py', lc1(failing), '2\n1 2\n3\n');
  assert.notEqual(plain.status, 0);
  assert.match(plain.stderr, /main\.py", line \d+, in twoSum\n\s+raise ValueError\('boom'\)/);
  assert.equal(bytecode.stderr, plain.stderr);
  assert.equal(bytecode.status, plain.status);
});

test('future imports in user code apply to the precompiled support modules too', () => {
  const annotated = `from __future__ import annotations\n${twoSum.replace('def twoSum(self, nums, target):', 'def twoSum(self, nums: Undefined, target: int) -> Nowhere:')}`;
  const { plain, bytecode, shape } = both('main.py', lc1(annotated), '2\n1 2\n3\n');
  // exec(source) inherits the caller's future flags, so the precompiled modules must too.
  assert.deepEqual(shape.flags, [0x1000000]);
  assert.equal(plain.status, 0, plain.stderr);
  assert.equal(bytecode.stdout, plain.stdout);
  assert.equal(bytecode.stderr, plain.stderr);
});

test('a native bridge behaves identically from bytecode', () => {
  const { bridgeSource } = leetcodeSource(
    'lc-1',
    'cpp',
    'class Solution {public: vector<int> twoSum(vector<int>& a,int t){return {};}};',
    262144,
  );
  assert.ok(bridgeSource);
  // No compiled ./main here: both report the same launcher failure.
  const { plain, bytecode, shape } = both('bridge.py', bridgeSource!, '2\n1 2\n3\n', ['-S']);
  assert.equal(shape.precompiled, 12);
  assert.notEqual(plain.status, 0);
  assert.equal(bytecode.stdout, plain.stdout);
  assert.equal(bytecode.stderr, plain.stderr);
  assert.equal(bytecode.status, plain.status);
});

/** Runs only the builder; reports whether it left a .pyc and what it printed. */
function buildOnly(source: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-pyc-'));
  try {
    writeFileSync(join(dir, 'main.py'), source);
    const built = python(dir, ['-c', PYTHON_BYTECODE, 'main.py']);
    return { built, pyc: existsSync(join(dir, 'main.pyc')) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('sources with compile warnings keep running from the .py', () => {
  // The warning must still reach every case's stderr, as it did before.
  const warned = twoSum.replace('        seen = {}\n', "        seen = {}\n        if len(nums) is 1: pass\n");
  const { built, pyc } = buildOnly(lc1(warned));
  assert.equal(built.status, 0);
  assert.equal(built.stderr, '', 'the syntax check already reported it once');
  assert.equal(pyc, false);
});

test('anything the builder cannot handle falls back to the .py', () => {
  // ast.parse recurses where the compiler does not; py_compile accepts this.
  const deep = `${twoSum}X = ${Array(9996).fill('1').join('+')}\n`;
  const { built, pyc } = buildOnly(lc1(deep));
  assert.equal(built.status, 0, built.stderr);
  assert.equal(pyc, false);
});

test('the program still sees main.py as argv[0] and __file__', () => {
  const peek = `import sys as _s\nprint(_s.argv[0], __file__.rsplit('/', 1)[-1])\n${twoSum}`;
  const { plain, bytecode } = both('main.py', lc1(peek), '2\n1 2\n3\n');
  assert.equal(plain.status, 0, plain.stderr);
  assert.match(plain.stdout, /^main\.py main\.py\n/);
  assert.equal(bytecode.stdout, plain.stdout);
});

test('a hoisted __future__ line that rebinds __import__ behaves as before', () => {
  const hostile = `from __future__ import annotations; __import__ = None\n${twoSum}`;
  const { plain, bytecode } = both('main.py', lc1(hostile), '2\n1 2\n3\n');
  assert.equal(bytecode.stdout, plain.stdout);
  assert.equal(bytecode.stderr, plain.stderr);
  assert.equal(bytecode.status, plain.status);
});
