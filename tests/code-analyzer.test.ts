import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, banned, followUpRule, tokenize, type FollowUpRule } from '../lib/code-analyzer';
import rules from '../lib/content/follow-up-rules.json';
import contracts from '../lib/content/leetcode-contracts.json';
import { ROUTE_SLUGS } from '../lib/route-stops';

const ids = (code: string, language: string) => analyze(code, language).map((note) => note.id);
const src = (...lines: string[]) => lines.join('\n');

void test('the tokenizer drops comments and turns strings into one placeholder', () => {
  const words = (code: string, language: 'python' | 'java' | 'cpp' | 'go') =>
    tokenize(code, language).filter((t) => t.k === 'id').map((t) => t.v);
  assert.deepEqual(words(src('# sorted(a)', 'x = "sorted"', "y = '''", 'sorted', "'''", 'z = f"{sorted(a)}"'), 'python'), ['x', 'y', 'z']);
  assert.deepEqual(words(src('#include <bits/stdc++.h>', '// sort', '/* sort', '*/ auto s = R"x(sort)")x"; int n = 1\'000; char c = \'s\';'), 'cpp'), ['auto', 's', 'int', 'n', 'char', 'c']);
  assert.deepEqual(words(src('String s = """', 'sort', '"""; /* sort */ char c = \'"\';'), 'java'), ['String', 's', 'char', 'c']);
  assert.deepEqual(words(src('s := `sort', 'sort` // sort'), 'go'), ['s']);
  // Line numbers survive multi-line comments and strings.
  const after = tokenize(src('/* a', 'b */ x', 'y'), 'go');
  assert.deepEqual(after.map((t) => [t.v, t.line]), [['x', 2], ['y', 3]]);
  const py = tokenize(src('"""', '', '"""', 'x'), 'python');
  assert.deepEqual(py.map((t) => [t.v, t.line]), [['""', 1], ['x', 4]]);
});

void test('python: list.pop(0) / insert(0) in a loop, not on a deque or outside a loop', () => {
  const bfs = src('def bfs(root):', '    queue = [root]', '    while queue:', '        node = queue.pop(0)', '        queue.append(node)');
  assert.deepEqual(analyze(bfs, 'python').map((n) => [n.id, n.line, n.topic]), [['py-list-front', 4, 'binary-tree']]);
  assert.deepEqual(ids(src('def f(nums: List[int]):', '    for x in nums:', '        nums.insert(0, x)'), 'python'), ['py-list-front']);
  assert.deepEqual(ids(bfs.replace('queue = [root]', 'queue = deque([root])'), 'python'), []);
  assert.deepEqual(ids(src('d = {}', 'for k in keys:', '    d.pop(0)'), 'python'), []);
  assert.deepEqual(ids(src('q = [1, 2]', 'q.pop(0)'), 'python'), []);
  assert.deepEqual(ids(src('q = []', 'while q:', '    # q.pop(0)', '    s = "q.pop(0)"'), 'python'), []);
});

void test('python: x in list inside a loop', () => {
  const dup = src('def f(nums):', '    seen = []', '    for x in nums:', '        if x in seen:', '            return True', '        seen.append(x)');
  assert.deepEqual(analyze(dup, 'python').map((n) => [n.id, n.line]), [['py-list-membership', 4]]);
  assert.deepEqual(ids(dup.replace('seen = []', 'seen = set()').replace('append', 'add'), 'python'), []);
  // The loop's own `for ... in`, a constant literal, a string and an expression are not lists.
  assert.deepEqual(ids(src('vowels = ["a", "e"]', 'seen = []', 'for c in seen:', '    if c in vowels or c in "xyz" or c in s.lower():', '        pass'), 'python'), []);
  assert.deepEqual(ids(src('seen = []', 'if 3 in seen:', '    pass'), 'python'), []);
  // A comprehension's own `for ... in` is skipped; its condition is still a membership test.
  assert.deepEqual(ids(src('seen = []', 'for row in grid:', '    xs = [x for x in row if x in seen]'), 'python'), ['py-list-membership']);
});

void test('python: growing a string in a loop', () => {
  const build = src('res = ""', 'for ch in s:', '    res += ch');
  assert.deepEqual(analyze(build, 'python').map((n) => [n.id, n.severity, n.line]), [['py-string-concat', 'informative', 3]]);
  assert.deepEqual(ids(src("res = ''", 'for ch in s:', '    res = res + ch'), 'python'), ['py-string-concat']);
  assert.deepEqual(ids(src('res = []', 'for ch in s:', '    res += [ch]'), 'python'), []);
  assert.deepEqual(ids(src('res = ""', 'res += "x"'), 'python'), []);
  assert.deepEqual(ids(src('res = ""', 'res = 0', 'for ch in s:', '    res += 1'), 'python'), []);
});

void test('python: re-sorting a list the loop keeps growing', () => {
  const median = src('arr = []', 'for x in nums:', '    arr.append(x)', '    arr.sort()', '    out.append(arr[len(arr) // 2])');
  assert.deepEqual(analyze(median, 'python').map((n) => [n.id, n.line]), [['py-sort-in-loop', 4]]);
  assert.deepEqual(ids(src('arr = []', 'for x in nums:', '    arr.append(x)', '    arr = sorted(arr)'), 'python'), ['py-sort-in-loop']);
  // Group anagrams: sorting each element is fine.
  assert.deepEqual(ids(src('groups = {}', 'for w in strs:', "    key = ''.join(sorted(w))"), 'python'), []);
  assert.deepEqual(ids(src('arr = []', 'for x in nums:', '    arr.append(x)', 'arr.sort()'), 'python'), []);
  // A list started fresh each pass (one group, one diagonal) is collected and sorted once.
  assert.deepEqual(ids(src('res = []', 'for g in groups:', '    cur = []', '    for x in g:', '        cur.append(x)', '    cur.sort()', '    res.append(cur)'), 'python'), []);
});

void test('python: overlapping recursion with no memo', () => {
  const stairs = src(
    'class Solution:',
    '    def climbStairs(self, n: int) -> int:',
    '        if n <= 2:',
    '            return n',
    '        return self.climbStairs(n - 1) + self.climbStairs(n - 2)',
  );
  assert.deepEqual(analyze(stairs, 'python').map((n) => [n.id, n.line, n.topic]), [['py-no-memo', 5, 'dp-foundations']]);
  const grid = src('def paths(r, c):', '    if r == 0 or c == 0:', '        return 1', '    return paths(r - 1, c) + paths(r, c - 1)');
  assert.deepEqual(ids(grid, 'python'), ['py-no-memo']);
  assert.deepEqual(ids(`@cache\n${grid}`, 'python'), []);
  assert.deepEqual(ids(`@functools.lru_cache(None)\n${grid}`, 'python'), []);
  assert.deepEqual(ids(grid.replace('    return paths', '    memo[(r, c)] = paths'), 'python'), []);
  // Tree recursion and divide and conquer don't repeat subproblems.
  assert.deepEqual(ids(src('def depth(root):', '    if not root:', '        return 0', '    return 1 + max(depth(root.left), depth(root.right))'), 'python'), []);
  assert.deepEqual(ids(src('def total(lo, hi):', '    mid = (lo + hi) // 2', '    return total(lo, mid) + total(mid + 1, hi)'), 'python'), []);
  // Backtracking calls as separate statements are enumeration, not a missing memo.
  assert.deepEqual(ids(src('def go(i):', '    if i == n:', '        return', '    go(i + 1)', '    go(i + 1)'), 'python'), []);
  // Backtracking over a shared visited set (LC 79, LC 695): the answer depends on the set, so @cache would be wrong.
  const word = src(
    'def dfs(r, c, i):',
    '    if i == len(word):',
    '        return True',
    '    if r < 0 or c < 0 or r >= ROWS or c >= COLS or word[i] != board[r][c] or (r, c) in path:',
    '        return False',
    '    path.add((r, c))',
    '    res = (dfs(r + 1, c, i + 1) or',
    '           dfs(r - 1, c, i + 1) or',
    '           dfs(r, c + 1, i + 1) or',
    '           dfs(r, c - 1, i + 1))',
    '    path.remove((r, c))',
    '    return res',
  );
  assert.deepEqual(ids(word, 'python'), []);
  const island = src(
    'def area(r, c):',
    '    if r < 0 or r == ROWS or c < 0 or c == COLS or grid[r][c] == 0 or (r, c) in visit:',
    '        return 0',
    '    visit.add((r, c))',
    '    return 1 + area(r + 1, c) + area(r - 1, c) + area(r, c + 1) + area(r, c - 1)',
  );
  assert.deepEqual(ids(island, 'python'), []);
  // Moving both ways along one argument ends only through a visited check, however it is kept.
  assert.deepEqual(ids(island.replace('    visit.add((r, c))\n', '    vis[r][c] ^= 1\n'), 'python'), []);
});

void test('java: string concatenation in a loop and reference equality', () => {
  const concat = src('String res = "";', 'for (int i = 0; i < n; i++) {', '    res += s.charAt(i);', '}');
  assert.deepEqual(analyze(concat, 'java').map((n) => [n.id, n.line]), [['java-string-concat', 3]]);
  assert.deepEqual(ids(src('String res = "";', 'for (char c : cs) res = res + c;'), 'java'), ['java-string-concat']);
  assert.deepEqual(ids(src('StringBuilder res = new StringBuilder();', 'for (char c : cs) res.append(c);'), 'java'), []);
  assert.deepEqual(ids(src('String res = "";', 'res += "x";'), 'java'), []);

  const window = src(
    'Map<Character, Integer> need = new HashMap<>(), have = new HashMap<>();',
    'Map<Character, Integer> got = new HashMap<>();',
    'if (need.get(c) == got.get(c)) formed++;',
  );
  const eq = analyze(window, 'java');
  assert.deepEqual(eq.map((n) => [n.id, n.severity, n.line]), [['java-reference-equality', 'essential', 3]]);
  assert.match(eq[0].en, /-128 to 127/);
  assert.deepEqual(ids(src('String a = read();', 'boolean same = a == "yes";'), 'java'), ['java-reference-equality']);
  assert.deepEqual(ids(src('Integer a = 1000, b = 1000;', 'Integer x = a;', 'Integer y = b;', 'return x == y;'), 'java'), ['java-reference-equality']);
  // Unboxing makes these value comparisons; null checks and .equals are right.
  assert.deepEqual(ids(src('Map<Character, Integer> m = new HashMap<>();', 'if (m.get(c) == 3) x++;', 'int k = 4;', 'Integer y = 4;', 'if (k == y) x++;', 'if (y == null) x++;', 'if (m.get(c).equals(y)) x++;'), 'java'), []);
  assert.deepEqual(ids(src('List<int[]> m = new ArrayList<>();', 'char c = s.charAt(0);', "if (c == 'a' || s.charAt(1) == 'b') x++;"), 'java'), []);
  assert.deepEqual(ids(src('String a = "", b = "";', '// if (a == b)', 'String t = "a == b";'), 'java'), []);
});

void test('c++: by-value containers in recursion and s = s + ... in a loop', () => {
  const dfs = src('class Solution {', 'public:', '    void dfs(vector<int> path, int i) {', '        if (i == 3) return;', '        dfs(path, i + 1);', '    }', '};');
  assert.deepEqual(analyze(dfs, 'cpp').map((n) => [n.id, n.line]), [['cpp-copy-in-recursion', 3]]);
  assert.deepEqual(ids(src('int go(const std::string s, int i) {', '  return i ? go(s, i - 1) : 0;', '}'), 'cpp'), ['cpp-copy-in-recursion']);
  assert.deepEqual(ids(dfs.replace('vector<int> path', 'const vector<int>& path'), 'cpp'), []);
  assert.deepEqual(ids(dfs.replace('vector<int> path', 'vector<pair<int, int>>& path'), 'cpp'), []);
  assert.deepEqual(ids(src('int sum(vector<int> v) {', '  return accumulate(v.begin(), v.end(), 0);', '}'), 'cpp'), []);

  const concat = src('string s = "";', 'for (char c : t) {', '    s = s + c;', '}');
  assert.deepEqual(analyze(concat, 'cpp').map((n) => [n.id, n.line]), [['cpp-string-concat', 3]]);
  assert.deepEqual(ids(concat.replace('s = s + c', 's += c'), 'cpp'), []);
  assert.deepEqual(ids(src('string s = "";', 's = s + "x";'), 'cpp'), []);
});

void test('go: string concatenation and append without preallocation', () => {
  const concat = src('func f(words []string) string {', '    s := ""', '    for _, w := range words {', '        s += w', '    }', '    return s', '}');
  assert.deepEqual(analyze(concat, 'go').map((n) => [n.id, n.line]), [['go-string-concat', 4]]);
  assert.deepEqual(ids(src('func f(s string, n int) string {', '    for i := 0; i < n; i++ {', '        s = s + "x"', '    }', '    return s', '}'), 'go'), ['go-string-concat']);
  assert.deepEqual(ids(src('var b strings.Builder', 'for _, w := range words {', '    b.WriteString(w)', '}'), 'go'), []);

  const double = src('func double(nums []int) []int {', '    var res []int', '    for _, x := range nums {', '        res = append(res, x*2)', '    }', '    return res', '}');
  assert.deepEqual(analyze(double, 'go').map((n) => [n.id, n.severity, n.line]), [['go-append-prealloc', 'informative', 4]]);
  assert.deepEqual(ids(double.replace('var res []int', 'res := []int{}'), 'go'), ['go-append-prealloc']);
  assert.deepEqual(ids(double.replace('var res []int', 'res := make([]int, 0)'), 'go'), ['go-append-prealloc']);
  assert.deepEqual(ids(double.replace('var res []int', 'res := make([]int, 0, len(nums))'), 'go'), []);
  // Conditional appends, unbounded loops and variadic appends have no known final length.
  assert.deepEqual(ids(double.replace('res = append(res, x*2)', 'if x > 0 {\n            res = append(res, x)\n        }'), 'go'), []);
  assert.deepEqual(ids(double.replace('for _, x := range nums {', 'for len(res) < 3 {'), 'go'), []);
  assert.deepEqual(ids(double.replace('append(res, x*2)', 'append(res, nums...)'), 'go'), []);
});

void test('notes are bilingual, linked to real stops, and empty for SQL or clean code', () => {
  const all = [
    ...analyze(src('q = []', 'while q:', '    q.pop(0)'), 'python'),
    ...analyze(src('String s = "";', 'while (true) s += "x";'), 'java'),
  ];
  for (const n of all) {
    assert.ok(n.zh && n.en && n.line > 0);
    if (n.topic) assert.ok(ROUTE_SLUGS.includes(n.topic), n.topic);
  }
  assert.deepEqual(analyze('SELECT 1', 'sql'), []);
  assert.deepEqual(analyze('', 'python'), []);
  assert.deepEqual(ids(src('class Solution:', '    def twoSum(self, nums, target):', '        seen = {}', '        for i, x in enumerate(nums):', '            if target - x in seen:', '                return [seen[target - x], i]', '            seen[x] = i'), 'python'), []);
});

void test('banned() finds the first restricted construct, outside comments, strings and own definitions', () => {
  const kth = followUpRule('lc-215', 'python')!;
  assert.deepEqual(banned(src('class Solution:', '    def findKthLargest(self, nums, k):', '        # sorted is not allowed', '        return sorted(nums)[-k]'), 'python', kth), { token: 'sorted', line: 4 });
  assert.deepEqual(banned(src('x = heapq.nlargest(k, nums)', 'nums.sort()'), 'python', kth), { token: 'nlargest', line: 1 });
  assert.equal(banned(src('h = []', 'for x in nums:', '    heapq.heappush(h, x)', '    if len(h) > k: heapq.heappop(h)', 's = "sorted"'), 'python', kth), null);

  const sortArray = followUpRule('lc-912', 'cpp')!;
  const ownSort = src('void sort(vector<int>& a, int l, int r) {', '    if (l >= r) return;', '    sort(a, l, (l + r) / 2);', '}');
  assert.equal(banned(ownSort, 'cpp', sortArray), null);
  assert.deepEqual(banned('std::stable_sort(a.begin(), a.end());', 'cpp', sortArray), { token: 'stable_sort', line: 1 });

  const add = followUpRule('lc-371', 'java')!;
  assert.equal(banned(src('int getSum(int a, int b) {', '    while (b != 0) {', '        int sum = a ^ b;', '        b = (a & b) << 1;', '        a = sum;', '    }', '    return a;', '}'), 'java', add), null);
  assert.deepEqual(banned(src('int getSum(int a, int b) {', '    return a + b; // easy', '}'), 'java', add), { token: '+', line: 2 });
  assert.deepEqual(banned('for (int i = 0; i < 32; i++) {}', 'java', add), { token: '++', line: 1 });

  const merge = followUpRule('lc-88', 'python')!;
  assert.equal(banned(src('class Solution:', '    def merge(self, nums1, m, nums2, n):', '        i, j = m - 1, n - 1'), 'python', merge), null);
  assert.deepEqual(banned(src('def merge(self, nums1, m, nums2, n):', '    nums1[m:] = nums2', '    nums1.sort()'), 'python', merge), { token: '.sort', line: 3 });

  const stack = followUpRule('lc-225', 'python')!;
  assert.deepEqual(banned('return self.q[-1]', 'python', stack), { token: '[-1]', line: 1 });
  assert.equal(banned(src('self.q.append(x)', 'for _ in range(len(self.q) - 1):', '    self.q.append(self.q.popleft())', 'return self.q.popleft()'), 'python', stack), null);

  const number = followUpRule('lc-9', 'java')!;
  assert.deepEqual(banned('String s = "" + x;', 'java', number), { token: '"" +', line: 1 });
});

void test('every follow-up rule targets a Line 500 problem and its own starter passes', () => {
  const problems = contracts.problems as Record<string, { templates?: Record<string, string>; pythonTemplate?: string }>;
  const all = rules as Record<string, FollowUpRule>;
  assert.ok(Object.keys(all).length >= 30);
  for (const [id, rule] of Object.entries(all)) {
    assert.ok(problems[id], `${id} is not a Line 500 problem`);
    assert.ok(rule.zh && rule.en, id);
    const langs = Object.entries(rule.banned);
    assert.ok(langs.length > 0, id);
    for (const [language, entries] of langs) {
      assert.ok(['python', 'java', 'cpp', 'go'].includes(language), `${id} ${language}`);
      assert.ok(entries.length > 0, `${id} ${language}`);
      for (const entry of entries) assert.ok(tokenize(entry, language as 'python').length > 0, `${id} ${entry}`);
      assert.equal(followUpRule(id, language), rule);
      const starters = [problems[id].templates?.[language], language === 'python' ? problems[id].pythonTemplate : undefined];
      for (const starter of starters) if (starter) assert.equal(banned(starter, language, rule), null, `${id} ${language} starter`);
    }
  }
  assert.equal(followUpRule('lc-215', 'sql'), undefined);
  assert.equal(followUpRule('lc-146', 'go'), undefined);
  assert.equal(followUpRule('lc-1', 'python'), undefined);
  assert.equal(followUpRule('__proto__', 'python'), undefined);
});
