/**
 * Verify the rest- problems (content/rest-api) in go-judge, as verify-oa-judge.mjs does for OA
 * batches: every reference passes every case through the judge's offline HTTP stubs, and every
 * incorrect program exits normally and fails one. publish-sql-track.ts publishes a rest- package
 * only once this report holds its checksum. Never runs the programs on this host.
 *   GO_JUDGE_URL=… GO_JUDGE_TOKEN=… node scripts/rest-api/verify-sandbox.mjs [REPORT]
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { matchesOaOutput } from '../oa-judge/output-checker.mjs';
import { assertNormalExit, createReferenceSandbox } from '../oa-judge/reference-sandbox.mjs';

const hash = (text) => createHash('sha256').update(text).digest('hex');
const packages = JSON.parse(readFileSync('content/rest-api/packages.json', 'utf8'));
const programs = JSON.parse(readFileSync('content/rest-api/programs.json', 'utf8'));
const sandbox = createReferenceSandbox({ url: process.env.GO_JUDGE_URL || 'http://127.0.0.1:5050', token: process.env.GO_JUDGE_TOKEN });
assert(packages.length > 0);

// Sample runs get only the visible cases' fixtures (lib/server/oj-engine.ts runSpec), so visible cases run that way here.
const sampleSpec = (problem) => ({
  ...problem,
  httpFixtures: Object.fromEntries(problem.visibleFixtureKeys.map((key) => [key, problem.httpFixtures[key]])),
});

/** The first case the program gets wrong, or null; a crash or a nonzero exit throws. */
const firstWrong = (code, { problem, cases }, label) =>
  sandbox.withProgram({ language: 'python', code }, async (run) => {
    const sample = sampleSpec(problem);
    for (const test of cases) {
      const result = await run(test.input, test.hidden ? problem : sample);
      assertNormalExit(result, label);
      if (!matchesOaOutput(result.files?.stdout || '', test.expectedOutput, problem.checker, test.input)) return test;
    }
    return null;
  });

const report = { schemaVersion: 1, engine: 'go-judge', allPassed: false, problems: [], finishedAt: '' };
for (const pkg of packages) {
  const { id } = pkg.problem;
  const { reference, mutants } = programs[id];
  assert(pkg.problem.httpFixtures && mutants.length >= 2, id);
  const wrong = await firstWrong(reference, pkg, `${id} reference`);
  assert.equal(wrong, null, `${id} reference fails ${wrong?.name}`);
  for (const mutant of mutants) assert(await firstWrong(mutant.code, pkg, `${id} ${mutant.name}`), `${id} surviving mutant ${mutant.name}`);
  report.problems.push({
    id,
    packageSha256: hash(JSON.stringify(pkg)),
    referenceSha256: hash(reference),
    passed: pkg.cases.length,
    killed: mutants.map((m) => m.name),
  });
  console.log(JSON.stringify({ event: 'rest_verified', id, passed: pkg.cases.length, killed: mutants.length }));
}
report.allPassed = true;
report.finishedAt = new Date().toISOString();
writeFileSync(process.argv[2] || 'content/rest-api/sandbox-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ event: 'rest_verification_complete', problems: report.problems.length }));
