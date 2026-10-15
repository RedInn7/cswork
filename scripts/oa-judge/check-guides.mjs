/**
 * Validates the OA guide and solution sidecars:
 * - content/oa-judge/guides/<id>.json: { id, packageChecksum, sourceContentHash, editorialSha256,
 *   hints: { zh: [3], en: [3] }, explanationEn }, bound to the registry entry (editorialSha256: the
 *   sha256 of the editorial explanationEn translates), Chinese hints in Chinese, English hints and
 *   editorial without Chinese characters;
 * - content/oa-judge/solutions/<id>.json: { id, packageChecksum, programs: [{ language, code,
 *   sha256 }] } in languages the registry entry doesn't already show, each with a passing
 *   reports/solutions-<chunk>.json entry for its exact code and package (verify-solutions.mjs).
 * Usage: node scripts/oa-judge/check-guides.mjs [--quiet] [id ...]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { passingPrograms, programKey } from '../../lib/oa-solution-evidence.mjs';

const root = 'content/oa-judge';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const only = args.filter((a) => !a.startsWith('--'));
const registry = new Map(JSON.parse(readFileSync(`${root}/registry.json`, 'utf8')).items.map((i) => [i.id, i]));
const passing = passingPrograms(root);
const han = /[㐀-鿿]/;
const LANGUAGES = ['python', 'cpp', 'java', 'go'];
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const sameKeys = (value, keys) => JSON.stringify(Object.keys(value ?? {}).sort()) === JSON.stringify([...keys].sort());

function checkGuide(g, entry, problems) {
  if (!sameKeys(g, ['id', 'packageChecksum', 'sourceContentHash', 'editorialSha256', 'hints', 'explanationEn']))
    problems.push('fields must be id, packageChecksum, sourceContentHash, editorialSha256, hints, explanationEn');
  if (entry && g.sourceContentHash !== entry.sourceContentHash) problems.push('stale sourceContentHash');
  if (entry && g.editorialSha256 !== sha256(entry.editorial)) problems.push('stale editorialSha256 (the registry editorial changed: update explanationEn)');
  if (!sameKeys(g.hints, ['zh', 'en'])) problems.push('hints must be { zh, en }');
  for (const lang of ['zh', 'en']) {
    const list = g.hints?.[lang];
    if (!Array.isArray(list) || list.length !== 3 || !list.every((h) => text(h, 2000)))
      problems.push(`hints.${lang} must be 3 non-empty strings of at most 2000 characters`);
    else if (lang === 'zh' && !list.every((h) => han.test(h))) problems.push('hints.zh must be Chinese');
    else if (lang === 'en' && list.some((h) => han.test(h))) problems.push('Chinese characters in hints.en');
  }
  if (!text(g.explanationEn, 20000)) problems.push('explanationEn must be 1..20000 characters');
  else if (han.test(g.explanationEn)) problems.push('Chinese characters in explanationEn');
}

function checkSolutions(s, entry, problems) {
  if (!sameKeys(s, ['id', 'packageChecksum', 'programs'])) problems.push('fields must be id, packageChecksum, programs');
  if (!Array.isArray(s.programs) || !s.programs.length || s.programs.length > 4) return problems.push('programs must list 1..4 programs');
  const seen = new Set();
  for (const p of s.programs) {
    const label = p?.language;
    if (!sameKeys(p, ['language', 'code', 'sha256'])) problems.push(`${label}: fields must be language, code, sha256`);
    if (!LANGUAGES.includes(p.language) || seen.has(p.language)) problems.push(`${label}: unknown or repeated language`);
    seen.add(p.language);
    if (entry?.authoredSolutions.some((a) => a.language === p.language)) problems.push(`${label}: the registry already shows this language`);
    if (!text(p.code, 200000)) problems.push(`${label}: code must be 1..200000 characters`);
    else if (sha256(p.code) !== p.sha256) problems.push(`${label}: sha256 does not match the code`);
    else if (!passing.has(programKey({ id: s.id, ...p, packageChecksum: s.packageChecksum })))
      problems.push(`${label}: no report passes this code on this package (verify-solutions.mjs --report)`);
  }
}

let files = 0, failures = 0;
for (const [dir, check] of [['guides', checkGuide], ['solutions', checkSolutions]]) {
  const path = `${root}/${dir}`;
  for (const file of existsSync(path) ? readdirSync(path).filter((f) => f.endsWith('.json')) : []) {
    const id = file.slice(0, -5);
    if (only.length && !only.includes(id)) continue;
    files++;
    const problems = [];
    try {
      const value = JSON.parse(readFileSync(`${path}/${file}`, 'utf8'));
      const entry = registry.get(id);
      if (value.id !== id) problems.push('id does not match the file name');
      if (!entry) problems.push('not in registry');
      else if (value.packageChecksum !== entry.packageChecksum) problems.push('stale packageChecksum');
      check(value, entry, problems);
    } catch (error) {
      problems.push(`unreadable: ${error.message}`);
    }
    if (problems.length) {
      failures++;
      console.log(`FAIL ${dir}/${id}: ${problems.join('; ')}`);
    } else if (!quiet) console.log(`ok ${dir}/${id}`);
  }
}
console.log(`${files} guide/solution file(s), ${failures} failing`);
process.exit(failures ? 1 : 0);
