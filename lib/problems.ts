export type Language = 'python' | 'go' | 'java' | 'cpp';
export const languages: { id: Language; name: string }[] = [
  { id: 'python', name: 'Python 3' },
  { id: 'go', name: 'Go' },
  { id: 'java', name: 'Java' },
  { id: 'cpp', name: 'C++' },
];
export const starters: Record<Language, string> = {
  python:
    '# 从标准输入读取数据，将答案输出到标准输出\nimport sys\n\ndef solve():\n    data = sys.stdin.read().split()\n    # 在这里实现你的解法\n\nif __name__ == "__main__":\n    solve()\n',
  go: 'package main\n\nimport (\n    "bufio"\n    "fmt"\n    "os"\n)\n\nfunc main() {\n    in := bufio.NewReader(os.Stdin)\n    var n int\n    fmt.Fscan(in, &n)\n    // 在这里实现你的解法\n}\n',
  java: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        // 在这里实现你的解法\n    }\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // 在这里实现你的解法\n    return 0;\n}\n',
};
export type Problem = {
  id: string;
  title: string;
  difficulty: '简单' | '中等';
  tags: string[];
  description: string;
  input: string;
  output: string;
  sampleIn: string;
  sampleOut: string;
  explanation: string;
  hints: string[];
  lessonId: string;
  timeLimit: number;
  memoryLimit: number;
};
export const problems: Problem[] = [
  {
    id: 'watch-intervals',
    title: '合并观看进度',
    difficulty: '简单',
    tags: ['排序', '区间合并'],
    description:
      '一位学员反复观看同一节课，系统记录了 n 段已观看区间 [l, r)。区间可能乱序、重叠或相邻。请计算至少被观看过一次的总秒数。重叠部分只计算一次。',
    input:
      '第一行一个整数 n（1 ≤ n ≤ 100000）。之后 n 行，每行两个整数 l、r（0 ≤ l < r ≤ 10⁹）。',
    output: '输出一个整数，表示总观看秒数。',
    sampleIn: '4\n0 10\n5 15\n20 30\n30 35\n',
    sampleOut: '30\n',
    explanation: '前两段合并为 [0,15)，后两段合并为 [20,35)，共 30 秒。',
    hints: [
      '先按区间左端点排序，再考虑相邻区间的关系。',
      '维护当前合并区间的右端点。新左端点大于它时，结算当前区间。',
      '总长度可能超过 32 位整数，使用 64 位整数。',
    ],
    lessonId: '00-overview',
    timeLimit: 2,
    memoryLimit: 262144,
  },
  {
    id: 'product-top-k',
    title: '商品热榜 Top K',
    difficulty: '简单',
    tags: ['哈希表', '排序'],
    description:
      '给定 n 次商品点击，每次点击包含一个商品 ID。请按点击次数从多到少输出前 k 个商品。同频时 ID 小的优先。商品不足 k 种时输出全部。',
    input:
      '第一行 n、k（1 ≤ k ≤ n ≤ 100000）。第二行 n 个商品 ID（1 ≤ ID ≤ 10⁹）。',
    output: '每行输出商品 ID 和点击次数，按排名顺序输出。',
    sampleIn: '7 2\n3 1 3 2 1 3 2\n',
    sampleOut: '3 3\n1 2\n',
    explanation: '商品 3 有三次点击。1 和 2 均有两次，ID 小的 1 排在前面。',
    hints: [
      '用哈希表统计每个商品的出现次数。',
      '排序时先比较次数（降序），再比较 ID（升序）。',
    ],
    lessonId: '07-product-search',
    timeLimit: 2,
    memoryLimit: 262144,
  },
  {
    id: 'study-plan',
    title: '安排学习顺序',
    difficulty: '中等',
    tags: ['图论', '拓扑排序'],
    description:
      '有 n 门编号为 1 到 n 的课，以及 m 条先修关系 u→v，表示学习 v 前必须完成 u。输出字典序最小的合法学习顺序。若存在循环依赖，输出 IMPOSSIBLE。',
    input:
      '第一行 n、m（1 ≤ n ≤ 100000，0 ≤ m ≤ 200000）。之后 m 行 u、v（1 ≤ u,v ≤ n）。可能出现重复关系。',
    output: '输出 n 个课程编号，以空格分隔；无法完成时输出 IMPOSSIBLE。',
    sampleIn: '4 3\n1 3\n2 3\n3 4\n',
    sampleOut: '1 2 3 4\n',
    explanation: '1 和 2 都可先学，字典序最小的选择是先 1 后 2。',
    hints: [
      '统计每个节点的入度，入度为零的节点可以立即处理。',
      '用小根堆保存可学习的课程，每次取编号最小的。',
      '最终取出的课程数少于 n，说明存在环。',
    ],
    lessonId: '00-overview-architecture',
    timeLimit: 3,
    memoryLimit: 262144,
  },
  {
    id: 'rate-window',
    title: '请求限流窗口',
    difficulty: '中等',
    tags: ['队列', '双指针'],
    description:
      '请求时间 t 按非递减顺序到达，窗口宽度为 W，最多接受 K 个请求。处理当前请求前，只保留此前已接受、时间处于 (t-W,t] 的请求。数量小于 K 就接受当前请求，否则拒绝。被拒绝的请求不占窗口。',
    input:
      '第一行 n、W、K（1 ≤ n ≤ 100000，1 ≤ W,K ≤ 10⁹）。第二行 n 个非负整数时间戳（≤10⁹），允许相同时间。',
    output: '每个请求输出一行 ACCEPT 或 REJECT。',
    sampleIn: '5 10 2\n0 1 2 10 11\n',
    sampleOut: 'ACCEPT\nACCEPT\nREJECT\nACCEPT\nACCEPT\n',
    explanation: '时间 10 时，时间 0 已离开左开窗口，因此可以接受请求。',
    hints: [
      '队列只存已接受的请求，不要把拒绝的请求加入。',
      '处理 t 时先移除所有时间 ≤ t-W 的元素。',
    ],
    lessonId: '14-middleware',
    timeLimit: 2,
    memoryLimit: 262144,
  },
];
