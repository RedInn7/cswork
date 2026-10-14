// Every Line 500 template must compile and give the right answers in all four languages.
// Each stop has a small driver per language; the program is template + driver, and its
// stdout must equal `expected`. A language whose toolchain is missing is skipped.
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { ROUTE_SECTIONS } from '../lib/route-stops';
import { SITEMAP_STATIC_ENTRIES } from '../lib/seo';
import {
  TEMPLATE_LANGS,
  commentStart,
  line500Path,
  routeTemplates,
  templateFor,
  type TemplateLang,
} from '../lib/route-templates';

/** String.raw with the common indentation removed, so drivers can sit indented here. */
function r(strings: TemplateStringsArray, ...values: unknown[]) {
  const lines = String.raw(strings, ...values).replace(/^\n/, '').trimEnd().split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length));
  return lines.map((l) => l.slice(pad)).join('\n');
}

type Driver = Record<TemplateLang, string> & { expected: string };
const DRIVERS: Record<string, Driver> = {
  'array-foundations': {
    expected: '5\n1 1 2 2 3\n4\n0 1 2 3',
    python: r`
      for nums, k in (([1, 1, 1, 2, 2, 3], 2), ([0, 0, 1, 1, 1, 1, 2, 3, 3], 1)):
          n = keep_at_most(nums, k)
          print(n)
          print(*nums[:n])`,
    cpp: r`
      vector<int> a{1, 1, 1, 2, 2, 3}, b{0, 0, 1, 1, 1, 1, 2, 3, 3};
      int n = keepAtMost(a, 2);
      cout << n << "\n";
      show(vector<int>(a.begin(), a.begin() + n));
      n = keepAtMost(b, 1);
      cout << n << "\n";
      show(vector<int>(b.begin(), b.begin() + n));`,
    java: r`
      Solution s = new Solution();
      int[] a = {1, 1, 1, 2, 2, 3}, b = {0, 0, 1, 1, 1, 1, 2, 3, 3};
      int n = s.keepAtMost(a, 2);
      show(n);
      show(Arrays.copyOf(a, n));
      n = s.keepAtMost(b, 1);
      show(n);
      show(Arrays.copyOf(b, n));`,
    go: r`
      a, b := []int{1, 1, 1, 2, 2, 3}, []int{0, 0, 1, 1, 1, 1, 2, 3, 3}
      n := keepAtMost(a, 2)
      fmt.Println(n)
      show(a[:n])
      n = keepAtMost(b, 1)
      fmt.Println(n)
      show(b[:n])`,
  },
  'hash-counting': {
    expected: '0 1\n0 1\n-1 -1\n1 2',
    python: r`
      for nums, t in (([2, 7, 11, 15], 9), ([3, 3], 6), ([1, 2], 7), ([3, 2, 4], 6)):
          print(*two_sum(nums, t))`,
    cpp: r`
      for (auto& [nums, t] : vector<pair<vector<int>, int>>{{{2, 7, 11, 15}, 9}, {{3, 3}, 6}, {{1, 2}, 7}, {{3, 2, 4}, 6}}) {
          auto [i, j] = twoSum(nums, t);
          cout << i << " " << j << "\n";
      }`,
    java: r`
      Solution s = new Solution();
      int[][] nums = {{2, 7, 11, 15}, {3, 3}, {1, 2}, {3, 2, 4}};
      int[] targets = {9, 6, 7, 6};
      for (int i = 0; i < nums.length; i++) show(s.twoSum(nums[i], targets[i]));`,
    go: r`
      nums := [][]int{{2, 7, 11, 15}, {3, 3}, {1, 2}, {3, 2, 4}}
      targets := []int{9, 6, 7, 6}
      for i := range nums {
          fmt.Println(twoSum(nums[i], targets[i]))
      }`,
  },
  'string-processing': {
    expected: '2 0 2\n3 0 1 2\n0',
    python: r`
      for text, pat in (("abababca", "abab"), ("aaaa", "aa"), ("abc", "d")):
          res = find_all(text, pat)
          print(len(res), *res)`,
    cpp: r`
      for (auto& [text, pat] : vector<pair<string, string>>{{"abababca", "abab"}, {"aaaa", "aa"}, {"abc", "d"}}) {
          auto res = findAll(text, pat);
          cout << res.size() << " ";
          show(res);
      }`,
    java: r`
      Solution s = new Solution();
      for (String[] c : new String[][] {{"abababca", "abab"}, {"aaaa", "aa"}, {"abc", "d"}}) {
          List<Integer> res = s.findAll(c[0], c[1]);
          System.out.print(res.size() + " ");
          show(res);
      }`,
    go: r`
      for _, c := range [][2]string{{"abababca", "abab"}, {"aaaa", "aa"}, {"abc", "d"}} {
          res := findAll(c[0], c[1])
          fmt.Print(len(res), " ")
          show(res)
      }`,
  },
  'two-pointers-windows': {
    expected: '3\n1\n3\n0',
    python: r`
      for s in ("abcabcbb", "bbbbb", "pwwkew", ""):
          print(longest_unique(s))`,
    cpp: r`
      for (string s : {"abcabcbb", "bbbbb", "pwwkew", ""}) cout << longestUnique(s) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (String t : new String[] {"abcabcbb", "bbbbb", "pwwkew", ""}) show(s.longestUnique(t));`,
    go: r`
      for _, s := range []string{"abcabcbb", "bbbbb", "pwwkew", ""} {
          fmt.Println(longestUnique(s))
      }`,
  },
  'prefix-intervals': {
    expected: '2\n2\n3',
    python: r`
      for nums, k in (([1, 1, 1], 2), ([1, 2, 3], 3), ([1, -1, 0], 0)):
          print(count_subarrays(nums, k))`,
    cpp: r`
      for (auto& [nums, k] : vector<pair<vector<int>, int>>{{{1, 1, 1}, 2}, {{1, 2, 3}, 3}, {{1, -1, 0}, 0}})
          cout << countSubarrays(nums, k) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.countSubarrays(new int[] {1, 1, 1}, 2));
      show(s.countSubarrays(new int[] {1, 2, 3}, 3));
      show(s.countSubarrays(new int[] {1, -1, 0}, 0));`,
    go: r`
      fmt.Println(countSubarrays([]int{1, 1, 1}, 2))
      fmt.Println(countSubarrays([]int{1, 2, 3}, 3))
      fmt.Println(countSubarrays([]int{1, -1, 0}, 0))`,
  },
  'binary-search': {
    expected: '1\n4\n0\n8',
    python: r`
      nums = [1, 3, 3, 5]
      for t in (3, 6, 0):
          print(lower_bound(nums, t))
      print(first_true(1, 100, lambda x: x * x >= 50))`,
    cpp: r`
      vector<int> nums{1, 3, 3, 5};
      for (int t : {3, 6, 0}) cout << lowerBound(nums, t) << "\n";
      cout << firstTrue(1, 100, [](long long x) { return x * x >= 50; }) << "\n";`,
    java: r`
      Solution s = new Solution();
      int[] nums = {1, 3, 3, 5};
      for (int t : new int[] {3, 6, 0}) show(s.lowerBound(nums, t));
      show(s.firstTrue(1, 100, x -> x * x >= 50));`,
    go: r`
      nums := []int{1, 3, 3, 5}
      for _, t := range []int{3, 6, 0} {
          fmt.Println(lowerBound(nums, t))
      }
      fmt.Println(firstTrue(1, 100, func(x int) bool { return x*x >= 50 }))`,
  },
  'stacks-heaps': {
    expected: '4 2 4 -1 -1\n-1 -1 -1',
    python: r`
      print(*next_greater([2, 1, 2, 4, 3]))
      print(*next_greater([5, 4, 3]))`,
    cpp: r`
      show(nextGreater({2, 1, 2, 4, 3}));
      show(nextGreater({5, 4, 3}));`,
    java: r`
      Solution s = new Solution();
      show(s.nextGreater(new int[] {2, 1, 2, 4, 3}));
      show(s.nextGreater(new int[] {5, 4, 3}));`,
    go: r`
      show(nextGreater([]int{2, 1, 2, 4, 3}))
      show(nextGreater([]int{5, 4, 3}))`,
  },
  'greedy-scheduling': {
    expected: '3\n1\n2',
    python: r`
      print(max_non_overlapping([[1, 2], [2, 3], [3, 4], [1, 3]]))
      print(max_non_overlapping([[1, 2], [1, 2], [1, 2]]))
      print(max_non_overlapping([[1, 100], [11, 22], [1, 11], [2, 12]]))`,
    cpp: r`
      cout << maxNonOverlapping({{1, 2}, {2, 3}, {3, 4}, {1, 3}}) << "\n";
      cout << maxNonOverlapping({{1, 2}, {1, 2}, {1, 2}}) << "\n";
      cout << maxNonOverlapping({{1, 100}, {11, 22}, {1, 11}, {2, 12}}) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.maxNonOverlapping(new int[][] {{1, 2}, {2, 3}, {3, 4}, {1, 3}}));
      show(s.maxNonOverlapping(new int[][] {{1, 2}, {1, 2}, {1, 2}}));
      show(s.maxNonOverlapping(new int[][] {{1, 100}, {11, 22}, {1, 11}, {2, 12}}));`,
    go: r`
      fmt.Println(maxNonOverlapping([][]int{{1, 2}, {2, 3}, {3, 4}, {1, 3}}))
      fmt.Println(maxNonOverlapping([][]int{{1, 2}, {1, 2}, {1, 2}}))
      fmt.Println(maxNonOverlapping([][]int{{1, 100}, {11, 22}, {1, 11}, {2, 12}}))`,
  },
  'linked-list': {
    expected: '3\n5 4 3 2 1\n3',
    python: r`
      def build(n):
          head = None
          for v in range(n, 0, -1):
              head = ListNode(v, head)
          return head

      print(middle(build(5)).val)
      node, out = reverse(build(5)), []
      while node:
          out.append(node.val)
          node = node.next
      print(*out)
      print(middle(build(4)).val)`,
    cpp: r`
      auto build = [](int n) {
          ListNode* head = nullptr;
          for (int v = n; v >= 1; v--) head = new ListNode(v, head);
          return head;
      };
      cout << middle(build(5))->val << "\n";
      vector<int> out;
      for (ListNode* p = reverseList(build(5)); p; p = p->next) out.push_back(p->val);
      show(out);
      cout << middle(build(4))->val << "\n";`,
    java: r`
      Solution s = new Solution();
      IntFunction<ListNode> build = n -> {
          ListNode head = null;
          for (int v = n; v >= 1; v--) head = new ListNode(v, head);
          return head;
      };
      show(s.middle(build.apply(5)).val);
      List<Integer> out = new ArrayList<>();
      for (ListNode p = s.reverse(build.apply(5)); p != null; p = p.next) out.add(p.val);
      show(out);
      show(s.middle(build.apply(4)).val);`,
    go: r`
      build := func(n int) *ListNode {
          var head *ListNode
          for v := n; v >= 1; v-- {
              head = &ListNode{v, head}
          }
          return head
      }
      fmt.Println(middle(build(5)).Val)
      var out []int
      for p := reverse(build(5)); p != nil; p = p.Next {
          out = append(out, p.Val)
      }
      show(out)
      fmt.Println(middle(build(4)).Val)`,
  },
  'binary-tree': {
    expected: '3\n9 20\n15 7\n0',
    python: r`
      root = TreeNode(3, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))
      for level in level_order(root):
          print(*level)
      print(len(level_order(None)))`,
    cpp: r`
      auto* root = new TreeNode(3, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)));
      for (auto& level : levelOrder(root)) show(level);
      cout << levelOrder(nullptr).size() << "\n";`,
    java: r`
      Solution s = new Solution();
      TreeNode root = new TreeNode(3, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)));
      for (List<Integer> level : s.levelOrder(root)) show(level);
      show(s.levelOrder(null).size());`,
    go: r`
      root := &TreeNode{3, &TreeNode{Val: 9}, &TreeNode{20, &TreeNode{Val: 15}, &TreeNode{Val: 7}}}
      for _, level := range levelOrder(root) {
          show(level)
      }
      fmt.Println(len(levelOrder(nil)))`,
  },
  'binary-tree-paths': {
    expected: '42\n-3\n6',
    python: r`
      print(max_path_sum(TreeNode(-10, TreeNode(9), TreeNode(20, TreeNode(15), TreeNode(7)))))
      print(max_path_sum(TreeNode(-3)))
      print(max_path_sum(TreeNode(1, TreeNode(2), TreeNode(3))))`,
    cpp: r`
      cout << maxPathSum(new TreeNode(-10, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)))) << "\n";
      cout << maxPathSum(new TreeNode(-3)) << "\n";
      cout << maxPathSum(new TreeNode(1, new TreeNode(2), new TreeNode(3))) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.maxPathSum(new TreeNode(-10, new TreeNode(9), new TreeNode(20, new TreeNode(15), new TreeNode(7)))));
      show(s.maxPathSum(new TreeNode(-3)));
      show(s.maxPathSum(new TreeNode(1, new TreeNode(2), new TreeNode(3))));`,
    go: r`
      fmt.Println(maxPathSum(&TreeNode{-10, &TreeNode{Val: 9}, &TreeNode{20, &TreeNode{Val: 15}, &TreeNode{Val: 7}}}))
      fmt.Println(maxPathSum(&TreeNode{Val: -3}))
      fmt.Println(maxPathSum(&TreeNode{1, &TreeNode{Val: 2}, &TreeNode{Val: 3}}))`,
  },
  'binary-tree-build': {
    expected: '3 9 20 15 7\n1',
    python: r`
      t = build_tree([3, 9, 20, 15, 7], [9, 3, 15, 20, 7])
      print(t.val, t.left.val, t.right.val, t.right.left.val, t.right.right.val)
      print(build_tree([1], [1]).val)`,
    cpp: r`
      TreeNode* t = buildTree({3, 9, 20, 15, 7}, {9, 3, 15, 20, 7});
      show(vector<int>{t->val, t->left->val, t->right->val, t->right->left->val, t->right->right->val});
      cout << buildTree({1}, {1})->val << "\n";`,
    java: r`
      Solution s = new Solution();
      TreeNode t = s.buildTree(new int[] {3, 9, 20, 15, 7}, new int[] {9, 3, 15, 20, 7});
      show(new int[] {t.val, t.left.val, t.right.val, t.right.left.val, t.right.right.val});
      show(s.buildTree(new int[] {1}, new int[] {1}).val);`,
    go: r`
      t := buildTree([]int{3, 9, 20, 15, 7}, []int{9, 3, 15, 20, 7})
      show([]int{t.Val, t.Left.Val, t.Right.Val, t.Right.Left.Val, t.Right.Right.Val})
      fmt.Println(buildTree([]int{1}, []int{1}).Val)`,
  },
  'binary-search-tree': {
    expected: '1\n3\n6',
    python: r`
      root = TreeNode(5, TreeNode(3, TreeNode(2, TreeNode(1)), TreeNode(4)), TreeNode(6))
      for k in (1, 3, 6):
          print(kth_smallest(root, k))`,
    cpp: r`
      auto* root = new TreeNode(5, new TreeNode(3, new TreeNode(2, new TreeNode(1)), new TreeNode(4)), new TreeNode(6));
      for (int k : {1, 3, 6}) cout << kthSmallest(root, k) << "\n";`,
    java: r`
      Solution s = new Solution();
      TreeNode root = new TreeNode(5, new TreeNode(3, new TreeNode(2, new TreeNode(1), null), new TreeNode(4)), new TreeNode(6));
      for (int k : new int[] {1, 3, 6}) show(s.kthSmallest(root, k));`,
    go: r`
      root := &TreeNode{5, &TreeNode{3, &TreeNode{2, &TreeNode{Val: 1}, nil}, &TreeNode{Val: 4}}, &TreeNode{Val: 6}}
      for _, k := range []int{1, 3, 6} {
          fmt.Println(kthSmallest(root, k))
      }`,
  },
  'grid-traversal': {
    expected: '4\n-1\n0',
    python: r`
      print(minutes_to_rot([[2, 1, 1], [1, 1, 0], [0, 1, 1]]))
      print(minutes_to_rot([[2, 1, 1], [0, 1, 1], [1, 0, 1]]))
      print(minutes_to_rot([[0, 2]]))`,
    cpp: r`
      cout << minutesToRot({{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}) << "\n";
      cout << minutesToRot({{2, 1, 1}, {0, 1, 1}, {1, 0, 1}}) << "\n";
      cout << minutesToRot({{0, 2}}) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.minutesToRot(new int[][] {{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}));
      show(s.minutesToRot(new int[][] {{2, 1, 1}, {0, 1, 1}, {1, 0, 1}}));
      show(s.minutesToRot(new int[][] {{0, 2}}));`,
    go: r`
      fmt.Println(minutesToRot([][]int{{2, 1, 1}, {1, 1, 0}, {0, 1, 1}}))
      fmt.Println(minutesToRot([][]int{{2, 1, 1}, {0, 1, 1}, {1, 0, 1}}))
      fmt.Println(minutesToRot([][]int{{0, 2}}))`,
  },
  'graph-connectivity': {
    expected: '2\n0\n1',
    python: r`
      d = DSU(5)
      for a, b in ((0, 1), (1, 2), (3, 4)):
          d.union(a, b)
      print(d.count)
      print(int(d.union(0, 2)))
      d.union(2, 3)
      print(d.count)`,
    cpp: r`
      DSU d(5);
      for (auto [a, b] : vector<pair<int, int>>{{0, 1}, {1, 2}, {3, 4}}) d.unite(a, b);
      cout << d.count << "\n";
      cout << d.unite(0, 2) << "\n";
      d.unite(2, 3);
      cout << d.count << "\n";`,
    java: r`
      DSU d = new DSU(5);
      for (int[] e : new int[][] {{0, 1}, {1, 2}, {3, 4}}) d.union(e[0], e[1]);
      show(d.count);
      show(d.union(0, 2) ? 1 : 0);
      d.union(2, 3);
      show(d.count);`,
    go: r`
      d := NewDSU(5)
      for _, e := range [][2]int{{0, 1}, {1, 2}, {3, 4}} {
          d.Union(e[0], e[1])
      }
      fmt.Println(d.count)
      if d.Union(0, 2) {
          fmt.Println(1)
      } else {
          fmt.Println(0)
      }
      d.Union(2, 3)
      fmt.Println(d.count)`,
  },
  'graph-topological': {
    expected: '4 0 1 2 3\n0\n3 2 0 1',
    python: r`
      for n, edges in ((4, [(0, 1), (0, 2), (1, 3), (2, 3)]), (2, [(0, 1), (1, 0)]), (3, [(2, 0), (2, 1)])):
          order = topo_order(n, edges)
          print(len(order), *order)`,
    cpp: r`
      for (auto& [n, edges] : vector<pair<int, vector<pair<int, int>>>>{
               {4, {{0, 1}, {0, 2}, {1, 3}, {2, 3}}}, {2, {{0, 1}, {1, 0}}}, {3, {{2, 0}, {2, 1}}}}) {
          auto order = topoOrder(n, edges);
          cout << order.size() << " ";
          show(order);
      }`,
    java: r`
      Solution s = new Solution();
      int[] ns = {4, 2, 3};
      int[][][] edges = {{{0, 1}, {0, 2}, {1, 3}, {2, 3}}, {{0, 1}, {1, 0}}, {{2, 0}, {2, 1}}};
      for (int i = 0; i < ns.length; i++) {
          List<Integer> order = s.topoOrder(ns[i], edges[i]);
          System.out.print(order.size() + " ");
          show(order);
      }`,
    go: r`
      ns := []int{4, 2, 3}
      edges := [][][2]int{{{0, 1}, {0, 2}, {1, 3}, {2, 3}}, {{0, 1}, {1, 0}}, {{2, 0}, {2, 1}}}
      for i, n := range ns {
          order := topoOrder(n, edges[i])
          fmt.Print(len(order), " ")
          show(order)
      }`,
  },
  'graph-shortest-path': {
    expected: '0 1 3 4 -1',
    python: r`
      print(*dijkstra(5, [(0, 1, 1), (0, 2, 4), (1, 2, 2), (2, 3, 1), (1, 3, 6)], 0))`,
    cpp: r`
      show(dijkstra(5, {{0, 1, 1}, {0, 2, 4}, {1, 2, 2}, {2, 3, 1}, {1, 3, 6}}, 0));`,
    java: r`
      show(new Solution().dijkstra(5, new int[][] {{0, 1, 1}, {0, 2, 4}, {1, 2, 2}, {2, 3, 1}, {1, 3, 6}}, 0));`,
    go: r`
      show(dijkstra(5, [][3]int{{0, 1, 1}, {0, 2, 4}, {1, 2, 2}, {2, 3, 1}, {1, 3, 6}}, 0))`,
  },
  'graph-spanning-tree': {
    expected: '7\n-1',
    python: r`
      print(mst_weight(4, [(0, 1, 1), (1, 2, 2), (0, 2, 3), (2, 3, 4), (1, 3, 5)]))
      print(mst_weight(3, [(0, 1, 1)]))`,
    cpp: r`
      cout << mstWeight(4, {{0, 1, 1}, {1, 2, 2}, {0, 2, 3}, {2, 3, 4}, {1, 3, 5}}) << "\n";
      cout << mstWeight(3, {{0, 1, 1}}) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.mstWeight(4, new int[][] {{0, 1, 1}, {1, 2, 2}, {0, 2, 3}, {2, 3, 4}, {1, 3, 5}}));
      show(s.mstWeight(3, new int[][] {{0, 1, 1}}));`,
    go: r`
      fmt.Println(mstWeight(4, [][3]int{{0, 1, 1}, {1, 2, 2}, {0, 2, 3}, {2, 3, 4}, {1, 3, 5}}))
      fmt.Println(mstWeight(3, [][3]int{{0, 1, 1}}))`,
  },
  'backtracking-enumeration': {
    expected: '6\n1 2 2\n10',
    python: r`
      res = subsets_with_dup([1, 2, 2])
      print(len(res))
      print(*res[3])
      print(len(subsets_with_dup([4, 4, 4, 1, 4])))`,
    cpp: r`
      auto res = subsetsWithDup({1, 2, 2});
      cout << res.size() << "\n";
      show(res[3]);
      cout << subsetsWithDup({4, 4, 4, 1, 4}).size() << "\n";`,
    java: r`
      Solution s = new Solution();
      List<List<Integer>> res = s.subsetsWithDup(new int[] {1, 2, 2});
      show(res.size());
      show(res.get(3));
      show(new Solution().subsetsWithDup(new int[] {4, 4, 4, 1, 4}).size());`,
    go: r`
      res := subsetsWithDup([]int{1, 2, 2})
      fmt.Println(len(res))
      show(res[3])
      fmt.Println(len(subsetsWithDup([]int{4, 4, 4, 1, 4})))`,
  },
  'backtracking-strings': {
    expected: '2\na a b\naa b\n1',
    python: r`
      res = partition("aab")
      print(len(res))
      for parts in res:
          print(*parts)
      print(len(partition("a")))`,
    cpp: r`
      auto res = partition("aab");
      cout << res.size() << "\n";
      for (auto& parts : res) show(parts);
      cout << partition("a").size() << "\n";`,
    java: r`
      List<List<String>> res = new Solution().partition("aab");
      show(res.size());
      for (List<String> parts : res) show(parts);
      show(new Solution().partition("a").size());`,
    go: r`
      res := partition("aab")
      fmt.Println(len(res))
      for _, parts := range res {
          show(parts)
      }
      fmt.Println(len(partition("a")))`,
  },
  'backtracking-constraints': {
    expected: '2\n92\n1',
    python: r`
      for n in (4, 8, 1):
          print(total_queens(n))`,
    cpp: r`
      for (int n : {4, 8, 1}) cout << totalQueens(n) << "\n";`,
    java: r`
      for (int n : new int[] {4, 8, 1}) show(new Solution().totalQueens(n));`,
    go: r`
      for _, n := range []int{4, 8, 1} {
          fmt.Println(totalQueens(n))
      }`,
  },
  'dp-foundations': {
    expected: '12\n0\n5\n4',
    python: r`
      for nums in ([2, 7, 9, 3, 1], [], [5], [1, 2, 3, 1]):
          print(rob(nums))`,
    cpp: r`
      for (auto& nums : vector<vector<int>>{{2, 7, 9, 3, 1}, {}, {5}, {1, 2, 3, 1}}) cout << rob(nums) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (int[] nums : new int[][] {{2, 7, 9, 3, 1}, {}, {5}, {1, 2, 3, 1}}) show(s.rob(nums));`,
    go: r`
      for _, nums := range [][]int{{2, 7, 9, 3, 1}, {}, {5}, {1, 2, 3, 1}} {
          fmt.Println(rob(nums))
      }`,
  },
  'dp-grid': {
    expected: '7\n12\n5',
    python: r`
      print(min_path_sum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]))
      print(min_path_sum([[1, 2, 3], [4, 5, 6]]))
      print(min_path_sum([[5]]))`,
    cpp: r`
      cout << minPathSum({{1, 3, 1}, {1, 5, 1}, {4, 2, 1}}) << "\n";
      cout << minPathSum({{1, 2, 3}, {4, 5, 6}}) << "\n";
      cout << minPathSum({{5}}) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.minPathSum(new int[][] {{1, 3, 1}, {1, 5, 1}, {4, 2, 1}}));
      show(s.minPathSum(new int[][] {{1, 2, 3}, {4, 5, 6}}));
      show(s.minPathSum(new int[][] {{5}}));`,
    go: r`
      fmt.Println(minPathSum([][]int{{1, 3, 1}, {1, 5, 1}, {4, 2, 1}}))
      fmt.Println(minPathSum([][]int{{1, 2, 3}, {4, 5, 6}}))
      fmt.Println(minPathSum([][]int{{5}}))`,
  },
  'dp-knapsack': {
    expected: '10\n2\n4\n0\n1',
    python: r`
      print(count_subsets([1, 1, 1, 1, 1], 3))
      print(count_subsets([2, 3, 5], 5))
      print(count_combinations([1, 2, 5], 5))
      print(count_combinations([2], 3))
      print(count_combinations([10], 0))`,
    cpp: r`
      cout << countSubsets({1, 1, 1, 1, 1}, 3) << "\n";
      cout << countSubsets({2, 3, 5}, 5) << "\n";
      cout << countCombinations({1, 2, 5}, 5) << "\n";
      cout << countCombinations({2}, 3) << "\n";
      cout << countCombinations({10}, 0) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.countSubsets(new int[] {1, 1, 1, 1, 1}, 3));
      show(s.countSubsets(new int[] {2, 3, 5}, 5));
      show(s.countCombinations(new int[] {1, 2, 5}, 5));
      show(s.countCombinations(new int[] {2}, 3));
      show(s.countCombinations(new int[] {10}, 0));`,
    go: r`
      fmt.Println(countSubsets([]int{1, 1, 1, 1, 1}, 3))
      fmt.Println(countSubsets([]int{2, 3, 5}, 5))
      fmt.Println(countCombinations([]int{1, 2, 5}, 5))
      fmt.Println(countCombinations([]int{2}, 3))
      fmt.Println(countCombinations([]int{10}, 0))`,
  },
  'dp-subsequence': {
    expected: '4\n1\n4\n0',
    python: r`
      for nums in ([10, 9, 2, 5, 3, 7, 101, 18], [7, 7, 7], [0, 1, 0, 3, 2, 3], []):
          print(lis_length(nums))`,
    cpp: r`
      for (auto& nums : vector<vector<int>>{{10, 9, 2, 5, 3, 7, 101, 18}, {7, 7, 7}, {0, 1, 0, 3, 2, 3}, {}})
          cout << lisLength(nums) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (int[] nums : new int[][] {{10, 9, 2, 5, 3, 7, 101, 18}, {7, 7, 7}, {0, 1, 0, 3, 2, 3}, {}})
          show(s.lisLength(nums));`,
    go: r`
      for _, nums := range [][]int{{10, 9, 2, 5, 3, 7, 101, 18}, {7, 7, 7}, {0, 1, 0, 3, 2, 3}, {}} {
          fmt.Println(lisLength(nums))
      }`,
  },
  'dp-string': {
    expected: '3\n5\n3\n0',
    python: r`
      for a, b in (("horse", "ros"), ("intention", "execution"), ("", "abc"), ("abc", "abc")):
          print(edit_distance(a, b))`,
    cpp: r`
      for (auto& [a, b] : vector<pair<string, string>>{{"horse", "ros"}, {"intention", "execution"}, {"", "abc"}, {"abc", "abc"}})
          cout << editDistance(a, b) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (String[] c : new String[][] {{"horse", "ros"}, {"intention", "execution"}, {"", "abc"}, {"abc", "abc"}})
          show(s.editDistance(c[0], c[1]));`,
    go: r`
      for _, c := range [][2]string{{"horse", "ros"}, {"intention", "execution"}, {"", "abc"}, {"abc", "abc"}} {
          fmt.Println(editDistance(c[0], c[1]))
      }`,
  },
  'dp-palindrome': {
    expected: '4\n2\n1\n0',
    python: r`
      for s in ("bbbab", "cbbd", "a", ""):
          print(longest_pal_subseq(s))`,
    cpp: r`
      for (string s : {"bbbab", "cbbd", "a", ""}) cout << longestPalSubseq(s) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (String t : new String[] {"bbbab", "cbbd", "a", ""}) show(s.longestPalSubseq(t));`,
    go: r`
      for _, s := range []string{"bbbab", "cbbd", "a", ""} {
          fmt.Println(longestPalSubseq(s))
      }`,
  },
  'dp-state-machine': {
    expected: '6\n0\n24\n-3',
    python: r`
      for nums in ([2, 3, -2, 4], [-2, 0, -1], [-2, 3, -4], [-3]):
          print(max_product(nums))`,
    cpp: r`
      for (auto& nums : vector<vector<int>>{{2, 3, -2, 4}, {-2, 0, -1}, {-2, 3, -4}, {-3}}) cout << maxProduct(nums) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (int[] nums : new int[][] {{2, 3, -2, 4}, {-2, 0, -1}, {-2, 3, -4}, {-3}}) show(s.maxProduct(nums));`,
    go: r`
      for _, nums := range [][]int{{2, 3, -2, 4}, {-2, 0, -1}, {-2, 3, -4}, {-3}} {
          fmt.Println(maxProduct(nums))
      }`,
  },
  'dp-stock': {
    expected: '3\n0\n0',
    python: r`
      for prices in ([1, 2, 3, 0, 2], [1], [5, 4, 3]):
          print(max_profit_cooldown(prices))`,
    cpp: r`
      for (auto& prices : vector<vector<int>>{{1, 2, 3, 0, 2}, {1}, {5, 4, 3}}) cout << maxProfitCooldown(prices) << "\n";`,
    java: r`
      Solution s = new Solution();
      for (int[] prices : new int[][] {{1, 2, 3, 0, 2}, {1}, {5, 4, 3}}) show(s.maxProfitCooldown(prices));`,
    go: r`
      for _, prices := range [][]int{{1, 2, 3, 0, 2}, {1}, {5, 4, 3}} {
          fmt.Println(maxProfitCooldown(prices))
      }`,
  },
  'dp-scheduling': {
    expected: '120\n150\n6',
    python: r`
      print(max_profit([1, 2, 3, 3], [3, 4, 5, 6], [50, 10, 40, 70]))
      print(max_profit([1, 2, 3, 4, 6], [3, 5, 10, 6, 9], [20, 20, 100, 70, 60]))
      print(max_profit([1, 1, 1], [2, 3, 4], [5, 6, 4]))`,
    cpp: r`
      cout << maxProfit({1, 2, 3, 3}, {3, 4, 5, 6}, {50, 10, 40, 70}) << "\n";
      cout << maxProfit({1, 2, 3, 4, 6}, {3, 5, 10, 6, 9}, {20, 20, 100, 70, 60}) << "\n";
      cout << maxProfit({1, 1, 1}, {2, 3, 4}, {5, 6, 4}) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.maxProfit(new int[] {1, 2, 3, 3}, new int[] {3, 4, 5, 6}, new int[] {50, 10, 40, 70}));
      show(s.maxProfit(new int[] {1, 2, 3, 4, 6}, new int[] {3, 5, 10, 6, 9}, new int[] {20, 20, 100, 70, 60}));
      show(s.maxProfit(new int[] {1, 1, 1}, new int[] {2, 3, 4}, new int[] {5, 6, 4}));`,
    go: r`
      fmt.Println(maxProfit([]int{1, 2, 3, 3}, []int{3, 4, 5, 6}, []int{50, 10, 40, 70}))
      fmt.Println(maxProfit([]int{1, 2, 3, 4, 6}, []int{3, 5, 10, 6, 9}, []int{20, 20, 100, 70, 60}))
      fmt.Println(maxProfit([]int{1, 1, 1}, []int{2, 3, 4}, []int{5, 6, 4}))`,
  },
  'dp-search-game': {
    expected: '7\n9',
    python: r`
      print(rob_tree(TreeNode(3, TreeNode(2, None, TreeNode(3)), TreeNode(3, None, TreeNode(1)))))
      print(rob_tree(TreeNode(3, TreeNode(4, TreeNode(1), TreeNode(3)), TreeNode(5, None, TreeNode(1)))))`,
    cpp: r`
      cout << robTree(new TreeNode(3, new TreeNode(2, nullptr, new TreeNode(3)), new TreeNode(3, nullptr, new TreeNode(1)))) << "\n";
      cout << robTree(new TreeNode(3, new TreeNode(4, new TreeNode(1), new TreeNode(3)), new TreeNode(5, nullptr, new TreeNode(1)))) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.robTree(new TreeNode(3, new TreeNode(2, null, new TreeNode(3)), new TreeNode(3, null, new TreeNode(1)))));
      show(s.robTree(new TreeNode(3, new TreeNode(4, new TreeNode(1), new TreeNode(3)), new TreeNode(5, null, new TreeNode(1)))));`,
    go: r`
      fmt.Println(robTree(&TreeNode{3, &TreeNode{2, nil, &TreeNode{Val: 3}}, &TreeNode{3, nil, &TreeNode{Val: 1}}}))
      fmt.Println(robTree(&TreeNode{3, &TreeNode{4, &TreeNode{Val: 1}, &TreeNode{Val: 3}}, &TreeNode{5, nil, &TreeNode{Val: 1}}}))`,
  },
  'design-containers': {
    expected: '1 2 3 4\n0\n5',
    python: r`
      it, out = Flatten2D([[1, 2], [3], [], [4]]), []
      while it.has_next():
          out.append(it.next())
      print(*out)
      print(int(Flatten2D([[], []]).has_next()))
      one = Flatten2D([[], [5]])
      one.has_next()
      one.has_next()
      print(one.next())`,
    cpp: r`
      Flatten2D it({{1, 2}, {3}, {}, {4}});  // built from a temporary: the iterator must own its rows
      vector<int> out;
      while (it.hasNext()) out.push_back(it.next());
      show(out);
      vector<vector<int>> empty{{}, {}}, single{{}, {5}};
      cout << Flatten2D(empty).hasNext() << "\n";
      Flatten2D one(single);
      one.hasNext();
      one.hasNext();
      cout << one.next() << "\n";`,
    java: r`
      Flatten2D it = new Flatten2D(List.of(List.of(1, 2), List.of(3), List.of(), List.of(4)));
      List<Integer> out = new ArrayList<>();
      while (it.hasNext()) out.add(it.next());
      show(out);
      show(new Flatten2D(List.of(List.of(), List.of())).hasNext() ? 1 : 0);
      Flatten2D one = new Flatten2D(List.of(List.of(), List.of(5)));
      one.hasNext();
      one.hasNext();
      show(one.next());`,
    go: r`
      it := &Flatten2D{rows: [][]int{{1, 2}, {3}, {}, {4}}}
      var out []int
      for it.HasNext() {
          out = append(out, it.Next())
      }
      show(out)
      if (&Flatten2D{rows: [][]int{{}, {}}}).HasNext() {
          fmt.Println(1)
      } else {
          fmt.Println(0)
      }
      one := &Flatten2D{rows: [][]int{{}, {5}}}
      one.HasNext()
      one.HasNext()
      fmt.Println(one.Next())`,
  },
  'design-cache-index': {
    expected: '1\n-1\n-1\n3\n4',
    python: r`
      c = LRUCache(2)
      c.put(1, 1)
      c.put(2, 2)
      print(c.get(1))
      c.put(3, 3)
      print(c.get(2))
      c.put(4, 4)
      for key in (1, 3, 4):
          print(c.get(key))`,
    cpp: r`
      LRUCache c(2);
      c.put(1, 1);
      c.put(2, 2);
      cout << c.get(1) << "\n";
      c.put(3, 3);
      cout << c.get(2) << "\n";
      c.put(4, 4);
      for (int key : {1, 3, 4}) cout << c.get(key) << "\n";`,
    java: r`
      LRUCache c = new LRUCache(2);
      c.put(1, 1);
      c.put(2, 2);
      show(c.get(1));
      c.put(3, 3);
      show(c.get(2));
      c.put(4, 4);
      for (int key : new int[] {1, 3, 4}) show(c.get(key));`,
    go: r`
      c := NewLRUCache(2)
      c.Put(1, 1)
      c.Put(2, 2)
      fmt.Println(c.Get(1))
      c.Put(3, 3)
      fmt.Println(c.Get(2))
      c.Put(4, 4)
      for _, key := range []int{1, 3, 4} {
          fmt.Println(c.Get(key))
      }`,
  },
  'design-trie-serialization': {
    expected: '3\n1\n1\n0\n0\n2',
    python: r`
      t = Trie()
      for w in ("apple", "app", "apply", "bat"):
          t.insert(w)
      print(t.count_prefix("app"))
      print(t.count_prefix("ba"))
      print(t.count_word("app"))
      print(t.count_word("ap"))
      print(t.count_prefix("c"))
      t.insert("app")
      print(t.count_word("app"))`,
    cpp: r`
      Trie t;
      for (string w : {"apple", "app", "apply", "bat"}) t.insert(w);
      cout << t.countPrefix("app") << "\n" << t.countPrefix("ba") << "\n";
      cout << t.countWord("app") << "\n" << t.countWord("ap") << "\n";
      cout << t.countPrefix("c") << "\n";
      t.insert("app");
      cout << t.countWord("app") << "\n";`,
    java: r`
      Trie t = new Trie();
      for (String w : new String[] {"apple", "app", "apply", "bat"}) t.insert(w);
      show(t.countPrefix("app"));
      show(t.countPrefix("ba"));
      show(t.countWord("app"));
      show(t.countWord("ap"));
      show(t.countPrefix("c"));
      t.insert("app");
      show(t.countWord("app"));`,
    go: r`
      t := &Trie{}
      for _, w := range []string{"apple", "app", "apply", "bat"} {
          t.Insert(w)
      }
      fmt.Println(t.CountPrefix("app"))
      fmt.Println(t.CountPrefix("ba"))
      fmt.Println(t.CountWord("app"))
      fmt.Println(t.CountWord("ap"))
      fmt.Println(t.CountPrefix("c"))
      t.Insert("app")
      fmt.Println(t.CountWord("app"))`,
  },
  'bits-math': {
    // 652541198 = pow(123456789, 987654321, 10**9 + 7), computed with Python's built-in pow.
    expected: '3\n0\n24\n73741817\n0\n652541198',
    python: r`
      print(popcount(11))
      print(popcount(0))
      print(pow_mod(2, 10, 1000))
      print(pow_mod(2, 30, 1_000_000_007))
      print(pow_mod(3, 0, 1))
      print(pow_mod(123456789, 987654321, 1_000_000_007))`,
    cpp: r`
      cout << popcount(11) << "\n" << popcount(0) << "\n";
      cout << powMod(2, 10, 1000) << "\n" << powMod(2, 30, 1000000007) << "\n";
      cout << powMod(3, 0, 1) << "\n" << powMod(123456789, 987654321, 1000000007) << "\n";`,
    java: r`
      Solution s = new Solution();
      show(s.popcount(11));
      show(s.popcount(0));
      show(s.powMod(2, 10, 1000));
      show(s.powMod(2, 30, 1_000_000_007));
      show(s.powMod(3, 0, 1));
      show(s.powMod(123456789, 987654321, 1_000_000_007));`,
    go: r`
      fmt.Println(popcount(11))
      fmt.Println(popcount(0))
      fmt.Println(powMod(2, 10, 1000))
      fmt.Println(powMod(2, 30, 1_000_000_007))
      fmt.Println(powMod(3, 0, 1))
      fmt.Println(powMod(123456789, 987654321, 1_000_000_007))`,
  },
};

const CPP_PRELUDE = [
  'algorithm', 'array', 'climits', 'cstdint', 'deque', 'functional', 'iostream', 'list', 'map',
  'numeric', 'queue', 'set', 'stack', 'stdexcept', 'string', 'tuple', 'unordered_map',
  'unordered_set', 'utility', 'vector',
]
  .map((h) => `#include <${h}>`)
  .join('\n') + '\nusing namespace std;\n';
const CPP_SHOW = r`
  template <class T>
  void show(const T& xs) {
      const char* sep = "";
      for (const auto& x : xs) cout << sep << x, sep = " ";
      cout << "\n";
  }`;
const JAVA_SHOW = r`
  static void show(Object o) { System.out.println(o); }
  static void show(Collection<?> c) { System.out.println(c.stream().map(String::valueOf).collect(Collectors.joining(" "))); }
  static void show(int[] a) { System.out.println(Arrays.stream(a).mapToObj(String::valueOf).collect(Collectors.joining(" "))); }
  static void show(long[] a) { System.out.println(Arrays.stream(a).mapToObj(String::valueOf).collect(Collectors.joining(" "))); }`;
const GO_SHOW = r`
  func show[T any](xs []T) {
      for i, x := range xs {
          if i > 0 {
              fmt.Print(" ")
          }
          fmt.Print(x)
      }
      fmt.Println()
  }`;

const CXX = process.env.CXX || 'g++';
type Run = { file: string; source: string; steps: [string, string[]][] };
/** The whole program for one stop, and the commands that build and run it. */
function program(lang: TemplateLang, code: string, driver: string): Run {
  if (lang === 'python')
    return { file: 'main.py', source: `${code}\n\n\n${driver}\n`, steps: [['python3', ['main.py']]] };
  if (lang === 'cpp')
    return {
      file: 'main.cpp',
      source: `${CPP_PRELUDE}\n${code}\n\n${CPP_SHOW}\n\nint main() {\n${driver}\n}\n`,
      steps: [[CXX, ['-std=c++17', '-o', 'main', 'main.cpp']], ['./main', []]],
    };
  if (lang === 'java') {
    // Imports must precede every class; Main comes first so `java Main.java` launches it.
    const imports = code.match(/^import .*;$/gm) ?? [];
    const body = code.replace(/^import .*;\n*/gm, '');
    const head = ['java.util.*', 'java.util.function.*', 'java.util.stream.*'].map((p) => `import ${p};`);
    return {
      file: 'Main.java',
      source: `${[...head, ...imports].join('\n')}\n\npublic class Main {\n${JAVA_SHOW}\n\npublic static void main(String[] args) {\n${driver}\n}\n}\n\n${body}\n`,
      steps: [['java', ['Main.java']]],
    };
  }
  // A template's own imports follow fmt; templates never import fmt themselves.
  return {
    file: 'main.go',
    source: `package main\n\nimport "fmt"\n\n${code}\n\n${GO_SHOW}\n\nfunc main() {\n${driver}\n}\n`,
    steps: [['go', ['run', 'main.go']]],
  };
}

const has = (cmd: string, args: string[]) => spawnSync(cmd, args, { stdio: 'ignore' }).status === 0;
const TOOLCHAINS: Record<TemplateLang, boolean> = {
  python: has('python3', ['--version']),
  cpp: has(CXX, ['--version']),
  java: has('java', ['-version']) && has('javac', ['-version']),
  go: has('go', ['version']),
};
const exec = promisify(execFile);
const normalize = (out: string) =>
  out.split('\n').map((line) => line.trimEnd()).join('\n').trim();

void test('every Line 500 stop has a complete bilingual template, in route order', () => {
  const slugs = ROUTE_SECTIONS.flatMap((section) => section.slugs);
  assert.equal(routeTemplates.length, 35);
  assert.deepEqual(routeTemplates.map((t) => t.slug), slugs);
  assert.deepEqual(Object.keys(DRIVERS).sort(), [...slugs].sort());
  const cjk = /[一-鿿]/;
  for (const t of routeTemplates) {
    assert.equal(templateFor(t.slug), t);
    assert.equal(t.points.length, 3, t.slug);
    assert.equal(t.pitfalls.length, 3, t.slug);
    for (const text of [t.pattern, ...t.points, ...t.pitfalls]) {
      assert(cjk.test(text.zh), `${t.slug}: zh text should be Chinese`);
      assert(text.en.trim() && !cjk.test(text.en), `${t.slug}: en text should be English`);
    }
    assert(/O\(/.test(t.complexity), t.slug);
    for (const [lang] of TEMPLATE_LANGS) {
      assert(t.code[lang].trim().length > 0, `${t.slug} ${lang}`);
      assert(!t.code[lang].includes('"fmt"'), `${t.slug}: the Go harness imports fmt`);
    }
  }
  assert.equal(templateFor('no-such-stop'), undefined);
  assert.equal(line500Path('binary-search'), '/?view=problems&section=binary-search');
});

void test('topic pages are in the sitemap; code comments are found outside literals', () => {
  const paths = new Set(SITEMAP_STATIC_ENTRIES.map((entry) => entry.path));
  assert(paths.has('/topics'));
  for (const t of routeTemplates) assert(paths.has(`/topics/${t.slug}`), t.slug);
  assert.equal(commentStart('x = "a#b"  # note', 'python'), 11);
  assert.equal(commentStart("c = '/'; // ok", 'cpp'), 9);
  assert.equal(commentStart('s := "//"', 'go'), -1);
});

const limit = Math.max(1, Math.min(3, availableParallelism() - 1));
for (const [lang, label] of TEMPLATE_LANGS) {
  void test(
    `${label} templates compile and print the expected answers`,
    { skip: !TOOLCHAINS[lang] && `${label} toolchain not installed`, timeout: 600_000 },
    async () => {
      const root = mkdtempSync(join(tmpdir(), `route-templates-${lang}-`));
      const failures: string[] = [];
      try {
        const queue = [...routeTemplates];
        const worker = async () => {
          for (let t = queue.shift(); t; t = queue.shift()) {
            const driver = DRIVERS[t.slug];
            const dir = mkdtempSync(join(root, `${t.slug}-`));
            const run = program(lang, t.code[lang], driver[lang]);
            writeFileSync(join(dir, run.file), run.source);
            let stdout = '';
            try {
              for (const [cmd, args] of run.steps)
                ({ stdout } = await exec(cmd, args, { cwd: dir, timeout: 120_000 }));
            } catch (error) {
              const e = error as { stderr?: string; message: string };
              failures.push(`${t.slug}: ${(e.stderr || e.message).slice(0, 1500)}`);
              continue;
            }
            if (normalize(stdout) !== driver.expected)
              failures.push(`${t.slug}: expected\n${driver.expected}\ngot\n${normalize(stdout)}`);
          }
        };
        await Promise.all(Array.from({ length: limit }, worker));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
      assert.deepEqual(failures, []);
    },
  );
}
