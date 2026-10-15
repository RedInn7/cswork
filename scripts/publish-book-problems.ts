/**
 * Offline teacher publication of the book problems: content/book-problems/packages.json,
 * which CI rebuilds and checks case by case (tests/book-problems.test.ts).
 * Unchanged packages are skipped, so release.sh runs this on every release.
 *   node --env-file=.env --import tsx scripts/publish-book-problems.ts TEACHER_EMAIL
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sqlite } from '../db/sqlite';
import {
  validateProblemPackage,
  problemChecksum,
  saveProblemDraft,
  publishProblemDraft,
} from '../lib/server/oj-problems';
import type { Person } from '../lib/server/auth';

const email = process.argv[2]?.toLowerCase();
assert(
  email &&
    (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(email),
  'Usage: publish-book-problems.ts EMAIL (a teacher listed in ADMIN_EMAILS)',
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
// Validate everything before publishing anything.
const prepared = (JSON.parse(readFileSync('content/book-problems/packages.json', 'utf8')) as unknown[]).map((raw) => {
  const payload = validateProblemPackage(raw);
  assert.match(payload.problem.id, /^bk-(offer|ctci)-[a-z0-9-]+$/);
  assert.deepEqual(payload.problem.languages, ['python', 'cpp', 'java', 'go']);
  return payload;
});
assert.equal(new Set(prepared.map((p) => p.problem.id)).size, prepared.length);
for (const payload of prepared) {
  const current = db
    .prepare(
      'SELECT v.checksum FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=? AND p.published=1',
    )
    .get(payload.problem.id) as { checksum: string } | undefined;
  if (current?.checksum === problemChecksum(payload)) {
    console.log(JSON.stringify({ id: payload.problem.id, status: 'unchanged' }));
    continue;
  }
  const previous = db
    .prepare('SELECT revision FROM oj_problem_drafts WHERE problem_id=?')
    .get(payload.problem.id) as { revision: number } | undefined;
  const draft = await saveProblemDraft(teacher, payload, previous?.revision ?? null);
  assert(draft.draft);
  await publishProblemDraft(teacher, payload.problem.id, draft.draft.revision);
  console.log(JSON.stringify({ id: payload.problem.id, status: 'published' }));
}
