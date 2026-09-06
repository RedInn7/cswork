/** Teacher-only offline publication of hash-bound, sandbox-validated packages. */
import { readFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '../db/sqlite';
import {
  saveProblemDraft,
  publishProblemDraft,
  validateProblemPackage,
  problemChecksum,
} from '../lib/server/oj-problems';
import type { Person } from '../lib/server/auth';

const manifestFile = process.argv[2];
const email = process.argv[3]?.toLowerCase();
if (!process.env.DATABASE_PATH || !manifestFile || !email)
  throw new Error(
    'Set DATABASE_PATH; pass verified manifest and teacher email',
  );
if (
  !(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .includes(email)
)
  throw new Error('Teacher must be configured in ADMIN_EMAILS');
const db = sqlite();
const user = db
  .prepare('SELECT id,name,email,email_verified FROM user WHERE lower(email)=?')
  .get(email) as
  | { id: string; name: string; email: string; email_verified: number }
  | undefined;
if (!user?.email_verified) throw new Error('Verified teacher account required');
const teacher: Person = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: 'teacher',
  verified: true,
};
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const manifest = z
  .object({
    problems: z.array(
      z.object({
        problemId: z.string().regex(/^lc-\d+$/),
        packageFile: z.string(),
        packageSha256: hash,
        sourceContentHash: hash,
        verified: z.literal(true),
        referenceSha256: hash,
        runnerSha256: hash,
        counts: z.object({
          formal: z.number().int().min(2),
          oracle: z.number().int().min(1),
          negativeControls: z.number().int().min(1),
        }),
      }),
    ),
  })
  .parse(JSON.parse(readFileSync(manifestFile, 'utf8')));
// Validate every package before making any change.
const packages = manifest.problems.map((record) => {
  if (record.packageFile !== basename(record.packageFile))
    throw new Error('Package must be beside manifest');
  const raw = readFileSync(resolve(dirname(manifestFile), record.packageFile));
  if (createHash('sha256').update(raw).digest('hex') !== record.packageSha256)
    throw new Error(`Changed verified package: ${record.problemId}`);
  const payload = validateProblemPackage(JSON.parse(raw.toString('utf8')));
  if (
    payload.problem.id !== record.problemId ||
    payload.cases.length !== record.counts.formal
  )
    throw new Error('Verification manifest does not match package');
  if (
    !db
      .prepare('SELECT id FROM study_library WHERE id=? AND content_hash=?')
      .get(record.problemId, record.sourceContentHash)
  )
    throw new Error(
      'Source library changed or is missing; revalidate before publication',
    );
  return { record, payload };
});
for (const { record, payload } of packages) {
  const current = db
    .prepare(
      `SELECT p.current_version_id,v.checksum FROM oj_problems p LEFT JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=?`,
    )
    .get(record.problemId) as
    | { current_version_id: string | null; checksum: string | null }
    | undefined;
  let versionId = current?.current_version_id;
  if (!versionId || current?.checksum !== problemChecksum(payload)) {
    const revision = db
      .prepare('SELECT revision FROM oj_problem_drafts WHERE problem_id=?')
      .get(record.problemId) as { revision: number } | undefined;
    const draft = await saveProblemDraft(
      teacher,
      payload,
      revision?.revision ?? null,
    );
    const published = await publishProblemDraft(
      teacher,
      record.problemId,
      draft.draft!.revision,
    );
    versionId = published.versionId;
  }
  if (!versionId) throw new Error('Published version is missing');
  const bound = db
    .prepare(
      "UPDATE study_library SET judge_problem_id=?,verified_hash=content_hash || ':' || ? WHERE id=? AND content_hash=?",
    )
    .run(
      record.problemId,
      versionId,
      record.problemId,
      record.sourceContentHash,
    );
  if (bound.changes !== 1)
    throw new Error(
      'Source library changed during publication; verification was not enabled',
    );
  console.log(
    JSON.stringify({
      problemId: record.problemId,
      versionId,
      formal: record.counts.formal,
      oracle: record.counts.oracle,
    }),
  );
}
db.close();
