import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  cleanOaStatement,
  formatOaVerifiedStatement,
} from '../lib/oa-verified-statement';

test('OA reader renders corrected public rules and samples, never solution hints', () => {
  const spec = {
    description: '独立校正的题意',
    input: 'n 个数',
    output: '输出总和',
    explanation: '1+2=3',
    hints: ['PRIVATE_HINT'],
    editorial: 'PRIVATE_SOLUTION',
  };
  const result = formatOaVerifiedStatement(spec, [
    { input: '2\n1 2\n', expectedOutput: '3\n' },
  ]);
  assert.match(result, /独立校正的题意/);
  assert.match(result, /## 样例 1/);
  assert.match(result, /```text\n3\n```/);
  assert.match(result, /1\+2=3/);
  assert.doesNotMatch(result, /PRIVATE/);
});

test('sample markdown fences cannot be closed by literal backticks in input', () => {
  const result = formatOaVerifiedStatement(
    { description: '', input: '', output: '', explanation: '' },
    [{ input: '```\n# literal', expectedOutput: '1' }],
  );
  assert.match(result, /````text\n```\n# literal\n````/);
});

test('verified reader queries only visible samples after version binding', () => {
  const source = readFileSync('lib/server/oa-judge.ts', 'utf8');
  const section = source.slice(
    source.indexOf('export async function oaVerifiedStatement'),
  );
  assert.match(section, /oaJudgeRegistry\(\)\.isReady\(version\)/);
  assert.match(
    section,
    /SELECT input,expected_output AS expectedOutput FROM oj_test_cases WHERE version_id=\? AND hidden=0 ORDER BY ordinal/,
  );
  assert.match(
    readFileSync('lib/server/oa-library.ts', 'utf8'),
    /if \(ready.has\(id\)\) detail.statement = await oaVerifiedStatement\(id\)/,
  );
});

const blank = { description: '', input: '', output: '', explanation: '' };
const clean = (field: 'description' | 'input' | 'explanation', text: string) =>
  cleanOaStatement({ ...blank, [field]: text })[field];

test('display copy drops provenance, keeps format notes and rules (real package text)', () => {
  // oa-weride-5: source link + fingerprint paragraph goes, "this site specifies stdin/stdout" stays.
  assert.equal(
    clean(
      'description',
      'A robot starts at (x1,y1).\n\nThe ranges of the start and end points and the two moves are precisely defined; this site specifies stdin/stdout.\n\nSource: https://oamaster.com/docs/companies/weride#5-bot-movement-reachability-two-move-types (fixed statement fingerprint b1639717ffbe4708cefb3029bfffbbb3d069343624539d09b7792a5e067eb34c). The input/output protocol and bounds added by this site are as described in the statement and are not claimed to be rules of the original site.',
    ),
    'A robot starts at (x1,y1).\n\nThe ranges of the start and end points and the two moves are precisely defined; this site specifies stdin/stdout.',
  );
  assert.equal(
    clean(
      'description',
      '起终点范围和两种移动精确定义；本站规定 stdin/stdout。\n\n来源：https://oamaster.com/docs/companies/weride#5（固定题面指纹 b1639717ffbe4708cefb3029bfffbbb3d069343624539d09b7792a5e067eb34c）。本站新增的输入输出协议/边界按题面说明，不声称为原站规则。',
    ),
    '起终点范围和两种移动精确定义；本站规定 stdin/stdout。',
  );
  // oa-abaka-ai-1: the disclaimer paragraph goes, the "本站限定" rule in the input stays.
  assert.equal(
    clean(
      'description',
      '求最短总处理时间。\n\n本站明确的标准输入输出格式与补充约束属于在线版本定义，不冒充来源原始约束。',
    ),
    '求最短总处理时间。',
  );
  const rules = [
    '本站限定每个任务可单独运行，即使其内存不适合与其他任务并行。',
    'This site specifies that every task can run alone, even if its memory does not allow it to run in parallel with another task.',
    // oa-visa-18: "site-added" that is itself a rule.
    'cost 为 0..10⁹，技能为 0/1。非负成本为本站补充；答案用 64 位整数。',
    'Non-negative costs are site-added; answers use 64-bit integers.',
    // oa-epifi-1: "来源/source" servers are problem content.
    '固定距离时，来源与接收服务器形成区间二分图；按位置贪心匹配最左剩余请求。',
    // oa-amazon-62 style rule that mentions the original problem.
    'When the array is already sorted, zero swaps are valid for every non-negative k, so the literal original problem has no finite maximum.',
  ];
  for (const text of rules) assert.equal(clean('input', text), text);
  // Untouched markdown is byte-for-byte, including fenced text and hard line breaks.
  const markdown =
    'Line one  \nline two.\n\n```\nSource: https://oamaster.com/x\n```';
  assert.equal(clean('description', markdown), markdown);
  // A dropped attribution keeps what it introduces, and brackets stay balanced.
  assert.equal(
    clean(
      'explanation',
      '另两公开例为本站补充，aaaa可由a---重复复制得到，全部横线因没有来源字母而失败。',
    ),
    'aaaa可由a---重复复制得到，全部横线因没有来源字母而失败。',
  );
  assert.equal(
    clean(
      'input',
      'A single integer n (site range 1≤n≤10^18; the source gives no constraint on n).',
    ),
    'A single integer n (site range 1≤n≤10^18).',
  );
  assert.equal(
    clean('input', '原始快照无数值界，本站1≤n≤200000，元素−10^9..10^9。'),
    '本站1≤n≤200000，元素−10^9..10^9。',
  );
});

test('OA reader omits a sample note that only points at the notes or repeats a hint', () => {
  const sample = [{ input: '1\n', expectedOutput: '1\n' }];
  for (const [explanation, hints] of [
    ['完整思路、证明及复杂度见配套讲义。', []],
    [
      'See the accompanying notes for the full approach, proof, and complexity.',
      [],
    ],
    ['按 taskType 分组。', ['按 taskType 分组。']],
  ] as const)
    assert.doesNotMatch(
      formatOaVerifiedStatement(
        { ...blank, explanation, hints: [...hints] },
        sample,
      ),
      /样例说明/,
    );
  for (const id of [
    'oa-weride-5',
    'oa-abaka-ai-1',
    'oa-google-45',
    'oa-intuit-4',
  ]) {
    const zh = JSON.parse(
      readFileSync(`content/oa-judge/packages/${id}.json`, 'utf8'),
    ).problem;
    const en = JSON.parse(
      readFileSync(`content/oa-judge/translations/${id}.json`, 'utf8'),
    ).en;
    for (const spec of [zh, en]) {
      const shown = cleanOaStatement(spec);
      const text = [
        shown.description,
        shown.input,
        shown.output,
        shown.explanation,
      ].join('\n');
      assert.doesNotMatch(
        text,
        /https?:\/\/|fingerprint|指纹|oamaster|not claimed|不声称|冒充|配套讲义|accompanying notes/i,
        id,
      );
      assert.ok(
        !shown.explanation || !shown.hints.includes(shown.explanation),
        id,
      );
    }
  }
});
