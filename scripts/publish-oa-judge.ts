/** Offline teacher publication. Hash-bound sandbox evidence is mandatory. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { sqlite } from '../db/sqlite';
import {
  validateProblemPackage,
  problemChecksum,
  saveProblemDraft,
  publishProblemDraft,
} from '../lib/server/oj-problems';
import type { Person } from '../lib/server/auth';
import {
  batchName,
  loadScope,
  defaultReportPath,
  assertScopeEvidence,
} from './oa-judge/aggregate-batches.mjs';
import {
  assertOracleCoverage,
  assertFormalCoverage,
} from './oa-judge/oracle-coverage.mjs';
import {
  readReferenceProgram,
  assertReferenceEvidence,
  mutantProgram,
} from './oa-judge/reference-program.mjs';

const root = resolve('content/oa-judge');
const digest = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');
const load = (name: string) => readFileSync(resolve(root, name));
const args = process.argv.slice(2);
const batch = args[0] === '--batch' ? batchName(args.splice(0, 2)[1]) : null;
assert(
  args.length <= 2 && !args.some((arg) => arg.startsWith('--')),
  'Usage: publish-oa-judge.ts [--batch NAME] [REPORT] EMAIL',
);
if (batch)
  assert.equal(args.length, 1, 'Usage: publish-oa-judge.ts --batch NAME EMAIL');
const scope = loadScope(root, batch);
const registry = scope.data;
const reportPath = args.length === 2 ? args[0] : defaultReportPath(root, batch);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
const email = args.at(-1)?.toLowerCase();
assert(
  email &&
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(email),
  'Configured teacher required',
);
assertScopeEvidence(scope, report);
const source = JSON.parse(
  readFileSync('content/oa-master/catalog.json', 'utf8'),
);
const db = sqlite();
const user = db
  .prepare('SELECT id,name,email,email_verified FROM user WHERE lower(email)=?')
  .get(email) as
  | { id: string; name: string; email: string; email_verified: number }
  | undefined;
assert(user?.email_verified, 'Verified teacher required');
const teacher: Person = {
  id: user.id,
  name: user.name,
  email: user.email,
  verified: true,
  role: 'teacher',
};
const prepared = [];
for (const item of registry.items) {
  assert(/^oa-[a-z0-9-]+$/.test(item.id));
  const result = report.problems.find((p: { id: string }) => p.id === item.id);
  assert(result);
  const bytes = load('packages/' + item.id + '.json');
  const payload = validateProblemPackage(JSON.parse(bytes.toString()));
  assert.equal(payload.problem.id, item.id);
  assert.equal(payload.problem.courseId, 'gomall');
  assert.equal(payload.problem.lessonId, '00-overview');
  const program = readReferenceProgram(root, item);
  assertReferenceEvidence(result, program);
  assert(payload.problem.languages.includes(program.language));
  assert.equal(problemChecksum(payload), item.packageChecksum);
  assert.equal(result.packageSha256, digest(bytes));
  for (const mutant of JSON.parse(
    load('mutants/' + item.id + '.json').toString(),
  ))
    mutantProgram(mutant, program);
  const oracleBytes = load('oracles/' + item.id + '.json');
  assert.equal(result.oracleSha256, digest(oracleBytes));
  const oracle = JSON.parse(oracleBytes.toString());
  assertOracleCoverage(item, oracle, item.id);
  assertFormalCoverage(item, payload);
  assert.equal(
    result.oracle,
    oracle.length,
    'Sandbox oracle count must match bound oracle inputs',
  );
  assert.equal(
    result.mutantsSha256,
    digest(load('mutants/' + item.id + '.json')),
  );
  assert.equal(
    source.items.find((p: { id: string }) => p.id === item.id)?.contentHash,
    item.sourceContentHash,
  );
  assert(
    result.formal === payload.cases.length &&
      result.passed === result.oracle + result.formal &&
      new Set(result.killed).size >= 2,
  );
  prepared.push(payload);
}
for (const payload of prepared) {
  const current = db
    .prepare(
      'SELECT v.checksum FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=? AND p.published=1',
    )
    .get(payload.problem.id) as { checksum: string } | undefined;
  if (current?.checksum === problemChecksum(payload)) {
    console.log(
      JSON.stringify({ id: payload.problem.id, status: 'unchanged' }),
    );
    continue;
  }
  const previous = db
    .prepare('SELECT revision FROM oj_problem_drafts WHERE problem_id=?')
    .get(payload.problem.id) as { revision: number } | undefined;
  const draft = await saveProblemDraft(
    teacher,
    payload,
    previous?.revision ?? null,
  );
  assert(draft.draft);
  await publishProblemDraft(teacher, payload.problem.id, draft.draft.revision);
  console.log(JSON.stringify({ id: payload.problem.id, status: 'published' }));
}
