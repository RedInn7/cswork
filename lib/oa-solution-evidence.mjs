/**
 * Which extra OA reference programs (content/oa-judge/solutions/<id>.json) may be shown: those a
 * content/oa-judge/reports/solutions-<chunk>.json report (scripts/oa-judge/verify-solutions.mjs)
 * saw pass every case of the package they were run against. Shared by the server's loader,
 * scripts/oa-judge/check-guides.mjs and packaging.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/** @param {{ id: string, language: string, sha256: string, packageChecksum: string }} program */
export const programKey = ({ id, language, sha256, packageChecksum }) =>
  [id, language, sha256, packageChecksum].join(' ');

/** Report files under <root>/reports, by name. @param {string} root content/oa-judge */
export const solutionReports = (root) =>
  existsSync(resolve(root, 'reports'))
    ? readdirSync(resolve(root, 'reports')).filter((file) => /^solutions-[a-z0-9-]+\.json$/.test(file))
    : [];

/** programKey of every program some report saw pass all of its package's cases. @param {string} root */
export function passingPrograms(root) {
  const keys = new Set();
  for (const file of solutionReports(root)) {
    const report = JSON.parse(readFileSync(resolve(root, 'reports', file), 'utf8'));
    for (const result of report.results ?? [])
      if (result.total > 0 && result.passed === result.total) keys.add(programKey(result));
  }
  return keys;
}
