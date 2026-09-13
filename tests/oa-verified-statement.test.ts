import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { formatOaVerifiedStatement } from '../lib/oa-verified-statement';

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
