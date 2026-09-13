import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { importCatalog, parseCompany, scanLines } from '../scripts/import-oa-master.mjs';

const fixture = (body, slug = 'example') => `---\ntitle: Example Company\nslug: companies/${slug}\n---\n\n${body}\n`;
const paragraph = 'A real statement with `n < 10`, text and examples.';
const tabs = (code = 'print(1)') => `<Tabs items={["Python"]}>\n<Tab value="Python">\n\`\`\`python\n${code}\n\`\`\`\n</Tab>\n</Tabs>`;
const catalogText = readFileSync(new URL('../content/oa-master/catalog.json', import.meta.url), 'utf8');
const catalog = JSON.parse(catalogText);
const manifest = JSON.parse(readFileSync(new URL('../content/oa-master/manifest.json', import.meta.url), 'utf8'));

test('static import preserves statement, explanation, code, source numbers and anchors', () => {
  const result = parseCompany(fixture(`## 3. Tokens (Fast)\n\n${paragraph}\n\n### 解法\n\nKeep every explanation.\n${tabs()}\n\nKeep the trailing note.\n\n## 9. SQL\n${paragraph}`), 'example');
  assert.equal(result.company.name, 'Example Company');
  assert.deepEqual(result.items.map((item) => item.id), ['oa-example-3', 'oa-example-9']);
  const first = result.items[0];
  assert.equal(first.sourceUrl, 'https://oamaster.com/docs/companies/example#3-tokens-fast');
  assert.equal(first.statement, paragraph);
  assert.match(first.explanation, /Keep every explanation\./);
  assert.match(first.explanation, /Keep the trailing note\./);
  assert.deepEqual(first.solutions, [{ language: 'python', code: 'print(1)' }]);
  assert.deepEqual(first.languages, ['python']);
  for (const audit of result.audits) assert.equal(audit.totalLines, audit.retainedLines + audit.solutionLines + audit.structuralLines);
});

test('fenced headings and JSX-looking program text never become questions or markup', () => {
  const code = '## 2. Not a real question\n<Tab value="Java">\n### 解法\nprint("safe")';
  const source = fixture(`## 1. Real question\n${paragraph}\n### 解法\nExplanation.\n${tabs(code)}`);
  const result = parseCompany(source, 'example');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].solutions[0].code, code);
  assert.equal(result.items[0].title, 'Real question');
  assert.throws(() => scanLines('```python\nmissing close'), /Unclosed/);
  assert.equal(scanLines('````python\n```\n## still code\n````')[2].inside, true);
});

test('unknown MDX and malformed Tabs stop import rather than lose source content', () => {
  for (const body of ['<Unknown secret="yes" />', 'import malicious from "x"', '<Tabs items={["Python"]}>\n<Tab value="Python">\nUnexpected paragraph\n</Tab>\n</Tabs>']) {
    assert.throws(() => parseCompany(fixture(`## 1. Real\n${paragraph}\n${body}`), 'example'), /unknown MDX|unhandled content/);
  }
  assert.throws(() => parseCompany(fixture(`## 1. Real\n${paragraph}\n<Tabs items={["Python"]}>`), 'example'), /unclosed Tabs/);
  assert.throws(() => parseCompany(fixture(`## 1. Real\n${paragraph}\n## 1. Duplicate\n${paragraph}`), 'example'), /duplicate source number/);
});

test('no invented statement or reference solution; introduction and author comments audited', () => {
  const result = parseCompany(fixture('## 1. Title only\n### 解法\nOnly the explanation exists.\n{/* Source author note. */}'), 'example');
  assert.equal(result.items[0].statement, '');
  assert.deepEqual(result.items[0].solutions, []);
  assert.match(result.items[0].explanation, /Source author note/);
  assert.ok(result.warnings.some((warning) => warning.reason === 'source-has-no-separate-statement'));
  assert.ok(result.warnings.some((warning) => warning.reason === 'source-author-comment-preserved-as-text'));
  const excluded = parseCompany(fixture('## 1. About this file\nOriginal introduction.\n## 2. Actual question\nOriginal statement.', 'ibm-frontend'), 'ibm-frontend');
  assert.equal(excluded.items.length, 1);
  assert.equal(excluded.items[0].number, 2);
  assert.equal(excluded.excluded[0].content, 'Original introduction.');
});

test('grouped subquestions, inline CSS reference and source footnotes are retained', () => {
  const result = parseCompany(fixture('## 1. Group\n### Q1: First\nQuestion one.\n### 解法\nAnswer one.\n### Q2: Second\nQuestion two.\n### 解法\nAnswer two.\n```css\nbody { color: red; }\n```\nFootnote.'), 'example');
  assert.match(result.items[0].explanation, /### Q2: Second\nQuestion two\.\n### 解法\nAnswer two\./);
  assert.match(result.items[0].explanation, /Footnote\./);
  assert.deepEqual(result.items[0].solutions, [{ language: 'css', code: 'body { color: red; }' }]);
  assert.ok(result.warnings.some((warning) => warning.reason === 'source-groups-multiple-subquestions'));
});

test('committed catalog is complete, bounded to provenance, unique and line-accounted', () => {
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.source.commit, 'e66f809f4c953bce129f68491726176615db6afc');
  assert.equal(catalog.companies.length, 167);
  assert.equal(catalog.items.length, 1634);
  assert.equal(new Set(catalog.items.map((item) => item.id)).size, catalog.items.length);
  assert.equal(manifest.files.length, 168);
  assert.equal(manifest.totals.questions, catalog.items.length);
  assert.equal(manifest.totals.solutions, 4733);
  assert.equal(manifest.catalogHash, createHash('sha256').update(catalogText).digest('hex'));
  for (const company of catalog.companies) {
    assert.equal(company.count, catalog.items.filter((item) => item.companySlug === company.slug).length);
  }
  for (const item of catalog.items) {
    assert.equal(item.id, `oa-${item.companySlug}-${item.number}`);
    assert.match(item.contentHash, /^[a-f0-9]{64}$/);
    assert.ok(item.sourceUrl.startsWith(`https://oamaster.com/docs/companies/${item.companySlug}#`));
    assert.deepEqual(item.languages, [...new Set(item.solutions.map((solution) => solution.language))]);
    for (const solution of item.solutions) assert.ok(solution.code.length > 0);
  }
  for (const file of manifest.files) {
    assert.match(file.sourceHash, /^[a-f0-9]{64}$/);
    for (const audit of file.audit ?? []) assert.equal(audit.totalLines, audit.retainedLines + audit.solutionLines + audit.structuralLines);
  }
  assert.deepEqual(catalog.items.filter((item) => !item.statement).map((item) => item.id), ['oa-intuit-5', 'oa-intuit-7', 'oa-intuit-8']);
  assert.equal(catalog.items.find((item) => item.id === 'oa-google-1').solutions.length, 3);
  assert.ok(catalog.items.some((item) => item.id === 'oa-amazon-mern-5'), 'Keep source cross-reference question');
  assert.ok(!catalog.items.some((item) => item.id === 'oa-amazon-mern-1'), 'Do not turn About into a question');
});

test('optional authorized source checkout reproduces both artifacts byte-for-byte', { skip: !process.env.OA_MASTER_SOURCE }, () => {
  const result = importCatalog(process.env.OA_MASTER_SOURCE, catalog.source.commit);
  assert.equal(JSON.stringify(result.catalog, null, 2) + '\n', catalogText);
  assert.deepEqual(result.manifest, manifest);
});
