/**
 * Validates translated OA statements in content/oa-judge/translations/<id>.json: English (`en`,
 * required) and Japanese, Korean, Vietnamese (`ja`, `ko`, `vi`, each optional).
 * Each file is bound to its package checksum and every language must keep every number and
 * ASCII identifier/literal from the Chinese statement, so bounds and outputs cannot drift.
 * Usage: node scripts/oa-judge/check-translations.mjs [--quiet] [id ...]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { TRANSLATED, identifiers, numbers, scriptProblem } from './text-checks.mjs';

const root = 'content/oa-judge';
const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const only = args.filter((a) => !a.startsWith('--'));
const registry = new Map(
  JSON.parse(readFileSync(`${root}/registry.json`, 'utf8')).items.map((i) => [
    i.id,
    i.packageChecksum,
  ]),
);
const dir = `${root}/translations`;
const files = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json'))
  : [];
const fields = (s) =>
  [s.title, s.description, s.input, s.output, s.explanation, ...(s.hints || [])].join('\n');
const limits = { title: 180, description: 60000, input: 12000, output: 12000, explanation: 12000 };

/** Chinese statement fields straight from the package head, without loading test cases. */
function chinese(id) {
  const text = readFileSync(`${root}/packages/${id}.json`, 'utf8').slice(0, 2 * 1024 * 1024);
  const at = text.search(/,\s*"cases"\s*:\s*\[/);
  return JSON.parse(text.slice(0, at) + '}').problem;
}

let failures = 0;
for (const file of files) {
  const id = file.slice(0, -5);
  if (only.length && !only.includes(id)) continue;
  const problems = [];
  try {
    const t = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8'));
    if (t.schemaVersion !== 1 || t.id !== id) problems.push('bad schemaVersion/id');
    if (!registry.has(id)) problems.push('not in registry');
    else if (t.packageChecksum !== registry.get(id)) problems.push('stale packageChecksum');
    const extra = Object.keys(t).filter((key) => !['schemaVersion', 'id', 'packageChecksum', 'en', ...TRANSLATED].includes(key));
    if (extra.length) problems.push(`unknown keys: ${extra.join(' ')}`);
    const zh = registry.has(id) ? fields(chinese(id)) : '';
    for (const lang of ['en', ...TRANSLATED]) {
      if (lang !== 'en' && !(lang in t)) continue;
      const s = t[lang] || {};
      for (const key of ['title', 'description', 'input', 'output'])
        if (typeof s[key] !== 'string' || !s[key].trim()) problems.push(`missing ${lang}.${key}`);
      for (const [key, max] of Object.entries(limits))
        if (typeof s[key] === 'string' && s[key].length > max) problems.push(`${lang}.${key} too long`);
      if (typeof s.explanation !== 'string') problems.push(`${lang}.explanation must be a string`);
      if (!Array.isArray(s.hints) || s.hints.length > 10 || s.hints.some((h) => typeof h !== 'string' || !h.trim() || h.length > 2000))
        problems.push(`${lang}.hints must be 0..10 non-empty strings`);
      const translated = fields(s);
      const script = scriptProblem(lang, translated);
      if (script) problems.push(`${script} ${lang} text`);
      const ownNumbers = numbers(translated), ownWords = identifiers(translated);
      const lostNumbers = [...numbers(zh)].filter((n) => !ownNumbers.has(n));
      const lostWords = [...identifiers(zh)].filter((w) => !ownWords.has(w));
      if (lostNumbers.length) problems.push(`${lang} numbers missing: ${lostNumbers.join(' ')}`);
      if (lostWords.length) problems.push(`${lang} identifiers missing: ${lostWords.join(' ')}`);
    }
  } catch (error) {
    problems.push(`unreadable: ${error.message}`);
  }
  if (problems.length) {
    failures++;
    console.log(`FAIL ${id}: ${problems.join('; ')}`);
  } else if (!quiet) console.log(`ok ${id}`);
}
console.log(`${files.length} translation file(s), ${failures} failing`);
process.exit(failures ? 1 : 0);
