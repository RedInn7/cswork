import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ojImportSchema } from '../../../lib/oj-types.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const OA = resolve(ROOT, 'content/oa-judge');
const ID = 'oa-ericsson-1';
const BATCH = 'ericsson-1-exhaustive';
const UPSTREAM_COMMIT = 'e66f809f4c953bce129f68491726176615db6afc';
const SOURCE_URL = 'https://oamaster.com/docs/companies/ericsson#1-pascals-triangle';
const PAGE_BLOB = '8fecc3e084ea7b39853376403944744adc8756f5';
const PAGE_SHA256 = '1b8621068d7a6345050cc0fcef7c4f7c52b33e7626b666a76a3b5a32137d3608';
const SOURCE_HASH = 'a25fd936a3867511f8561da85b0f500015becbdc28bf91da8a00e09df245972d';

const reference = String.raw`import json
import sys

def solve(raw):
    num_rows = int(raw.strip())
    if not 0 <= num_rows <= 30:
        raise ValueError("numRows must be between 0 and 30")
    triangle = []
    for index in range(num_rows):
        row = [1] * (index + 1)
        for column in range(1, index):
            row[column] = triangle[index - 1][column - 1] + triangle[index - 1][column]
        triangle.append(row)
    return json.dumps(triangle, separators=(",", ":"))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
`;

const mutants = [
  {
    name: '少输出最后一行',
    code: String.raw`import json,sys
n=int(sys.stdin.read().strip()); rows=[]
for i in range(max(0,n-1)):
 r=[1]*(i+1)
 for j in range(1,i):r[j]=rows[i-1][j-1]+rows[i-1][j]
 rows.append(r)
print(json.dumps(rows,separators=(",",":")))
`,
  },
  {
    name: '错误累加左侧系数',
    code: String.raw`import json,sys
n=int(sys.stdin.read().strip()); rows=[]
for i in range(n):
 r=[1]*(i+1)
 for j in range(1,i):r[j]=2*rows[i-1][j-1]
 rows.append(r)
print(json.dumps(rows,separators=(",",":")))
`,
  },
];

function sha(data) {
  return createHash('sha256').update(data).digest('hex');
}

function writeJson(folder, filename, value) {
  writeFileSync(
    resolve(OA, folder, filename),
    JSON.stringify(value, null, 2) + '\n',
  );
}

function expectedTriangle(count) {
  return Array.from({ length: count }, (_, row) =>
    Array.from({ length: row + 1 }, (_, column) => {
      let coefficient = 1;
      for (let step = 1; step <= column; step++)
        coefficient = (coefficient * (row - step + 1)) / step;
      return coefficient;
    }),
  );
}

function run(code, input) {
  const result = spawnSync('python3', ['-I', '-c', code], {
    input,
    encoding: 'utf8',
    timeout: 8000,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function main() {
  const catalog = JSON.parse(
    readFileSync(resolve(ROOT, 'content/oa-master/catalog.json'), 'utf8'),
  );
  const source = catalog.items.find((item) => item.id === ID);
  assert(source, 'Missing Ericsson #1 in source catalog');
  assert.equal(source.contentHash, SOURCE_HASH);
  const previousReason = JSON.parse(
    readFileSync(resolve(OA, 'reviews/misc-saas-remaining.json'), 'utf8'),
  ).items.find((item) => item.id === ID)?.reason;
  assert(previousReason?.includes('31 种输入'));

  const formalCases = [];
  const oracle = [];
  const exhaustiveInputs = [];
  const mutated = new Set();
  for (let count = 0; count <= 30; count++) {
    const input = `${count}\n`;
    const expectedOutput = JSON.stringify(expectedTriangle(count));
    exhaustiveInputs.push(input);
    oracle.push({ input, expectedOutput });
    const row = {
      name: count === 0 ? '原题空三角样例' : count === 5 ? '原题五行样例' : `输入全域 numRows=${count}`,
      input,
      expectedOutput: expectedOutput + '\n',
      hidden: count !== 0 && count !== 5,
      weight: 1,
    };
    assert.equal(run(reference, input), expectedOutput);
    formalCases.push(row);
    for (const mutant of mutants)
      if (run(mutant.code, input) !== expectedOutput) mutated.add(mutant.name);
  }
  assert.deepEqual([...mutated].sort(), mutants.map((item) => item.name).sort());

  const problem = {
    id: ID,
    courseId: 'gomall',
    lessonId: '00-overview',
    title: "Pascal's Triangle",
    difficulty: '简单',
    tags: ['OA', 'Ericsson', '数组', '动态规划'],
    description: '给定非负整数 numRows，返回杨辉三角的前 numRows 行。',
    input: '输入一个整数 numRows（0≤numRows≤30）。',
    output: '输出紧凑 JSON 二维整数数组；numRows=0 时输出 []。',
    explanation: '用上一行相邻元素之和构造新行。完整题解见配套讲义。',
    hints: ['每行的首尾元素为 1，内部元素等于上一行相邻两项之和。'],
    timeLimit: 2,
    memoryLimit: 65536,
    outputLimit: 4096,
    checker: 'tokens',
    languages: ['python', 'go', 'java', 'cpp'],
  };
  const packageDocument = ojImportSchema.parse({
    schemaVersion: 1,
    problem,
    cases: formalCases,
  });
  const packageBytes = JSON.stringify(packageDocument);
  const editorial = `# Pascal's Triangle\n\n## 思路\n\n从第一行开始逐行构造。每行首尾为 1，内部位置由上一行相邻两数相加得到。\n\n## 正确性\n\n对行号归纳：首行只有 1，符合定义；假设上一行正确，新行首尾设为 1，内部按定义相加，因此新行每个位置都正确。重复构造即可得到前 numRows 行；numRows=0 时自然返回空数组。\n\n## 复杂度\n\n时间与输出空间均为 O(numRows²)。\n\n## 参考实现\n\n\`\`\`python\n${reference}\`\`\`\n`;
  const manifestItem = {
    id: ID,
    sourceContentHash: source.contentHash,
    packageChecksum: sha(packageBytes),
    editorial,
    authoredSolutions: [{ language: 'python', code: reference }],
    oracleCoverage: { mode: 'exhaustive', inputs: exhaustiveInputs },
  };

  for (const folder of [
    'candidate-batches', 'packages', 'references', 'oracles', 'mutants',
    'editorials', 'validation', 'source-evidence', 'resolutions',
  ]) mkdirSync(resolve(OA, folder), { recursive: true });
  const manifest = {
    schemaVersion: 1,
    items: [manifestItem],
  };
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  const reportPath = resolve(OA, 'reports', `${BATCH}.json`);
  let report;
  try {
    report = JSON.parse(readFileSync(reportPath, 'utf8'));
  } catch {}
  const reportProblem = report?.problems?.find((item) => item.id === ID);
  const reportValid = Boolean(
    report?.allPassed &&
    report.batch === BATCH &&
    report.batchSha256 === sha(Buffer.from(manifestBytes)) &&
    reportProblem?.formal === formalCases.length &&
    reportProblem?.oracle === oracle.length &&
    reportProblem?.passed === formalCases.length + oracle.length &&
    reportProblem?.killed?.length === mutants.length,
  );
  const manifestFolder = reportValid ? 'batches' : 'candidate-batches';
  writeJson(manifestFolder, `${BATCH}.json`, manifest);
  const candidatePath = resolve(OA, 'candidate-batches', `${BATCH}.json`);
  if (reportValid && existsSync(candidatePath)) unlinkSync(candidatePath);
  writeJson('packages', `${ID}.json`, packageDocument);
  writeFileSync(resolve(OA, 'references', `${ID}.py`), reference);
  writeJson('oracles', `${ID}.json`, oracle);
  writeJson('mutants', `${ID}.json`, mutants);
  writeJson('editorials', `${ID}.json`, {
    schemaVersion: 1,
    id: ID,
    title: "Pascal's Triangle",
    explanation: editorial,
    solutions: [{ language: 'python', code: reference }],
    sourceUrl: SOURCE_URL,
    sourceContentHash: source.contentHash,
    author: 'CSWork',
  });
  writeJson('validation', `${BATCH}.json`, {
    schemaVersion: 1,
    note: reportValid
      ? `用户自有 GoJudge 通过 ${reportProblem.passed} 项（${reportProblem.formal} 正式用例 + ${reportProblem.oracle} 全域 oracle），两个错误实现均被击杀。`
      : '穷举原题全部 31 种合法输入（numRows=0..30）；oracle 用组合数公式独立生成；两个错误实现均被反例击杀。',
    problems: [{
      id: ID,
      formalCases: formalCases.length,
      oracleCases: oracle.length,
      exhaustiveDomain: { field: 'numRows', minimum: 0, maximum: 30 },
      negativeControls: mutants.map((mutant) => ({
        name: mutant.name,
        rejectedByCases: formalCases.flatMap((test, index) =>
          run(mutant.code, test.input) !== test.expectedOutput.trim() ? [index] : [],
        ),
      })),
      referenceSha256: sha(Buffer.from(reference)),
      oracleSha256: sha(readFileSync(resolve(OA, 'oracles', `${ID}.json`))),
    }],
  });
  writeJson('source-evidence', `${BATCH}.json`, {
    schemaVersion: 1,
    repository: 'https://github.com/RedInn7/OA-Master',
    commit: UPSTREAM_COMMIT,
    catalogContentHash: source.contentHash,
    pages: [{
      company: 'Ericsson',
      path: 'web/content/docs/companies/ericsson.mdx',
      gitBlobSha: PAGE_BLOB,
      sha256: PAGE_SHA256,
    }],
    items: [{
      id: ID,
      title: "Pascal's Triangle",
      sourceUrl: SOURCE_URL,
      sourceContentHash: source.contentHash,
      previousStatus: 'blocked',
      previousReason,
      evidence: reportValid
        ? `固定 OAMaster 来源明确 numRows=0..30、逐行递推规则、五行样例和零行样例，并提供 Python/Java/C++ 同义实现。用户自有 GoJudge 通过 ${reportProblem.passed} 项，两个错误实现均被击杀。`
        : '固定 OAMaster 来源明确 numRows=0..30、逐行递推规则、五行样例和零行样例，并提供 Python/Java/C++ 同义实现。',
      status: reportValid ? 'authored' : 'candidate',
      siteAdditions: ['紧凑 JSON 输出协议'],
      exhaustiveOracle: '31 个合法整数输入全部覆盖；不扩充域、不以格式变体凑 oracle 数量。',
    }],
  });
  writeJson('resolutions', `${BATCH}.json`, {
    schemaVersion: 1,
    items: [{
      id: ID,
      batch: BATCH,
      sourceContentHash: source.contentHash,
      previousReason,
      reason: '原题合法输入域只有 numRows=0..30，共 31 种。已逐一穷举全域，并用独立组合数公式生成 oracle；两个错误实现均被反例击杀。本站补充紧凑 JSON 输出协议。' + (reportValid ? `用户自有 GoJudge 全部 ${reportProblem.passed} 项通过。` : ''),
    }],
  });
  console.log(JSON.stringify({
    id: ID,
    batch: BATCH,
    formalCases: formalCases.length,
    exhaustiveOracleCases: oracle.length,
    mutantsKilled: mutated.size,
    sandboxVerified: reportValid,
    packageChecksum: manifestItem.packageChecksum,
  }));
}

main();
