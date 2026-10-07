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
const ID = 'oa-amazon-38';
const BATCH = 'amazon-38-password-removal';
const UPSTREAM_COMMIT = 'e66f809f4c953bce129f68491726176615db6afc';
const SOURCE_URL = 'https://oamaster.com/docs/companies/amazon#38-calculate-min-cost-password-removal';
const SOURCE_HASH = '4cd956a84dd510453b5874263bb98527b3478eda91b561ea6bbdb960e2fa5196';
const PAGE_BLOB = '70650fad830ad60944ae8036fb4f134d9afc3fab';
const PAGE_SHA256 = '07d33d58794347890f76b4199a9805d5fac529f0702dea6884e6fce484b69985';

const reference = String.raw`import sys

def solve(raw):
    lines = raw.splitlines()
    if len(lines) != 3:
        raise ValueError("expected password, reference, and 26 costs")
    password, reference = lines[0], lines[1]
    costs = list(map(int, lines[2].split()))
    if not 1 <= len(password) <= 100_000 or not 1 <= len(reference) <= 100_000:
        raise ValueError("string length must be in [1, 100000]")
    if len(costs) != 26 or any(not 1 <= cost <= 100 for cost in costs):
        raise ValueError("expected 26 costs in [1, 100]")
    if any(not ('a' <= char <= 'z') for char in password + reference):
        raise ValueError("strings must contain lowercase English letters")
    removable = set(reference)
    return str(sum(costs[ord(char) - ord('a')] for char in password if char in removable))

if __name__ == "__main__":
    print(solve(sys.stdin.read()))
`;

const mutants = [
  {
    name: '只处理 reference 的第一个字符',
    description: '把 reference 错当成只指定一种待删除字符。',
    code: String.raw`import sys
p,r,raw=sys.stdin.read().splitlines(); c=list(map(int,raw.split())); key=r[0]
print(sum(c[ord(x)-97] for x in p if x==key))
`,
  },
  {
    name: '重复 password 字符只收费一次',
    description: '按字符种类累计，而没有按 password 中每次出现分别计费。',
    code: String.raw`import sys
p,r,raw=sys.stdin.read().splitlines(); c=list(map(int,raw.split())); keys=set(r)
print(sum(c[ord(x)-97] for x in set(p) if x in keys))
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

function inputFor(password, referenceText, costs) {
  return `${password}\n${referenceText}\n${costs.join(' ')}\n`;
}

// Independent small-instance oracle: enumerate every retained/deleted subset
// and choose the cheapest deletion set that leaves no reference character.
function oracle(password, referenceText, costs) {
  const forbidden = new Set(referenceText);
  let best = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 1 << password.length; mask++) {
    let valid = true;
    let deletionCost = 0;
    for (let index = 0; index < password.length; index++) {
      const kept = (mask & (1 << index)) !== 0;
      const char = password[index];
      if (kept && forbidden.has(char)) {
        valid = false;
        break;
      }
      if (!kept) deletionCost += costs[char.charCodeAt(0) - 97];
    }
    if (valid) best = Math.min(best, deletionCost);
  }
  return String(best);
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
  assert(source, 'Missing Amazon #38 in source catalog');
  assert.equal(source.contentHash, SOURCE_HASH);
  const previousReason = JSON.parse(
    readFileSync(resolve(OA, 'reviews/amazon-remaining-b.json'), 'utf8'),
  ).items.find((item) => item.id === ID)?.reason;
  assert(previousReason?.includes('任选一种字符'));

  let state = 20261038;
  const random = (maximum) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % maximum;
  };
  const costs = [1, ...Array.from({ length: 25 }, () => 1 + random(100))];
  const sampleCosts = Array(26).fill(1);
  sampleCosts[10] = 5;
  const multiCharacterCosts = Array(26).fill(1);
  multiCharacterCosts[0] = 2;
  multiCharacterCosts[1] = 7;
  const publicCases = [
    { password: 'kkkk', reference: 'k', costs: sampleCosts, output: '20' },
    { password: 'abac', reference: 'ab', costs: multiCharacterCosts, output: '11' },
    { password: 'abaabab', reference: 'aba', costs: multiCharacterCosts, output: '29' },
    { password: 'xyzzy', reference: 'ab', costs, output: '0' },
  ];
  const formal = publicCases.map((item, index) => ({
    name: index === 0 ? '原题样例' : ['原题样例', '多字符消歧', '重复 reference 和重复字符', '没有匹配字符'][index],
    input: inputFor(item.password, item.reference, item.costs),
    expectedOutput: item.output + '\n',
    hidden: false,
    weight: 1,
  }));

  const allLetters = Array.from({ length: 26 }, (_, index) => String.fromCharCode(97 + index)).join('');
  const boundaryCosts = Array(26).fill(100);
  formal.push(
    {
      name: '全部小写字母和最大计费',
      input: inputFor(allLetters.repeat(1_000), allLetters, boundaryCosts),
      expectedOutput: `${26 * 1_000 * 100}\n`,
      hidden: true,
      weight: 1,
    },
    {
      name: '十万长度重复字符',
      input: inputFor('a'.repeat(100_000), 'a', boundaryCosts),
      expectedOutput: '10000000\n',
      hidden: true,
      weight: 1,
    },
  );

  const oracleCases = [];
  const seenInputs = new Set();
  for (const item of publicCases) {
    const input = inputFor(item.password, item.reference, item.costs);
    assert.equal(oracle(item.password, item.reference, item.costs), item.output);
    seenInputs.add(input);
    oracleCases.push({ input, expectedOutput: item.output });
  }
  for (let index = 0; oracleCases.length < 120; index++) {
    const length = 1 + random(9);
    const password = Array.from({ length }, () => String.fromCharCode(97 + random(5))).join('');
    const referenceLength = 1 + random(5);
    const referenceText = Array.from({ length: referenceLength }, () => String.fromCharCode(97 + random(5))).join('');
    const generatedCosts = Array.from({ length: 26 }, () => 1 + random(100));
    const input = inputFor(password, referenceText, generatedCosts);
    if (seenInputs.has(input)) continue;
    seenInputs.add(input);
    oracleCases.push({ input, expectedOutput: oracle(password, referenceText, generatedCosts) });
    if (index > 10_000) throw new Error('failed to generate unique oracle inputs');
  }
  const formalInputs = new Set(formal.map((item) => item.input));
  while (formal.length < 36) {
    const length = 1 + random(10);
    const password = Array.from({ length }, () => String.fromCharCode(97 + random(6))).join('');
    const referenceText = Array.from({ length: 1 + random(6) }, () => String.fromCharCode(97 + random(6))).join('');
    const generatedCosts = Array.from({ length: 26 }, () => 1 + random(100));
    const input = inputFor(password, referenceText, generatedCosts);
    if (formalInputs.has(input)) continue;
    formalInputs.add(input);
    formal.push({
      name: `隐藏验证 ${formal.length - 5}`,
      input,
      expectedOutput: oracle(password, referenceText, generatedCosts) + '\n',
      hidden: true,
      weight: 1,
    });
  }

  const mutantKills = mutants.map((mutant) => ({
    name: mutant.name,
    rejectedByCases: formal.flatMap((item, index) =>
      run(mutant.code, item.input) !== item.expectedOutput.trim() ? [index] : [],
    ),
  }));
  assert(mutantKills.every((item) => item.rejectedByCases.length > 0));
  for (const item of formal)
    assert.equal(run(reference, item.input), item.expectedOutput.trim(), item.name);
  for (const item of oracleCases)
    assert.equal(run(reference, item.input), item.expectedOutput);

  const problem = {
    id: ID,
    courseId: 'gomall',
    lessonId: '00-overview',
    title: 'Calculate Min Cost (Password Removal)',
    difficulty: '简单',
    tags: ['OA', 'Amazon', '字符串', '哈希表'],
    description: '给定 password、reference 和 26 个小写字母删除成本。删除 password 中所有出现在 reference 字符集合里的字符；每删一个字符按其字母成本计费，求最低总成本。',
    input: '第一行 password，第二行 reference，第三行依次给出 cost[0..25]。字符串由小写英文字母组成，长度均为 1..100000；每个成本为 1..100。本站以三行 stdin/stdout 格式承载原函数参数。',
    output: '输出删除 password 中全部 reference 匹配字符的最小成本。',
    explanation: 'reference 只决定需删除的字符集合；password 中每个匹配位置都要单独收费。完整推导见配套题解。',
    hints: ['先把 reference 转为字符集合，再扫描 password；每个匹配字符都计一次成本。'],
    timeLimit: 3,
    memoryLimit: 65536,
    outputLimit: 4096,
    checker: 'tokens',
    languages: ['python', 'go', 'java', 'cpp'],
  };
  const packageDocument = ojImportSchema.parse({
    schemaVersion: 1,
    problem,
    cases: formal,
  });
  const packageBytes = JSON.stringify(packageDocument);
  const editorial = `## 思路\n\n把 reference 中出现的字母放进集合。扫描 password，每遇到一个属于该集合的字符，就加上对应字母的删除成本。相同字符在 password 中出现多次时，每次都要计费；reference 中同一字符重复出现不会重复收费。\n\n## 正确性\n\n题目要求移除 password 中所有出现在 reference 的字符，因此每个匹配位置都必须删除，不能通过保留或选择只处理一种字符来降低费用。非匹配位置不属于目标删除对象，删除它们只会增加正成本。故唯一必要且最优的删除集合正是所有匹配位置，逐位累加对应成本即为最小总成本。\n\n## 复杂度\n\n时间 O(|password|+|reference|)，空间 O(Σ)，Σ=26。\n\n## 参考实现\n\n\`\`\`python\n${reference}\`\`\`\n`;
  const manifest = {
    schemaVersion: 1,
    items: [{
      id: ID,
      sourceContentHash: source.contentHash,
      packageChecksum: sha(packageBytes),
      editorial,
      authoredSolutions: [{ language: 'python', code: reference }],
    }],
  };

  for (const folder of [
    'candidate-batches', 'packages', 'references', 'oracles', 'mutants',
    'editorials', 'validation', 'source-evidence', 'resolutions',
  ]) mkdirSync(resolve(OA, folder), { recursive: true });
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  const reportPath = resolve(OA, 'reports', `${BATCH}.json`);
  let report;
  try { report = JSON.parse(readFileSync(reportPath, 'utf8')); } catch {}
  const reportProblem = report?.problems?.find((item) => item.id === ID);
  const reportValid = Boolean(
    report?.allPassed && report.batch === BATCH &&
    report.batchSha256 === sha(Buffer.from(manifestBytes)) &&
    reportProblem?.formal === formal.length &&
    reportProblem?.oracle === oracleCases.length &&
    reportProblem?.passed === formal.length + oracleCases.length &&
    reportProblem?.killed?.length === mutants.length,
  );
  const candidatePath = resolve(OA, 'candidate-batches', `${BATCH}.json`);
  const manifestFolder = reportValid ? 'batches' : 'candidate-batches';
  writeJson(manifestFolder, `${BATCH}.json`, manifest);
  if (reportValid && existsSync(candidatePath)) unlinkSync(candidatePath);
  writeJson('packages', `${ID}.json`, packageDocument);
  writeFileSync(resolve(OA, 'references', `${ID}.py`), reference);
  writeJson('oracles', `${ID}.json`, oracleCases);
  writeJson('mutants', `${ID}.json`, mutants);
  writeJson('editorials', `${ID}.json`, {
    schemaVersion: 1,
    id: ID,
    title: problem.title,
    explanation: editorial,
    solutions: [{ language: 'python', code: reference }],
    sourceUrl: SOURCE_URL,
    sourceContentHash: source.contentHash,
    author: 'CSWork',
  });
  writeJson('validation', `${BATCH}.json`, {
    schemaVersion: 1,
    seed: 20261038,
    note: reportValid
      ? `用户自有 GoJudge 通过 ${reportProblem.passed} 项（${reportProblem.formal} formal + ${reportProblem.oracle} oracle），两个 mutant 均被击杀。`
      : '本地独立子集枚举 oracle 与正式用例通过；mutants 均被击杀，待用户自有 GoJudge 验收。',
    problems: [{
      id: ID,
      formalCases: formal.length,
      oracleCases: oracleCases.length,
      uniqueOracleInputs: new Set(oracleCases.map((item) => item.input)).size,
      negativeControls: mutantKills,
      referenceSha256: sha(Buffer.from(reference)),
      oracleSha256: sha(Buffer.from(JSON.stringify(oracleCases, null, 2) + '\n')),
    }],
  });
  writeJson('source-evidence', `${BATCH}.json`, {
    schemaVersion: 1,
    repository: 'https://github.com/RedInn7/OA-Master',
    commit: UPSTREAM_COMMIT,
    catalogContentHash: source.contentHash,
    pages: [{ company: 'Amazon', path: 'web/content/docs/companies/amazon.mdx', gitBlobSha: PAGE_BLOB, sha256: PAGE_SHA256 }],
    items: [{
      id: ID,
      title: problem.title,
      sourceUrl: SOURCE_URL,
      sourceContentHash: source.contentHash,
      previousStatus: 'blocked',
      previousReason,
      fixedSource: {
        evidence: '固定 OAMaster statement 写明移除 password 中所有出现在 reference 的字符；explanation 按 reference 中每个字符累计 password 频次 × 字母成本；Python、Java、C++ 原解均将 reference 转为集合并扫描 password 的每次出现。三语言实现一致，补充多字符样例后可区分“任选一种字符”读法。',
      },
      siteAdditions: ['三行 stdin/stdout 协议', '按 cost[c-a] 的接口含义将字符串域明确为小写英文字母'],
      interpretation: 'reference 作为字符集合；删除 password 中每一个属于该集合的字符，重复出现逐次计费，reference 重复字母不额外计费。',
      verification: reportValid ? `用户自有 GoJudge 通过 ${reportProblem.passed} 项，两个 mutant 均被击杀。` : undefined,
    }],
  });
  writeJson('resolutions', `${BATCH}.json`, {
    schemaVersion: 1,
    items: [{
      id: ID,
      batch: BATCH,
      sourceContentHash: source.contentHash,
      previousReason,
      reason: '固定原题 statement、explanation 以及 Python/Java/C++ 三份参考实现一致支持删除 password 中所有属于 reference 字符集合的字符；新增多字符、重复 reference 和重复匹配字符测试以排除单字符误读。' + (reportValid ? `用户自有 GoJudge ${reportProblem.passed} 项全部通过，两个 mutant 均被击杀。` : '独立 oracle 与正式样例待用户自有 GoJudge 验收。'),
    }],
  });
  console.log(JSON.stringify({
    id: ID, batch: BATCH, formalCases: formal.length,
    oracleCases: oracleCases.length, mutantsKilled: mutantKills.length,
    sandboxVerified: reportValid,
    packageChecksum: manifest.items[0].packageChecksum,
  }));
}

main();
