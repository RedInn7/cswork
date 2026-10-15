/**
 * OA debugging and code-review drills from the verified mutants: every Python mutant that
 * differs from the registry's Python solution on 1–3 lines (same line count, trailing
 * whitespace ignored) becomes a drill. Writes content/oa-judge/drills.json, a private
 * server asset (scripts/package-oa-library.mjs), never public/ or the client bundle.
 * English bug names come from content/oa-judge/drill-names-en.json (Chinese name → English,
 * LLM-translated); a name missing there ships Chinese only.
 *
 *   node scripts/oa-judge/build-drills.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BUG_LINES = 3;

/** 1-based lines where `mutant` differs from `reference`; null when the line counts differ. */
export function bugLines(reference, mutant) {
  const lines = (code) => code.replace(/\s+$/, '').split('\n').map((line) => line.trimEnd());
  const a = lines(reference),
    b = lines(mutant);
  if (a.length !== b.length) return null;
  return b.flatMap((line, i) => (line === a[i] ? [] : [i + 1]));
}

/** A problem's drills: its mutants that change 1–MAX_BUG_LINES lines, n = index in the mutants file. */
export function drillsFor(reference, mutants, namesEn = {}) {
  const seen = new Set();
  return mutants.flatMap((mutant, n) => {
    const changed = (mutant.language ?? 'python') === 'python' && bugLines(reference, mutant.code);
    if (!changed || !changed.length || changed.length > MAX_BUG_LINES || seen.has(mutant.code)) return [];
    seen.add(mutant.code);
    const nameEn = namesEn[mutant.name];
    return [{ n, code: mutant.code, bugLines: changed, budget: changed.length + 1, nameZh: mutant.name, ...(nameEn && { nameEn }) }];
  });
}

export function buildDrills(root = resolve('content/oa-judge')) {
  const registry = JSON.parse(readFileSync(resolve(root, 'registry.json'), 'utf8'));
  const namesFile = resolve(root, 'drill-names-en.json');
  const namesEn = existsSync(namesFile) ? JSON.parse(readFileSync(namesFile, 'utf8')) : {};
  const mutantsDir = resolve(root, 'mutants');
  const problems = {};
  for (const item of [...registry.items].sort((a, b) => a.id.localeCompare(b.id))) {
    const python = item.authoredSolutions.find((s) => s.language === 'python');
    const file = resolve(mutantsDir, `${item.id}.json`);
    if (!python || !existsSync(file)) continue;
    const drills = drillsFor(python.code, JSON.parse(readFileSync(file, 'utf8')), namesEn);
    if (drills.length) problems[item.id] = { packageChecksum: item.packageChecksum, drills };
  }
  return { schemaVersion: 1, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const out = buildDrills();
  const all = Object.values(out.problems).flatMap((p) => p.drills);
  writeFileSync(resolve('content/oa-judge/drills.json'), JSON.stringify(out) + '\n');
  const missing = new Set(all.filter((d) => !d.nameEn).map((d) => d.nameZh));
  console.log(
    `Wrote ${all.length} drills for ${Object.keys(out.problems).length} problems; ${missing.size} names without English.`,
  );
}
