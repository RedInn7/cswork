import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { leetcodeSource, leetcodeTemplates } from '../lib/server/leetcode-mode';

const env = {
  ...process.env,
  GOTOOLCHAIN: 'local',
  GOFLAGS: '',
  GOPROXY: 'off',
  CGO_ENABLED: '0',
};
const skip =
  spawnSync('go', ['version'], { env }).status !== 0 && 'go unavailable';

/** Builds the judged program; with input, runs it and returns its result. */
function judge(id: string, code: string, input?: object) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-go-platform-'));
  try {
    writeFileSync(
      join(dir, 'main.go'),
      leetcodeSource(id, 'go', code, 262144).source,
    );
    const build = spawnSync('go', ['build', '-o', 'main', 'main.go'], {
      cwd: dir,
      env,
      encoding: 'utf8',
    });
    if (build.status !== 0 || !input) return { build };
    const run = spawnSync('./main', {
      cwd: dir,
      input: JSON.stringify(input),
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, run.stderr);
    return {
      build,
      result: JSON.parse(readFileSync(join(dir, 'cswork-result.json'), 'utf8')),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const lru = (node: string) => `${node}
type LRUCache struct{ m map[int]int }
func Constructor(capacity int) LRUCache { return LRUCache{map[int]int{}} }
func (c *LRUCache) Get(key int) int { if v, ok := c.m[key]; ok { return v }; return -1 }
func (c *LRUCache) Put(key int, value int) { c.m[key] = value }`;

void test(
  'learner types named like unused platform types are the learner own',
  { skip },
  () => {
    for (const node of [
      'type Node struct { key, val int; prev, next *Node }',
      'type Node[K comparable, V any] struct { key K; val V; next *Node[K, V] }',
      'type (\n\tNode struct{ key, val int }\n\tlist []*Node\n)',
      'type entry struct{ key, val int }\ntype Node = *entry',
      'func helper() { type Node struct{ x int }; _ = Node{} }',
    ]) {
      const { build } = judge('lc-146', lru(node));
      assert.equal(build.status, 0, `${node}\n${build.stderr}`);
    }
  },
);

void test(
  'a signature type is one type, from the template or the judge',
  { skip },
  () => {
    const body = (code: string) =>
      code.replace(
        /\{\s*\}/,
        '{ var _ *cswPlatformListNode = l1; l1.Next = l2; return l1 }',
      );
    const template = leetcodeTemplates('lc-2')!.go;
    assert.match(template, /^type ListNode struct/m);
    const leetcode = template.replace(/^type ListNode struct.*$/m, '');
    const input = {
      args: [{ $ref: 0 }, { $ref: 1 }],
      nodes: [
        { id: 0, type: 'ListNode', fields: { val: 2, next: null } },
        { id: 1, type: 'ListNode', fields: { val: 3, next: null } },
      ],
    };
    for (const code of [template, leetcode]) {
      const { build, result } = judge('lc-2', body(code), input);
      assert.equal(build.status, 0, build.stderr);
      assert.deepEqual(result.result, { $ref: 0 });
      assert.deepEqual(result.nodes[0], {
        id: 0,
        type: 'ListNode',
        fields: { val: 2, next: { $ref: 1 } },
      });
    }
    const { build } = judge(
      'lc-1095',
      leetcodeTemplates('lc-1095')!
        .go.replace(/^type MountainArray[\s\S]*$/m, '')
        .replace(/\{\s*\}\s*$/, '{ return mountainArr.length() + target }\n'),
    );
    assert.equal(build.status, 0, build.stderr);
  },
);

void test(
  'a signature type shadowed locally or named in a literal is still defined',
  { skip },
  () => {
    const add = (extra: string) => `${extra}
func addTwoNumbers(l1 *ListNode, l2 *ListNode) *ListNode { return &ListNode{Val: l1.Val + l2.Val} }`;
    for (const extra of [
      'func digits() int { type ListNode struct{ d []int }; return len(ListNode{}.d) }',
      'const doc = `type ListNode struct { Val int }`',
      'var doc = "type ListNode struct {"',
    ]) {
      const { build } = judge('lc-2', add(extra));
      assert.equal(build.status, 0, `${extra}\n${build.stderr}`);
    }
  },
);

void test('learner code is spliced verbatim, $ patterns included', () => {
  const code =
    'func twoSum(nums []int, target int) []int { if "$&" == string(\'$\') { return nil }; return []int{0, 1} }';
  assert.ok(leetcodeSource('lc-1', 'go', code, 262144).source.includes(code));
});
