import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ojImportSchema } from '../../../lib/oj-types.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const OA = resolve(ROOT, 'content/oa-judge');
const ID = 'oa-nutanix-4';
const BATCH = 'nutanix-4-rotation';
const URL = 'https://oamaster.com/docs/companies/nutanix#4-minimum-operations-to-convert-array';
const HASH = 'ab76f4e0e891a4c0a1f56942a41c331eb8cd1f46f6888126083c86798de4fee7';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const put = (folder, file, value) => writeFileSync(resolve(OA, folder, file), `${JSON.stringify(value, null, 2)}\n`);
const inputFor = arr => `${arr.length}\n${arr.join(' ')}\n`;

const reference = [
  'import sys',
  'def solve(raw):',
  ' data=list(map(int,raw.split())); n=data[0]; arr=data[1:]',
  ' best=n',
  ' for k in range(n):',
  '  seen=[False]*n; cycles=0',
  '  for i in range(n):',
  '   if not seen[i]:',
  '    cycles+=1; j=i',
  '    while not seen[j]:',
  '     seen[j]=True; j=arr[(j+k)%n]-1',
  '  best=min(best,k+n-cycles)',
  ' return best',
  'if __name__=="__main__": print(solve(sys.stdin.read()))',
].join('\n') + '\n';

// Independent shortest-path oracle on the operation state graph. A state records
// whether any swap has happened; only the unswapped layer has rotation edges.
function bfsOracle(start) {
  const target = start.map((_, i) => i + 1).join(',');
  const encode = (arr, swapped) => `${swapped ? 1 : 0}|${arr.join(',')}`;
  const initial = { arr: start, swapped: false, distance: 0 };
  const queue = [initial];
  const visited = new Set([encode(start, false)]);
  for (let head = 0; head < queue.length; head++) {
    const state = queue[head];
    if (state.arr.join(',') === target) return state.distance;
    const push = (arr, swapped) => {
      const key = encode(arr, swapped);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ arr, swapped, distance: state.distance + 1 });
      }
    };
    if (!state.swapped) push(state.arr.slice(1).concat(state.arr[0]), false);
    for (let i = 0; i < start.length; i++) {
      for (let j = i + 1; j < start.length; j++) {
        const next = state.arr.slice();
        [next[i], next[j]] = [next[j], next[i]];
        push(next, true);
      }
    }
  }
  throw new Error('Target should always be reachable by swaps.');
}

const mutants = [
  {
    name: '忽略左移，只计算原排列的最少交换次数',
    code: [
      'import sys',
      'a=list(map(int,sys.stdin.read().split()));n=a[0];p=a[1:];seen=[False]*n;c=0',
      'for i in range(n):',
      ' if not seen[i]:',
      '  c+=1;j=i',
      '  while not seen[j]:seen[j]=True;j=p[j]-1',
      'print(n-c)',
    ].join('\n') + '\n',
  },
  {
    name: '只在左移后首元素为 1 时计算交换次数',
    code: [
      'import sys',
      'a=list(map(int,sys.stdin.read().split()));n=a[0];p=a[1:];ans=n',
      'for k in range(n):',
      ' if p[k]!=1:continue',
      ' q=p[k:]+p[:k];seen=[False]*n;c=0',
      ' for i in range(n):',
      '  if not seen[i]:',
      '   c+=1;j=i',
      '   while not seen[j]:seen[j]=True;j=q[j]-1',
      ' ans=min(ans,k+n-c)',
      'print(ans)',
    ].join('\n') + '\n',
  },
];

function run(code, input) {
  const result = spawnSync('python3', ['-I', '-c', code], {
    input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function runReferenceMany(inputs) {
  const entryPoint = 'if __name__=="__main__": print(solve(sys.stdin.read()))';
  assert(reference.includes(entryPoint));
  const code = `${reference.replace(entryPoint, '')}\nimport json\nprint(json.dumps([solve(item) for item in json.load(sys.stdin)]))\n`;
  const result = spawnSync('python3', ['-I', '-c', code], {
    input: JSON.stringify(inputs), encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

let seed = 0x4e757434;
const random = limit => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed >>> 8) % limit;
};
function shuffledPermutation(n) {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = n - 1; i > 0; i--) {
    const j = random(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function main() {
  const catalog = JSON.parse(readFileSync(resolve(ROOT, 'content/oa-master/catalog.json'), 'utf8'));
  const source = catalog.items.find(item => item.id === ID);
  assert.equal(source?.contentHash, HASH, 'catalog statement fingerprint changed');
  assert.match(source.statement, /permutation of the target array/);
  assert.match(source.statement, /once an operation of type 2 is performed/);

  const formalArrays = [
    [5, 3, 2, 1, 4], // exact source example; optimum is one left shift + one swap
    [1], [1, 2], [2, 1], [2, 3, 1], [3, 1, 2], [3, 2, 1],
    [2, 3, 4, 5, 1], [5, 1, 2, 3, 4], [2, 1, 3, 4, 5],
    [1, 3, 2, 5, 4], [4, 3, 2, 1], [4, 1, 3, 2],
    [6, 2, 3, 4, 5, 1], [2, 6, 3, 4, 5, 1],
    [6, 1, 5, 3, 2, 4], [4, 6, 1, 5, 2, 3],
    [3, 6, 1, 5, 2, 4], [5, 2, 6, 1, 4, 3],
    [2, 5, 1, 6, 3, 4], [4, 2, 6, 3, 1, 5],
    [6, 3, 2, 5, 1, 4], [3, 5, 2, 6, 4, 1],
  ];
  assert.equal(bfsOracle(formalArrays[0]), 2, 'source sample answer must be 2');
  const seenInputs = new Set(formalArrays.map(inputFor));
  while (formalArrays.length < 24) {
    const n = 2 + random(5);
    const arr = shuffledPermutation(n);
    const input = inputFor(arr);
    if (!seenInputs.has(input)) {
      seenInputs.add(input);
      formalArrays.push(arr);
    }
  }

  const oracleArrays = [];
  while (oracleArrays.length < 120) {
    const n = 1 + random(6);
    const arr = shuffledPermutation(n);
    const input = inputFor(arr);
    if (!seenInputs.has(input)) {
      seenInputs.add(input);
      oracleArrays.push(arr);
    }
  }

  const formalInputs = formalArrays.map(inputFor);
  const formalActual = runReferenceMany(formalInputs);
  const formalCases = formalArrays.map((arr, index) => {
    const input = inputFor(arr);
    const expectedOutput = `${bfsOracle(arr)}\n`;
    assert.equal(String(formalActual[index]), expectedOutput.trim(), `formal case ${index + 1}`);
    return {
      name: index === 0 ? '原题示例一' : `正式隐藏用例 ${index}`,
      input,
      expectedOutput,
      hidden: index !== 0,
      weight: 1,
    };
  });
  const scaleArray = Array.from({ length: 3000 }, (_, i) => (i + 2999) % 3000 + 1);
  const scaleInput = inputFor(scaleArray);
  assert.equal(String(runReferenceMany([scaleInput])[0]), '1', 'n=3000 one-step rotation boundary case');
  formalCases.push({
    name: '站内上限 n=3000（循环左移一次即可完成）',
    input: scaleInput,
    expectedOutput: '1\n',
    hidden: true,
    weight: 1,
  });
  const oracleCases = oracleArrays.map(arr => ({
    input: inputFor(arr),
    expectedOutput: `${bfsOracle(arr)}\n`,
  }));
  const oracleActual = runReferenceMany(oracleCases.map(test => test.input));
  oracleCases.forEach((test, index) => assert.equal(String(oracleActual[index]), test.expectedOutput.trim()));

  const killed = mutants.map(mutant => ({
    name: mutant.name,
    by: formalCases.findIndex(test => run(mutant.code, test.input) !== test.expectedOutput.trim()) >= 0
      ? [formalCases.findIndex(test => run(mutant.code, test.input) !== test.expectedOutput.trim())]
      : [],
  }));
  assert(killed.every(item => item.by.length), 'each normal-exit mutant must be killed by a formal case');

  const cases = formalCases;
  const packageData = ojImportSchema.parse({
    schemaVersion: 1,
    problem: {
      id: ID,
      courseId: 'gomall',
      lessonId: '00-overview',
      title: 'Minimum Operations to Convert Array',
      difficulty: '中等',
      tags: ['OA', 'Nutanix', '数组', '置换环', '贪心'],
      description: '给定一个由 1..n 组成的排列。操作 1 是循环左移一位，操作 2 是交换任意两个元素；执行过操作 2 后不能再执行操作 1。求将数组变为 [1,2,...,n] 的最少操作数。',
      input: '第一行输入 n，第二行输入 n 个整数 arr[i]，表示排列。本站评测约束：1 ≤ n ≤ 3000；arr 是 1..n 的一个排列。原题没有提供 n 的数值约束，此范围为本站为 O(n²) 参考算法设定的运行边界。',
      output: '输出一个整数，表示最少操作数。',
      explanation: '枚举左移 k 次。左移后的位置到目标位置构成一个置换；若该置换有 c 个环，最少任意交换数为 n-c。因此总操作数为 k+n-c，取所有 k 的最小值。',
      hints: ['对固定的左移次数，最少任意交换次数等于 n 减去置换环数。', '左移必须全部发生在第一次交换之前。'],
      timeLimit: 4,
      memoryLimit: 65536,
      outputLimit: 4096,
      checker: 'exact',
      languages: ['python', 'java', 'cpp'],
    },
    cases,
  });

  const fence = '`'.repeat(3);
  const editorial = `# Minimum Operations to Convert Array\n\n## 思路\n\n设循环左移 k 次，k 只能取 0 到 n-1。此时数组中每个位置上的值指向其目标位置，形成一个置换。长度为 n 的置换若有 c 个环，最少需要 n-c 次任意两元素交换才能排序。于是该 k 的总代价为 k+n-c，枚举 k 取最小值。\n\n## 正确性\n\n操作规则要求所有左移都在第一次交换之前，所以任意合法方案唯一对应某个左移次数 k，之后只进行交换。固定 k 后，置换每个环可独立完成，长度为 L 的环至少且恰好需要 L-1 次交换，合计 n-c。因此枚举所有 k 并取最小值，覆盖且仅覆盖所有可能方案。\n\n## 复杂度\n\n每个 k 在线性时间统计置换环，共 O(n²) 时间、O(n) 额外空间。\n\n## 站内输入边界\n\n源题将约束标为 N/A，没有给出 n 的上限。为使 O(n²) 的评测输入有明确边界，本站设定 1 ≤ n ≤ 3000；这是站内运行约束，不是对原始来源的补写。\n\n## 参考实现\n\n${fence}python\n${reference}${fence}\n`;
  const oracleManifest = {
    method: '对完整操作状态图做 BFS。状态包含当前排列和是否已经交换；未交换状态可左移，任意状态可交换。与置换环计数公式独立。',
    domain: '确定性生成的 120 个互不重复排列，1 ≤ n ≤ 6；每个答案由最短路 BFS 得出。',
    cases: oracleCases,
  };
  const packageChecksum = sha256(JSON.stringify(packageData));
  const manifest = {
    schemaVersion: 1,
    items: [{
      id: ID,
      sourceContentHash: HASH,
      packageChecksum,
      editorial,
      authoredSolutions: [{ language: 'python', code: reference }],
      oracleCoverage: { method: oracleManifest.method, inputs: oracleCases.map(test => test.input) },
    }],
  };
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  let report;
  try { report = JSON.parse(readFileSync(resolve(OA, 'reports', `${BATCH}.json`), 'utf8')); } catch {}
  const reportProblem = report?.problems?.find(item => item.id === ID);
  const reportValid = Boolean(report?.allPassed && report.batch === BATCH &&
    report.batchSha256 === sha256(Buffer.from(manifestBytes)) &&
    reportProblem?.formal === formalCases.length && reportProblem?.oracle === oracleCases.length &&
    reportProblem?.passed === formalCases.length + oracleCases.length &&
    reportProblem?.killed?.length === mutants.length);

  for (const folder of ['candidate-batches', 'packages', 'references', 'oracles', 'mutants', 'editorials', 'validation', 'source-evidence', 'resolutions', 'negative-controls']) {
    mkdirSync(resolve(OA, folder), { recursive: true });
  }
  const batchFile = `${BATCH}.json`;
  put(reportValid ? 'batches' : 'candidate-batches', batchFile, manifest);
  if (reportValid && existsSync(resolve(OA, 'candidate-batches', batchFile))) unlinkSync(resolve(OA, 'candidate-batches', batchFile));
  put('packages', `${ID}.json`, packageData);
  writeFileSync(resolve(OA, 'references', `${ID}.py`), reference);
  put('oracles', `${ID}.json`, oracleCases);
  put('mutants', `${ID}.json`, mutants);
  mutants.forEach((mutant, index) => writeFileSync(resolve(OA, 'negative-controls', `${ID}-${index + 1}.py`), mutant.code));
  put('editorials', `${ID}.json`, {
    schemaVersion: 1,
    id: ID,
    title: 'Minimum Operations to Convert Array',
    explanation: editorial,
    solutions: [{ language: 'python', code: reference }],
    sourceUrl: URL,
    sourceContentHash: HASH,
    author: 'CSWork',
  });
  put('validation', `${BATCH}.json`, {
    schemaVersion: 1,
    note: reportValid
      ? `用户自有 GoJudge 通过 ${reportProblem.passed} 项（${reportProblem.formal} 正式用例 + ${reportProblem.oracle} BFS oracle），两个错误实现均被击杀。`
      : '离线验证：25 个正式用例（24 个隐藏），包括原题样例及 n=3000 边界性能例；独立状态图 BFS oracle 对另外 120 个 n≤6 的不同排列逐项校验；两个正常退出错误程序均被正式用例击杀。',
    problems: [{
      id: ID,
      formalCases: formalCases.length,
      hiddenFormalCases: formalCases.filter(test => test.hidden).length,
      oracleCases: oracleCases.length,
      oracleMethod: 'BFS over legal operation states (permutation, whether a swap has occurred)',
      negativeControls: killed.map(item => ({ name: item.name, rejectedByCases: item.by })),
      referenceSha256: sha256(Buffer.from(reference)),
      oracleSha256: sha256(readFileSync(resolve(OA, 'oracles', `${ID}.json`))),
    }],
  });
  put('source-evidence', `${BATCH}.json`, {
    schemaVersion: 1,
    repository: 'https://github.com/RedInn7/OA-Master',
    commit: 'e66f809f4c953bce129f68491726176615db6afc',
    catalogContentHash: HASH,
    pages: [{ company: 'Nutanix', path: 'web/content/docs/companies/nutanix.mdx', gitBlobSha: 'e456ebadfeb2ed296ead739808d9cdfb76ce876b' }],
    items: [{
      id: ID,
      title: 'Minimum Operations to Convert Array',
      sourceUrl: URL,
      sourceContentHash: HASH,
      previousStatus: 'blocked',
      previousReason: '算法规则可解释，但 N/数值约束均为 N/A；穷举旋转后最少交换为 O(n²)，本批不猜测安全输入上限。',
      evidence: '固定源版本中的英文题面明确：arr 是目标数组 [1..n] 的排列；操作为循环左移一位或交换任意两个元素；一旦进行交换，此后不能再左移；目标是最少操作变成递增序列。原题示例 [5,3,2,1,4] 的输出为 2，并给出左移一次后交换一次的构造。题面 Constraints 明确写 N/A，源中 Python/Java/C++ 三份实现均为枚举 k 并统计旋转后置换环，时间 O(n²)。站内另设 n≤3000 作为运行边界，明确不是源约束。'+(reportValid?` 用户自有 GoJudge 通过 ${reportProblem.passed} 项，两个错误实现均被击杀。`:''),
      supportingSources: [],
      siteAdditions: ['评测采用标准输入：n 后跟排列元素。', '源题未给出 n 上限；本站单独设 n≤3000，以适配 O(n²) 参考算法。'],
      status: reportValid ? 'authored' : 'candidate',
    }],
  });
  put('resolutions', `${BATCH}.json`, {
    schemaVersion: 1,
    items: [{
      id: ID,
      batch: BATCH,
      sourceContentHash: HASH,
      previousReason: '算法规则可解释，但 N/数值约束均为 N/A；穷举旋转后最少交换为 O(n²)，本批不猜测安全输入上限。',
      reason: '题意与算法语义完整且唯一；明确把 n≤3000 作为站内运行约束，并标明原题 Constraints=N/A，没有伪称该范围来自源。原题样例输出 2 与独立 BFS oracle 一致。',
    }],
  });

  console.log(JSON.stringify({ id: ID, batch: BATCH, formalCases: formalCases.length, hiddenFormalCases: formalCases.filter(test => test.hidden).length, oracleCases: oracleCases.length, oracleMethod: 'independent BFS', mutantsKilled: killed.map(item => item.name), sampleAnswer: bfsOracle(formalArrays[0]), sandboxVerified: reportValid, packageChecksum }));
}

main();
