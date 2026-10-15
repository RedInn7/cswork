/**
 * Which extra OA reference programs (content/oa-judge/solutions/<id>.json) may be shown: those whose
 * latest content/oa-judge/reports/solutions-<chunk>.json result (scripts/oa-judge/verify-solutions.mjs)
 * passed every case of the package they were run against. Shared by the server's loader,
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

const passes = (result) => result.total > 0 && result.passed === result.total;
/**
 * programKey of every program whose latest result (by verifiedAt, across all reports) passed all of
 * its package's cases: a later failure of the same code on the same package, in any chunk, revokes
 * an earlier pass. @param {string} root
 */
export function passingPrograms(root) {
  const latest = new Map();
  for (const file of solutionReports(root)) {
    const report = JSON.parse(readFileSync(resolve(root, 'reports', file), 'utf8'));
    for (const result of report.results ?? []) {
      const key = programKey(result);
      const seen = latest.get(key);
      const [at, before] = [result.verifiedAt ?? '', seen?.verifiedAt ?? ''];
      // At the same time, a failure wins.
      if (!seen || at > before || (at === before && !passes(result))) latest.set(key, result);
    }
  }
  return new Set([...latest].filter(([, result]) => passes(result)).map(([key]) => key));
}
