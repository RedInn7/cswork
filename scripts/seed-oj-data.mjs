/** Original cswork exercises only. Deterministic boundary inputs stay on the server. */
export function createOjSeedPackages(problems) {
  const c = (name, input, expectedOutput, weight = 10) => ({
    name,
    input,
    expectedOutput,
    hidden: true,
    weight,
  });
  const hidden = {
    'watch-intervals': [
      c('一个区间', '1\n0 1\n', '1\n'),
      c('乱序与相邻区间', '5\n8 10\n0 9\n1 3\n15 20\n20 25\n', '20\n'),
      c(
        '重复与完全包含',
        '3\n0 1000000000\n1 2\n0 1000000000\n',
        '1000000000\n',
      ),
      c('相同左端点', '4\n5 6\n5 20\n5 10\n0 5\n', '20\n'),
      c(
        '离散逆序区间',
        '100000\n' +
          Array.from(
            { length: 100000 },
            (_, i) => `${2 * (99999 - i)} ${2 * (99999 - i) + 1}`,
          ).join('\n') +
          '\n',
        '100000\n',
        30,
      ),
    ],
    'product-top-k': [
      c('商品不足 K 种', '6 5\n9 9 9 9 9 9\n', '9 6\n'),
      c('同频按 ID 排序', '8 3\n2 2 1 1 8 8 9 10\n', '1 2\n2 2\n8 2\n'),
      c('输出全部商品', '5 5\n5 4 3 2 1\n', '1 1\n2 1\n3 1\n4 1\n5 1\n'),
      c('单个最大 ID', '1 1\n1000000000\n', '1000000000 1\n'),
      c(
        '十万次点击',
        '100000 3\n' +
          Array.from({ length: 100000 }, (_, i) => (i % 1000) + 1).join(' ') +
          '\n',
        '1 100\n2 100\n3 100\n',
        30,
      ),
    ],
    'study-plan': [
      c('动态更新最小节点', '3 1\n1 2\n', '1 2 3\n'),
      c('有向环', '3 3\n1 2\n2 3\n3 1\n', 'IMPOSSIBLE\n'),
      c('没有依赖', '5 0\n', '1 2 3 4 5\n'),
      c('重复边', '4 4\n1 3\n1 3\n2 3\n3 4\n', '1 2 3 4\n'),
      c('自环', '2 1\n1 1\n', 'IMPOSSIBLE\n'),
      c(
        '十万节点长链',
        '100000 99999\n' +
          Array.from({ length: 99999 }, (_, i) => `${i + 1} ${i + 2}`).join(
            '\n',
          ) +
          '\n',
        Array.from({ length: 100000 }, (_, i) => i + 1).join(' ') + '\n',
        30,
      ),
      c('二十万条重复边', '2 200000\n' + '1 2\n'.repeat(200000), '1 2\n', 20),
    ],
    'rate-window': [
      c(
        '相同时间与左开窗口',
        '4 2 1\n0 0 2 2\n',
        'ACCEPT\nREJECT\nACCEPT\nREJECT\n',
      ),
      c(
        '拒绝请求不占窗口',
        '5 10 1\n0 9 10 19 20\n',
        'ACCEPT\nREJECT\nACCEPT\nREJECT\nACCEPT\n',
      ),
      c('窗口未满', '3 100 100\n0 0 0\n', 'ACCEPT\nACCEPT\nACCEPT\n'),
      c(
        '最大时间边界',
        '4 1000000000 1\n0 999999999 1000000000 1000000000\n',
        'ACCEPT\nREJECT\nACCEPT\nREJECT\n',
      ),
      c(
        '十万请求吞吐',
        '100000 1 1\n' +
          Array.from({ length: 100000 }, (_, i) => i).join(' ') +
          '\n',
        'ACCEPT\n'.repeat(100000),
        30,
      ),
    ],
  };
  return problems.map(({ sampleIn, sampleOut, ...problem }) => ({
    schemaVersion: 1,
    problem: {
      ...problem,
      hints: problem.hints.map((hint, index) =>
        problem.id === 'watch-intervals' && index === 2
          ? '区间都位于 [0, 10⁹] 内，总覆盖时长不会超过 10⁹；不要把区间之间的空白计入。'
          : hint,
      ),
      courseId: 'gomall',
      outputLimit: 4096,
      checker: 'tokens',
      languages: ['python', 'go', 'java', 'cpp'],
    },
    cases: [
      {
        name: '样例 1',
        input: sampleIn,
        expectedOutput: sampleOut,
        hidden: false,
        weight: 10,
      },
      ...hidden[problem.id],
    ],
  }));
}
