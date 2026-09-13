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

const root = resolve('content/oa-judge');
const digest = (data: string | Buffer) =>
  createHash('sha256').update(data).digest('hex');
const load = (name: string) => readFileSync(resolve(root, name));
const registryBytes = load('registry.json'),
  registry = JSON.parse(registryBytes.toString());
const report = JSON.parse(
  readFileSync(process.argv[2] || resolve(root, 'sandbox-report.json'), 'utf8'),
);
const email = process.argv[3]?.toLowerCase();
assert(
  email &&
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(email),
  'Configured teacher required',
);
assert(
  report.schemaVersion === 1 &&
    report.engine === 'go-judge' &&
    report.allPassed === true,
);
assert.equal(report.registrySha256, digest(registryBytes));
assert(
  registry.items.length > 0 && report.problems.length === registry.items.length,
);
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
  assert.equal(item.authoredSolutions.length, 1);
  assert.equal(item.authoredSolutions[0].language, 'python');
  assert.equal(
    item.authoredSolutions[0].code,
    load('references/' + item.id + '.py').toString(),
  );
  assert.equal(problemChecksum(payload), item.packageChecksum);
  assert.equal(result.packageSha256, digest(bytes));
  assert.equal(
    result.referenceSha256,
    digest(load('references/' + item.id + '.py')),
  );
  assert.equal(
    result.oracleSha256,
    digest(load('oracles/' + item.id + '.json')),
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
    result.oracle >= 120 &&
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
