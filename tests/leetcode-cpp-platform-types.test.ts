import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { getLeetCodeCppContext } from '../lib/server/leetcode-cpp';
import { leetcodeContract, leetcodeSource } from '../lib/server/leetcode-mode';

// A compiler with libstdc++'s <bits/stdc++.h>, as on the judge.
const compiler = [process.env.CXX, '/opt/homebrew/bin/g++-14', 'g++'].find(
  (cxx) =>
    cxx &&
    (cxx === 'g++' || existsSync(cxx)) &&
    spawnSync(cxx, ['-std=c++20', '-fsyntax-only', '-x', 'c++', '-'], {
      input: '#include <bits/stdc++.h>\n',
    }).status === 0,
);
const skip = !compiler && 'no g++ with <bits/stdc++.h>';

function compile(id: string, code: string) {
  const dir = mkdtempSync(join(tmpdir(), 'cswork-platform-'));
  try {
    writeFileSync(
      join(dir, 'main.cpp'),
      leetcodeSource(id, 'cpp', code, 262144).source,
    );
    return spawnSync(compiler!, ['-std=c++20', '-fsyntax-only', 'main.cpp'], {
      cwd: dir,
      encoding: 'utf8',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const lru = (node: string, use = '') => `${node}
${use}
class LRUCache {
  unordered_map<int, Node*> m; Node *head = new Node(0, 0);
public:
  LRUCache(int capacity) {}
  int get(int key) { return m.count(key) ? m[key]->val : -1; }
  void put(int key, int value) { auto n = new Node(key, value); n->next = head; m[key] = head = n; }
};`;
const lruNode =
  'struct Node { int key, val; Node *prev = nullptr, *next = nullptr; Node(int k, int v) : key(k), val(v) {} };';

void test('only the types the official signature uses are global', () => {
  const global = (id: string) =>
    getLeetCodeCppContext(
      leetcodeContract(id)!.number,
      leetcodeContract(id)!.templates.cpp,
    );
  assert.doesNotMatch(global('lc-146'), /cswork_platform/, 'the editor never offers the judge namespace');
  assert.match(global('lc-2'), /^struct ListNode \{/m);
  assert.doesNotMatch(global('lc-2'), /TreeNode|class Node|Interval/);
  assert.match(global('lc-109'), /struct TreeNode \{[\s\S]*struct ListNode \{/);
  assert.doesNotMatch(global('lc-146'), /Node/);
  assert.doesNotMatch(global('lc-707'), /Node/);
  assert.match(global('lc-1095'), /^class MountainArray \{/m);
  assert.match(global('lc-430'), /Node\* p,Node\* n,Node\* c/);
});

void test(
  'learner types named like platform types compile wherever LeetCode allows them',
  { skip },
  () => {
    for (const [id, code] of [
      ['lc-146', lru(lruNode)],
      ['lc-146', lru(`namespace lru { ${lruNode} }`, 'using namespace lru;')],
      ['lc-146', lru(`namespace { ${lruNode} }`)],
      [
        'lc-707',
        `struct ListNode { int val; ListNode* next; ListNode(int x) : val(x), next(nullptr) {} };
class MyLinkedList { ListNode* head = nullptr; public: MyLinkedList() {}
  int get(int index) { return head ? head->val : -1; } void addAtHead(int val) { auto n = new ListNode(val); n->next = head; head = n; }
  void addAtTail(int val) {} void addAtIndex(int index, int val) {} void deleteAtIndex(int index) {} };`,
      ],
      [
        'lc-2',
        `static_assert(is_same_v<ListNode, cswork_platform::ListNode>, "learner and judge share one ListNode");
class Solution { public: ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) { return new ListNode(l1->val + l2->val); } };`,
      ],
    ] as const) {
      const result = compile(id, code);
      assert.equal(result.status, 0, `${id}\n${code}\n${result.stderr}`);
    }
  },
);

void test(
  'redefining a type the signature uses fails at the learner definition',
  { skip },
  () => {
    const result = compile(
      'lc-2',
      `struct ListNode { int val; ListNode* next; };
class Solution { public: ListNode* addTwoNumbers(ListNode* l1, ListNode* l2) { return l1; } };`,
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /solution\.cpp:1:\d+: error: redefinition of ['‘]struct ListNode['’]/);
  },
);

void test(
  'learner globals named like the harness internals compile',
  { skip },
  () => {
    const globals =
      'struct Answer { int x; }; struct Json {}; int call = 0, construct = 0, dump = 0;';
    for (const [id, code] of [
      [
        'lc-1',
        `${globals}
class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {0, 1}; } };`,
      ],
      ['lc-146', lru(`${globals}\n${lruNode}`)],
      [
        'lc-297',
        `${globals}
class Codec { public: string serialize(TreeNode* root) { return ""; } TreeNode* deserialize(string data) { return nullptr; } };`,
      ],
    ] as const) {
      const result = compile(id, code);
      assert.equal(result.status, 0, `${id}\n${result.stderr}`);
    }
  },
);
