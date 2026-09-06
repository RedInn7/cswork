/** Teacher-only offline publication of hash-bound, sandbox-validated packages. */
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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
const countsSchema = z.object({
  formal: z.number().int().min(2).max(64),
  oracle: z.number().int().min(120),
  negativeControls: z.number().int().min(2),
});
const manifest = z
  .object({
    verifiedAt: z.string().min(1),
    sourceHashesFileSha256: hash,
    problems: z
      .array(
        z.object({
          problemId: z.string().regex(/^lc-\d+$/),
          packageFile: z.string(),
          packageSha256: hash,
          sourceContentHash: hash,
          verified: z.literal(true),
          referenceSha256: hash,
          runnerSha256: hash,
          mutationSha256: hash,
          inputBytesSha256: hash,
          referenceBytesSha256: hash,
          oracleSha256: hash,
          counts: countsSchema,
        }),
      )
      .min(1),
  })
  .parse(JSON.parse(readFileSync(manifestFile, 'utf8')));
const report = z
  .object({
    allPassed: z.literal(true),
    engine: z.literal('go-judge'),
    finishedAt: z.string().min(1),
    sourceHashesFileSha256: hash,
    problems: z
      .array(
        z.object({
          id: z.string().regex(/^lc-\d+$/),
          status: z.literal('verified'),
          sourceContentHash: hash,
          packageSha256: hash,
          referenceSha256: hash,
          wrapperSha256: hash,
          inputBytesSha256: hash,
          referenceBytesSha256: hash,
          oracleSha256: hash,
          mutationSha256: hash,
          counts: countsSchema,
          checks: z.array(z.object({ passed: z.literal(true) })),
        }),
      )
      .min(1),
  })
  .parse(
    JSON.parse(
      readFileSync(
        resolve(dirname(manifestFile), 'verification-report.json'),
        'utf8',
      ),
    ),
  );
if (
  report.finishedAt !== manifest.verifiedAt ||
  report.sourceHashesFileSha256 !== manifest.sourceHashesFileSha256
)
  throw new Error('Verification report does not match manifest run');
const reportEntries = new Map(
  report.problems.map((entry) => [entry.id, entry]),
);
if (
  reportEntries.size !== report.problems.length ||
  new Set(manifest.problems.map((entry) => entry.problemId)).size !==
    manifest.problems.length ||
  reportEntries.size !== manifest.problems.length
)
  throw new Error('Duplicate or mismatched verification identities');
for (const record of manifest.problems) {
  const entry = reportEntries.get(record.problemId);
  if (
    !entry ||
    entry.counts.formal !== record.counts.formal ||
    entry.counts.oracle !== record.counts.oracle ||
    entry.counts.negativeControls !== record.counts.negativeControls ||
    entry.checks.length !==
      record.counts.formal + record.counts.negativeControls + 1
  )
    throw new Error('Verification report checks do not match manifest');
  if (
    entry.sourceContentHash !== record.sourceContentHash ||
    entry.packageSha256 !== record.packageSha256 ||
    entry.referenceSha256 !== record.referenceSha256 ||
    entry.wrapperSha256 !== record.runnerSha256 ||
    entry.inputBytesSha256 !== record.inputBytesSha256 ||
    entry.referenceBytesSha256 !== record.referenceBytesSha256 ||
    entry.oracleSha256 !== record.oracleSha256 ||
    entry.mutationSha256 !== record.mutationSha256 ||
    record.inputBytesSha256 !== record.packageSha256 ||
    record.referenceBytesSha256 !== record.runnerSha256
  )
    throw new Error('Verification report provenance does not match manifest');
}
// Validate every package before making any change.
const packages = manifest.problems.map((record) => {
  if (record.packageFile !== `${record.problemId}.json`)
    throw new Error(
      'Package must have its exact problem filename beside manifest',
    );
  const packagePath = resolve(dirname(manifestFile), record.packageFile);
  if (
    dirname(realpathSync(packagePath)) !==
    realpathSync(dirname(resolve(manifestFile)))
  )
    throw new Error('Package must not escape manifest directory');
  const raw = readFileSync(packagePath);
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
