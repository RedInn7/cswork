import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loopLines } from '../lib/code-analyzer';
import { budget, budgetMessage, failureChecks, lcBounds, problemBounds, statementBounds, type Bounds } from '../lib/constraint-hints';

const src = (...lines: string[]) => lines.join('\n');
const nums = [{ name: 'nums', type: 'integer[]' }];
const big = { nums: { len: [1, 100000], val: [-1000000000, 1000000000] } };
const small = { nums: { len: [1, 100000], val: [0, 100] } };
const n = (size: number): Bounds => ({ n: size, name: 'n' });
const base = { codingMode: 'leetcode', stderr: '', bounds: null as Bounds | null, statement: '', code: '' };
const ids = (input: Partial<Parameters<typeof failureChecks>[0]> & { status: string; language: string }) =>
  failureChecks({ ...base, ...input }).map((c) => c.id);

void test('the budget: the slowest class within 10^8 operations, and the one that is too slow', () => {
  const lc = lcBounds(nums, big)!;
  assert.deepEqual(lc, { n: 100000, name: 'nums.length' });
  const r = budget(lc, 'cpp')!;
  assert.equal(r.target, 'O(n log n)');
  assert.deepEqual(r.slower, { cls: 'O(n²)', ops: 1e10 });
  assert.equal(r.pythonTight, false);
  assert.equal(budgetMessage(lc, 'cpp')![0], 'nums.length ≤ 10^5 → 每秒约 10^7–10^8 次运算 → 目标 O(n log n) 或更快；O(n²) ≈ 10^10 次，太慢。');
  assert.match(budgetMessage(lc, 'java')![1], /aim for O\(n log n\) or better; O\(n²\) ≈ 10\^10 is too slow\.$/);

  const mid = budget(n(5000), 'python')!;
  assert.equal(mid.target, 'O(n²)');
  assert.equal(mid.slower?.cls, 'O(n³)');
  assert.equal(mid.pythonTight, true);
  assert.match(budgetMessage(n(5000), 'python')![0], /O\(n³\) ≈ 1\.3×10\^11 次，太慢。Python 每秒大约只有 10\^7 次/);
  assert.doesNotMatch(budgetMessage(n(5000), 'cpp')![0], /Python/);
  assert.equal(budget(n(10), 'cpp')!.target, 'O(n!)');
  assert.equal(budget(n(10), 'cpp')!.slower, undefined);
  assert.equal(budget(n(20), 'cpp')!.target, 'O(2ⁿ·n)');
  assert.equal(budget(n(400), 'cpp')!.target, 'O(n³)');
  assert.equal(budget(n(1e8), 'cpp')!.target, 'O(n)');
  assert.equal(budget(n(2 ** 31 - 1), 'cpp'), null);
  // n = 500: O(n³) ≈ 1.3×10^8 is the class the usual tables give there, so borderline, not too slow; in Python still too slow.
  assert.match(budgetMessage(n(500), 'cpp')![0], /目标 O\(n²\) 或更快；O\(n³\) ≈ 1\.3×10\^8 次，偏紧/);
  assert.doesNotMatch(budgetMessage(n(500), 'cpp')![0], /太慢/);
  assert.match(budgetMessage(n(500), 'java')![1], /O\(n³\) ≈ 1\.3×10\^8 is borderline/);
  assert.match(budgetMessage(n(500), 'python')![0], /O\(n³\) ≈ 1\.3×10\^8 次，太慢/);

  // Rows, columns and word lengths are second sizes: no budget rather than a wrong one.
  assert.equal(lcBounds([{ name: 'grid', type: 'integer[][]' }], { grid: { len: [1, 300] } }), null);
  assert.equal(lcBounds([{ name: 'words', type: 'string[]' }], { words: { len: [1, 1000] } }), null);
  assert.equal(lcBounds([{ name: 'lists', type: 'ListNode[]' }], { lists: { len: [0, 10000] } }), null);
  assert.equal(lcBounds([...nums, { name: 's', type: 'string' }], big), null); // s's length unknown
  assert.deepEqual(lcBounds([{ name: 'root', type: 'TreeNode' }], { root: { len: [0, 10000] } }), { n: 10000, name: 'n' });
  assert.deepEqual(lcBounds([{ name: 'n', type: 'integer' }], { n: { val: [1, 45] } }), { n: 45, name: 'n' });
  assert.equal(lcBounds([{ name: 'x', type: 'integer' }], { x: { val: [0, 100] } }), null);
  assert.equal(lcBounds(nums, null), null);
  // Coin Change: 12 coins beside amount ≤ 10^4, a second size; an exponential budget would mislead.
  const coins = [{ name: 'coins', type: 'integer[]' }, { name: 'amount', type: 'integer' }];
  assert.equal(lcBounds(coins, { coins: { len: [1, 12], val: [1, 2 ** 31 - 1] }, amount: { val: [0, 10000] } }), null);
  assert.deepEqual(lcBounds([...nums, { name: 'target', type: 'integer' }], { ...big, target: { val: [-1e9, 1e9] } }), { n: 100000, name: 'nums.length' });
  assert.deepEqual(lcBounds([...nums, { name: 'k', type: 'integer' }], { nums: { len: [1, 16], val: [1, 1e4] }, k: { val: [1, 16] } }), { n: 16, name: 'nums.length' });
});

void test('bounds read off an OA statement', () => {
  const pkg = JSON.parse(readFileSync(new URL('../content/oa-judge/packages/oa-abaka-ai-1.json', import.meta.url), 'utf8'));
  const text = `${pkg.problem.input}\n${pkg.problem.description}`;
  assert.deepEqual(statementBounds(text), { n: 200000, name: 'N', val: 1e9 });
  assert.deepEqual(problemBounds('oa-abaka-ai-1', null, null, text), { n: 200000, name: 'N', val: 1e9 });
  assert.equal(problemBounds('lc-1', null, null, text), null);
  assert.deepEqual(statementBounds('1 ≤ n ≤ 2·10^5'), { n: 200000, name: 'n' });
  assert.deepEqual(statementBounds('`1 <= q <= 1e5`, `|a[i]| <= 10^9`'), { n: 100000, name: 'q', val: 1e9 });
  assert.deepEqual(statementBounds('1 ⩽ M ⩽ 2×10⁵'), { n: 200000, name: 'M' });
  assert.deepEqual(statementBounds('1 ≤ s.length ≤ 10,000'), { n: 10000, name: 's.length' });
  assert.deepEqual(statementBounds('$1 \\le n \\le 10^{5}$'), { n: 100000, name: 'n' });
  assert.equal(statementBounds('Print the answer modulo 10^9 + 7.'), null);
  assert.equal(statementBounds('1 ≤ k ≤ n, 1 ≤ T ≤ 10'), null);
  assert.equal(statementBounds('1 ≤ maxMemory ≤ 10^9'), null);
  // Never the leading digits of a number it cannot read.
  assert.equal(statementBounds('−2^31≤n≤2^31−1'), null);
  assert.equal(statementBounds('$1 \\le n \\le 3 \\cdot 10^5$'), null);
  assert.equal(statementBounds('1 ≤ n ≤ 10 ^ 5'), null);
  assert.equal(statementBounds('1 <= n <= 10**5'), null);
  assert.deepEqual(statementBounds('1 ≤ n ≤ 10^5.'), { n: 100000, name: 'n' });
  assert.deepEqual(statementBounds('**1 ≤ n ≤ 10^5** 1 ≤ a[i] ≤ 2^31−1'), { n: 100000, name: 'n', val: 2 ** 31 });
  assert.deepEqual(statementBounds('1 ≤ n ≤ 2·10^5, 1 ≤ items[i] ≤ 2^{30}'), { n: 200000, name: 'n', val: 2 ** 30 });
  assert.deepEqual(statementBounds('0≤n≤2000，-2³¹≤arr[i]≤2³¹−1。'), { n: 2000, name: 'n', val: 2 ** 31 });
});

void test('loops as lines with their header tokens', () => {
  const py = loopLines(src('for i in range(n):', '    for j in range(i + 1, n):', '        s += 1', 'while q:', '    q.pop()'), 'python');
  assert.deepEqual(py, [
    { from: 1, to: 3, head: ['for', 'i', 'in', 'range', '(', 'n', ')'] },
    { from: 2, to: 3, head: ['for', 'j', 'in', 'range', '(', 'i', '+', '1', ',', 'n', ')'] },
    { from: 4, to: 5, head: ['while', 'q'] },
  ]);
  const cpp = loopLines(src('for (int i = 0; i < n; i++) {', '  while (j < i) j++;', '}'), 'cpp');
  assert.deepEqual(cpp.map((l) => [l.from, l.to, l.head.join(' ')]), [
    [1, 3, 'for ( int i = 0 ; i < n ; i ++ )'],
    [2, 2, 'while ( j < i )'],
  ]);
  assert.deepEqual(loopLines('for i := range nums {\n}', 'go'), [{ from: 1, to: 2, head: ['for', 'i', ':=', 'range', 'nums'] }]);
  assert.deepEqual(loopLines('SELECT 1', 'sql'), []);
});

void test('wrong answer: int overflow only in C++ and Java with an int that grows, plus the edges', () => {
  const java = src('int total(int[] nums) {', '  int sum = 0;', '  for (int x : nums) sum += x;', '  return sum;', '}');
  const wa = failureChecks({ ...base, status: 'wrong_answer', language: 'java', code: java, params: nums, constraints: big });
  assert.equal(wa[0].id, 'wa-overflow');
  assert.equal(wa[0].line, 3);
  assert.match(wa[0].zh, /sum 是 int.*改用 long；/);
  assert.match(failureChecks({ ...base, status: 'wrong_answer', language: 'cpp', code: java.replace('int[] nums', 'vector<int>& nums'), params: nums, constraints: big })[0].en, /Use long long/);
  // long, a constant step, small values, Python and Go: no overflow note.
  assert.ok(!ids({ status: 'wrong_answer', language: 'java', code: java.replace('int sum', 'long sum'), params: nums, constraints: big }).includes('wa-overflow'));
  assert.ok(!ids({ status: 'wrong_answer', language: 'java', code: 'int c = 0;\nc += 1;', params: nums, constraints: big }).includes('wa-overflow'));
  assert.ok(!ids({ status: 'wrong_answer', language: 'java', code: java, params: nums, constraints: small }).includes('wa-overflow'));
  assert.ok(!ids({ status: 'wrong_answer', language: 'python', code: 'sum = 0\nfor x in nums:\n    sum += x', params: nums, constraints: big }).includes('wa-overflow'));
  assert.ok(!ids({ status: 'wrong_answer', language: 'go', code: 'sum := 0\nfor _, x := range nums {\n\tsum += x\n}', params: nums, constraints: big }).includes('wa-overflow'));
  // An OA statement's own n·val decides there.
  assert.equal(ids({ status: 'wrong_answer', language: 'cpp', code: 'int s = 0;\ns += a[i];', bounds: { n: 200000, name: 'N', val: 1e9 } })[0], 'wa-overflow');
  // A for loop's own counter is not a sum: a step of 2, a sieve's j += i.
  const oa = { n: 100000, name: 'n', val: 1e9 };
  const step = src('long s = 0;', 'for (int i = 0; i < nums.length; i += 2) s += nums[i];');
  assert.ok(!ids({ status: 'wrong_answer', language: 'java', code: step, bounds: oa }).includes('wa-overflow'));
  const sieve = src('for (int i = 2; i * i < n; i++)', '  for (int j = i * i; j < n; j += i) composite[j] = true;');
  assert.ok(!ids({ status: 'wrong_answer', language: 'cpp', code: sieve, bounds: oa }).includes('wa-overflow'));
  assert.ok(!ids({ status: 'wrong_answer', language: 'cpp', code: 'int s = 0;\ns += a[i];', bounds: { n: 200000, name: 'N', val: 100 } }).includes('wa-overflow'));

  const edges = wa.find((c) => c.id === 'wa-edges')!;
  assert.match(edges.zh, /^按约束过一遍边界：输入能为空吗？最小规模是多少？nums 至少 1 个元素。会有负数吗？值的范围多大？有负数：nums 最小 −10\^9。有重复元素吗？$/);
  assert.match(edges.en, /Can the input be empty\? How small can it get\? nums has at least 1 element\. Can values be negative\? How large do they get\? Yes: nums goes down to −10\^9\. Can elements repeat\?$/);
  assert.equal(wa.length, 3);
  // Without bounds: the generic ones, ACM mode asks about the output format.
  assert.deepEqual(ids({ status: 'wrong_answer', language: 'python', codingMode: 'acm' }), ['wa-format', 'wa-edges', 'wa-trace']);
  assert.match(failureChecks({ ...base, status: 'wrong_answer', language: 'python', codingMode: 'acm' })[0].zh, /^输出格式/);
  assert.match(failureChecks({ ...base, status: 'wrong_answer', language: 'python' })[0].zh, /^返回值/);
});

void test('time limit: analyzer notes, nested loops over the input and slow input in ACM mode', () => {
  const pop = src('def bfs(root):', '    queue = [root]', '    while queue:', '        node = queue.pop(0)');
  const [first] = failureChecks({ ...base, status: 'time_limit', language: 'python', code: pop });
  assert.deepEqual([first.id, first.line, first.href], ['py-list-front', 4, '/topics/binary-tree#topic-pitfalls']);

  const nested = src('for i in range(n):', '    for j in range(i + 1, n):', '        best = max(best, a[i] + a[j])');
  const tle = failureChecks({ ...base, status: 'time_limit', language: 'python', code: nested, bounds: n(1e5) });
  assert.equal(tle[0].id, 'tle-nested');
  assert.equal(tle[0].line, 2);
  assert.match(tle[0].zh, /n ≤ 10\^5 时约 10\^10 次/);
  assert.ok(!ids({ status: 'time_limit', language: 'python', code: nested, bounds: n(5000) }).includes('tle-nested'));
  // A direction loop or a while is not a second size.
  const dirs = src('for i in range(n):', '    for d in range(4):', '        pass', '    for dr, dc in dirs:', '        pass', '    while j < i:', '        j += 1');
  assert.ok(!ids({ status: 'time_limit', language: 'python', code: dirs, bounds: n(1e5) }).includes('tle-nested'));
  // Nor is the test-case count of an ACM program.
  const cases = (outer: string) => src(outer, '    n = int(input())', '    for i in range(n):', '        pass');
  assert.ok(!ids({ status: 'time_limit', language: 'python', code: cases('for _ in range(int(input())):'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(!ids({ status: 'time_limit', language: 'python', code: cases('for _ in range(T):'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(ids({ status: 'time_limit', language: 'python', code: cases('for _ in range(m):'), bounds: n(1e5) }).includes('tle-nested'));
  const cpp = (inner: string) => src('for (int i = 0; i < n; i++) {', `  for (${inner}) {`, '  }', '}');
  assert.ok(ids({ status: 'time_limit', language: 'cpp', code: cpp('int j = i + 1; j < n; j++'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(!ids({ status: 'time_limit', language: 'cpp', code: cpp('int k = 0; k < 4; k++'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(ids({ status: 'time_limit', language: 'java', code: src('for (int x : nums)', '  for (int y : nums) c++;'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(ids({ status: 'time_limit', language: 'go', code: src('for i := 0; i < n; i++ {', '\tfor _, y := range a {', '\t}', '}'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(!ids({ status: 'time_limit', language: 'go', code: src('for i < n {', '\tfor j < n {', '\t}', '}'), bounds: n(1e5) }).includes('tle-nested'));
  // Neighbours of one node, and BFS levels behind a while: O(n + m) over the whole run.
  const graph: [string, string][] = [
    ['python', src('for u in range(n):', '    for v in adj[u]:', '        deg[v] += 1')],
    ['cpp', src('for (int u = 0; u < n; u++)', '  for (int v : adj[u]) deg[v]++;')],
    ['java', src('for (int u = 0; u < n; u++)', '  for (int v : adj.get(u)) deg[v]++;')],
    ['go', src('for u := 0; u < n; u++ {', '\tfor _, v := range adj[u] {', '\t\tdeg[v]++', '\t}', '}')],
    ['python', src('for s in range(n):', '    q = deque([s])', '    while q:', '        for _ in range(len(q)):', '            u = q.popleft()')],
    ['python', src('while q:', '    for _ in range(len(q)):', '        u = q.popleft()', '        for v in adj[u]:', '            q.append(v)')],
    ['go', src('for s := 0; s < n; s++ {', '\tfor len(q) > 0 {', '\t\tfor k := 0; k < sz; k++ {', '\t\t}', '\t}', '}')],
  ];
  for (const [language, code] of graph) assert.ok(!ids({ status: 'time_limit', language, code, bounds: n(1e5) }).includes('tle-nested'), code);
  // A slice from i + 1 is still a second pass over the input, and so is one inside a BFS.
  assert.ok(ids({ status: 'time_limit', language: 'python', code: src('for i in range(n):', '    for x in a[i + 1:]:', '        pass'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(ids({ status: 'time_limit', language: 'go', code: src('for i := range a {', '\tfor _, y := range a[i+1:] {', '\t}', '}'), bounds: n(1e5) }).includes('tle-nested'));
  assert.ok(ids({ status: 'time_limit', language: 'python', code: src('while q:', '    u = q.popleft()', '    for v in range(n):', '        for w in range(n):', '            pass'), bounds: n(1e5) }).includes('tle-nested'));

  const acm = { status: 'time_limit', codingMode: 'acm', bounds: n(2e5) };
  const reads = src('n = int(input())', 'for _ in range(n):', '    a, b = map(int, input().split())');
  const io = failureChecks({ ...base, ...acm, language: 'python', code: reads }).find((c) => c.id === 'tle-io')!;
  assert.deepEqual([io.line, io.href], [3, '/judge-environment#io']);
  assert.match(io.zh, /sys\.stdin\.readline/);
  assert.ok(ids({ ...acm, language: 'python', code: '[int(input()) for _ in range(n)]' }).includes('tle-io'));
  assert.ok(!ids({ ...acm, language: 'python', code: `import sys\ninput = sys.stdin.readline\n${reads}` }).includes('tle-io'));
  assert.ok(!ids({ ...acm, language: 'python', code: reads, codingMode: 'leetcode' }).includes('tle-io'));
  assert.ok(!ids({ ...acm, language: 'python', code: reads, bounds: n(1000) }).includes('tle-io'));
  assert.ok(ids({ ...acm, language: 'java', code: 'Scanner sc = new Scanner(System.in);' }).includes('tle-io'));
  assert.ok(!ids({ ...acm, language: 'java', code: 'BufferedReader br = new BufferedReader(new InputStreamReader(System.in));' }).includes('tle-io'));
  const cin = failureChecks({ ...base, ...acm, language: 'cpp', code: 'int main() {\n  int n; cin >> n;\n}' }).find((c) => c.id === 'tle-io')!;
  assert.match(cin.zh, /sync_with_stdio/);
  const endl = failureChecks({ ...base, ...acm, language: 'cpp', code: src('int main() {', '  ios::sync_with_stdio(false);', '  for (int i = 0; i < n; i++)', '    cout << a[i] << endl;', '}') }).find((c) => c.id === 'tle-io')!;
  assert.deepEqual([endl.line, endl.zh], [4, "循环里的 endl 每次都会刷新输出缓冲，换成 '\\n'。"]);
  assert.ok(ids({ ...acm, language: 'go', code: 'import "fmt"\nfunc main() {\n\tfmt.Scan(&n)\n}' }).includes('tle-io'));
  assert.ok(!ids({ ...acm, language: 'go', code: 'import (\n\t"bufio"\n\t"fmt"\n)\nfunc main() {\n\tfmt.Scan(&n)\n}' }).includes('tle-io'));
  // Without any confirmed rule: the budget, the while pointer and repeated work.
  assert.deepEqual(ids({ status: 'time_limit', language: 'cpp', bounds: n(1e5) }), ['tle-budget', 'tle-while', 'tle-repeat']);
  assert.match(failureChecks({ ...base, status: 'time_limit', language: 'cpp', bounds: n(1e5) })[0].zh, /目标 O\(n log n\) 或更快/);
});

void test('runtime error: recursion depth per mode, 1-based arrays, null nodes', () => {
  const rec = (codingMode: string, code = 'def f(x):\n    return f(x - 1)') =>
    failureChecks({ ...base, status: 'runtime_error', language: 'python', codingMode, code, stderr: 'RecursionError: maximum recursion depth exceeded' }).find((c) => c.id === 're-recursion')!;
  assert.match(rec('acm').zh, /sys\.setrecursionlimit\(10\*\*6\)/);
  assert.equal(rec('acm').href, '/judge-environment#recursion');
  assert.match(rec('acm', 'import sys\nsys.setrecursionlimit(10**6)').zh, /3000–5000 层/);
  assert.match(rec('leetcode').zh, /LeetCode 模式的递归上限已经是 10\^6.*5000 层/);
  assert.doesNotMatch(rec('leetcode').zh, /3000/);
  assert.match(rec('leetcode').en, /stop near 5,000 levels/);
  // No stderr: an ACM function that calls itself with n at 10^4 or more and the default limit.
  const dfs = src('def dfs(u):', '    for v in g[u]:', '        dfs(v)', 'dfs(0)');
  assert.ok(ids({ status: 'runtime_error', language: 'python', codingMode: 'acm', code: dfs, bounds: n(1e5) }).includes('re-recursion'));
  assert.ok(!ids({ status: 'runtime_error', language: 'python', codingMode: 'acm', code: dfs, bounds: n(100) }).includes('re-recursion'));
  assert.ok(!ids({ status: 'runtime_error', language: 'python', codingMode: 'acm', code: src('def go(u):', '    return u', 'go(0)'), bounds: n(1e5) }).includes('re-recursion'));
  assert.ok(ids({ status: 'runtime_error', language: 'java', stderr: 'Exception in thread "main" java.lang.StackOverflowError' }).includes('re-recursion'));
  assert.ok(ids({ status: 'runtime_error', language: 'go', stderr: 'runtime: goroutine stack exceeds 1000000000-byte limit' }).includes('re-recursion'));

  const index = { status: 'runtime_error', language: 'python', stderr: 'IndexError: list index out of range' };
  assert.deepEqual(ids({ ...index, statement: '城市编号从 1 到 n。' }).slice(0, 2), ['re-one-based', 're-bounds']);
  assert.deepEqual(ids({ ...index, statement: 'Nodes are 1-indexed.' }).slice(0, 1), ['re-one-based']);
  assert.deepEqual(ids(index), ['re-bounds', 're-empty', 're-div']);
  assert.equal(ids({ status: 'runtime_error', language: 'java', stderr: 'java.lang.NullPointerException' })[0], 're-null');
  assert.equal(ids({ status: 'runtime_error', language: 'python', stderr: "AttributeError: 'NoneType' object has no attribute 'val'" })[0], 're-null');
  // The node wording only for nodes; a missing map key or a method returning None gets its own.
  const nul = (language: string, stderr: string, extra: Partial<Parameters<typeof failureChecks>[0]> = {}) =>
    failureChecks({ ...base, status: 'runtime_error', language, stderr, ...extra }).find((c) => c.id === 're-null')!.zh;
  assert.match(nul('python', "AttributeError: 'NoneType' object has no attribute 'val'"), /^访问了空节点/);
  assert.match(nul('java', 'java.lang.NullPointerException: Cannot read field "left" because "<local1>" is null'), /^访问了空节点/);
  assert.match(nul('go', 'panic: runtime error: invalid memory address or nil pointer dereference', { code: 'func f(root *TreeNode) int {\n\treturn root.Left.Val\n}', params: [{ name: 'root', type: 'TreeNode' }] }), /^访问了空节点/);
  assert.match(nul('java', 'java.lang.NullPointerException', { code: 'ListNode p = head;\nwhile (true) p = p.next;' }), /^访问了空节点/);
  const unbox = 'java.lang.NullPointerException: Cannot invoke "java.lang.Integer.intValue()" because the return value of "java.util.Map.get(Object)" is null';
  assert.match(nul('java', unbox, { code: 'int c = map.get(k);', params: [{ name: 'root', type: 'TreeNode' }] }), /getOrDefault/);
  assert.match(nul('java', 'java.lang.NullPointerException', { code: 'int c = map.get(k);' }), /getOrDefault/);
  assert.match(nul('python', "TypeError: 'NoneType' object is not subscriptable"), /x = nums\.sort\(\).*sorted\(nums\)/);
  assert.match(nul('python', "AttributeError: 'NoneType' object has no attribute 'append'"), /^对 None 做了操作/);
  assert.match(nul('go', 'panic: runtime error: invalid memory address or nil pointer dereference'), /^空指针：指针或结构体字段/);
});

void test('memory limit: a 2-D table at n of 10^4 or more', () => {
  const py = 'dp = [[0] * (n + 1) for _ in range(n + 1)]';
  const [first] = failureChecks({ ...base, status: 'memory_limit', language: 'python', code: py, bounds: n(1e4) });
  assert.deepEqual([first.id, first.line, first.href], ['mle-2d', 1, '/topics/dp-foundations']);
  assert.match(first.zh, /开成 n × n 就有 10\^8 个格子，每格按 4 字节算也有约 380 MB/);
  assert.ok(!ids({ status: 'memory_limit', language: 'python', code: py, bounds: n(1000) }).includes('mle-2d'));
  assert.ok(ids({ status: 'memory_limit', language: 'cpp', code: 'vector<vector<int>> dp(n, vector<int>(n));', bounds: n(1e5) }).includes('mle-2d'));
  assert.ok(ids({ status: 'memory_limit', language: 'java', code: 'int[][] dp = new int[n + 1][n + 1];', bounds: n(1e5) }).includes('mle-2d'));
  assert.ok(!ids({ status: 'memory_limit', language: 'java', code: 'int[] dp = new int[n + 1];', bounds: n(1e5) }).includes('mle-2d'));
  assert.ok(ids({ status: 'memory_limit', language: 'go', code: src('dp := make([][]int, n)', 'for i := range dp {', '\tdp[i] = make([]int, n)', '}'), bounds: n(1e5) }).includes('mle-2d'));
  // An adjacency list's rows start empty: O(n + m), not n × n.
  const adj: [string, string][] = [
    ['python', 'adj = [[] for _ in range(n)]'],
    ['python', 'adj = [[]] * n'],
    ['cpp', 'vector<vector<int>> adj(n);'],
    ['cpp', 'vector<vector<int>> adj(n, vector<int>());'],
    ['cpp', 'int solve(vector<vector<int>>& edges, int n) {\n  return (int)edges.size();\n}'],
    ['java', 'int[][] adj = new int[n][];'],
    ['java', 'int[][] dirs = new int[][]{{0, 1}, {1, 0}};'],
    ['go', src('adj := make([][]int, n)', 'for _, e := range edges {', '\tadj[e[0]] = append(adj[e[0]], e[1])', '}')],
    ['go', src('adj := make([][]int, n)', 'for i := range adj {', '\tadj[i] = make([]int, 0)', '}')],
  ];
  for (const [language, code] of adj) assert.ok(!ids({ status: 'memory_limit', language, code, bounds: n(1e5) }).includes('mle-2d'), code);
  assert.deepEqual(ids({ status: 'memory_limit', language: 'go' }), ['mle-stack', 'mle-copy', 'mle-store']);
});

void test('other verdicts and languages get nothing; never more than six, never an id twice', () => {
  assert.deepEqual(ids({ status: 'accepted', language: 'python' }), []);
  assert.deepEqual(ids({ status: 'compile_error', language: 'cpp' }), []);
  assert.deepEqual(ids({ status: 'wrong_answer', language: 'sql' }), []);
  // Everything at once: string concat, copy in recursion, nested loops and slow input.
  const heavy = src(
    'int main() {',
    '  int n; cin >> n;',
    '  string s;',
    '  for (int i = 0; i < n; i++) {',
    '    for (int j = 0; j < n; j++) s = s + "a";',
    '    cout << s << endl;',
    '  }',
    '}',
    'int f(vector<int> v, int i) { return i ? f(v, i - 1) : 0; }',
  );
  for (const status of ['wrong_answer', 'time_limit', 'runtime_error', 'memory_limit'])
    for (const language of ['python', 'cpp', 'java', 'go'])
      for (const stderr of ['', 'RecursionError IndexError NullPointerException StackOverflowError goroutine stack exceeds nil pointer']) {
        const out = failureChecks({ ...base, status, language, codingMode: 'acm', code: heavy, stderr, bounds: n(1e5), params: nums, constraints: big, statement: '1-indexed' });
        assert.ok(out.length >= 3 && out.length <= 6, `${status} ${language}: ${out.length}`);
        assert.equal(new Set(out.map((c) => c.id)).size, out.length);
      }
  assert.deepEqual(ids({ status: 'time_limit', language: 'cpp', codingMode: 'acm', code: heavy, bounds: n(1e5) }), ['cpp-string-concat', 'cpp-copy-in-recursion', 'tle-nested', 'tle-io']);
});
