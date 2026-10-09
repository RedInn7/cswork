/**
 * Validates English OA statements in content/oa-judge/translations/<id>.json.
 * Each translation is bound to its package checksum and must keep every number and
 * ASCII identifier/literal from the Chinese statement, so bounds and outputs cannot drift.
 * Usage: node scripts/oa-judge/check-translations.mjs [--quiet] [id ...]
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';

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
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const normalize = (text) =>
  text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (s) =>
    '^' + [...s].map((c) => superscripts.indexOf(c)).join(''),
  );
const numbers = (text) => new Set(normalize(text).match(/\d+/g) || []);
const identifiers = (text) =>
  new Set(
    (normalize(text).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).filter(
      (w) => w.length > 1,
    ),
  );
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
    const en = t.en || {};
    if (t.schemaVersion !== 1 || t.id !== id) problems.push('bad schemaVersion/id');
    if (!registry.has(id)) problems.push('not in registry');
    else if (t.packageChecksum !== registry.get(id)) problems.push('stale packageChecksum');
    for (const key of ['title', 'description', 'input', 'output'])
      if (typeof en[key] !== 'string' || !en[key].trim()) problems.push(`missing en.${key}`);
    for (const [key, max] of Object.entries(limits))
      if (typeof en[key] === 'string' && en[key].length > max) problems.push(`en.${key} too long`);
    if (typeof en.explanation !== 'string') problems.push('en.explanation must be a string');
    if (!Array.isArray(en.hints) || en.hints.length > 10 || en.hints.some((h) => typeof h !== 'string' || !h.trim() || h.length > 2000))
      problems.push('en.hints must be 0..10 non-empty strings');
    const english = fields(en);
    if (/[㐀-鿿]/.test(english)) problems.push('Chinese characters left in English text');
    if (registry.has(id)) {
      const zh = fields(chinese(id));
      const enNumbers = numbers(english), enWords = identifiers(english);
      const lostNumbers = [...numbers(zh)].filter((n) => !enNumbers.has(n));
      const lostWords = [...identifiers(zh)].filter((w) => !enWords.has(w));
      if (lostNumbers.length) problems.push(`numbers missing: ${lostNumbers.join(' ')}`);
      if (lostWords.length) problems.push(`identifiers missing: ${lostWords.join(' ')}`);
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
