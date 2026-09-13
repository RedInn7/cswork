/** Static, deterministic MDX-to-data import. Never imports/evaluates source code. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import GithubSlugger from 'github-slugger';

const ORIGIN = 'https://oamaster.com';
const REPOSITORY = 'https://github.com/RedInn7/OA-Master';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const languageNames = { Python: 'python', Java: 'java', 'C++': 'cpp', SQL: 'sql' };
const headingText = (text) => text.replace(/`/g, '').replace(/&(gt|lt|amp|quot|apos);/g, (_, entity) => ({ gt: '>', lt: '<', amp: '&', quot: '"', apos: "'" })[entity]);
const nonProblems = new Map([
  ['amazon-mern:1', 'About this file'],
  ['amazon-mern:11', 'Note'],
  ['ibm-frontend:1', 'About this file'],
]);

/** Fence-aware scan; headings, JSX-looking code and Python comments stay literal. */
export function scanLines(text) {
  let fence = null;
  const result = text.replace(/\r\n/g, '\n').split('\n').map((line, index) => {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    const inside = fence !== null;
    let boundary = null;
    if (!fence && match) {
      fence = match[1];
      boundary = 'open';
    } else if (fence && match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) {
      fence = null;
      boundary = 'close';
    }
    return { line, index, inside, boundary, info: boundary === 'open' ? match[2].trim() : '' };
  });
  if (fence) throw new Error('Unclosed fenced code block');
  return result;
}

function parseBody(body, label) {
  const statement = [], explanation = [], solutions = [];
  let target = statement;
  let tabs = false, tab = null, code = null;
  let solutionHeading = false;
  let structuralLines = 0, retainedLines = 0, solutionLines = 0;
  for (const row of scanLines(body)) {
    const { line, inside, boundary, info } = row;
    if (tab !== null) {
      if (boundary === 'open') {
        if (code) throw new Error(`${label}: nested solution fence`);
        if (info !== languageNames[tab]) throw new Error(`${label}: ${tab}/${info} language mismatch`);
        code = { language: info, lines: [] };
        structuralLines++;
      } else if (boundary === 'close') {
        if (!code) throw new Error(`${label}: unmatched solution fence`);
        solutions.push({ language: code.language, code: code.lines.join('\n') });
        code = null;
        structuralLines++;
      } else if (inside) {
        code.lines.push(line);
        solutionLines++;
      } else if (line.trim() === '</Tab>') {
        tab = null;
        structuralLines++;
      } else if (!line.trim()) {
        structuralLines++;
      } else {
        throw new Error(`${label}: unhandled content inside Tab: ${line}`);
      }
      continue;
    }
    if (!inside && !boundary) {
      if (/^### 解法\s*$/.test(line) && !solutionHeading) {
        target = explanation;
        solutionHeading = true;
        structuralLines++;
        continue;
      }
      if (/^<Tabs items=\{\["[^"]+"(?:,\s*"[^"]+")*\]\}>\s*$/.test(line)) {
        if (tabs) throw new Error(`${label}: nested Tabs`);
        tabs = true;
        structuralLines++;
        continue;
      }
      const tabMatch = line.match(/^<Tab value="(Python|Java|C\+\+|SQL)">\s*$/);
      if (tabMatch) {
        if (!tabs) throw new Error(`${label}: Tab without Tabs`);
        tab = tabMatch[1];
        structuralLines++;
        continue;
      }
      if (line.trim() === '</Tabs>') {
        if (!tabs) throw new Error(`${label}: unexpected closing Tabs`);
        tabs = false;
        structuralLines++;
        continue;
      }
      // MDX author comments are retained as inert Markdown text, never executed.
      if (/^\s*\{\/\*.*\*\/\}\s*$/.test(line)) {
        target.push(line);
        retainedLines++;
        continue;
      }
      if (/^\s*(?:<\/?[A-Za-z]|import\s|export\s|\{\/\*)/.test(line)) {
        throw new Error(`${label}: unknown MDX syntax; audit before importing: ${line}`);
      }
    }
    target.push(line);
    retainedLines++;
  }
  if (tabs || tab || code) throw new Error(`${label}: unclosed Tabs`);
  // Non-Tab reference code (e.g. IBM CSS) stays in its explanatory context too.
  let extraCode = null;
  for (const row of scanLines(explanation.join('\n'))) {
    if (row.boundary === 'open') extraCode = { language: row.info, lines: [] };
    else if (row.boundary === 'close') {
      if (/^[a-z][a-z0-9+#-]*$/.test(extraCode.language)) {
        solutions.push({ language: extraCode.language, code: extraCode.lines.join('\n') });
      }
      extraCode = null;
    } else if (row.inside) extraCode.lines.push(row.line);
  }
  return {
    statement: statement.join('\n').trim(),
    explanation: explanation.join('\n').trim(), solutions,
    audit: { totalLines: body.split('\n').length, retainedLines, solutionLines, structuralLines },
  };
}

export function parseCompany(text, companySlug) {
  text = text.replace(/\r\n/g, '\n');
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) throw new Error(`${companySlug}: missing frontmatter`);
  const nameMatch = frontmatter[1].match(/^title:\s*(.+)$/m);
  const slugMatch = frontmatter[1].match(/^slug:\s*(.+)$/m);
  if (!nameMatch || slugMatch?.[1] !== `companies/${companySlug}`) throw new Error(`${companySlug}: invalid title or slug`);
  const companyName = nameMatch[1].replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
  const body = text.slice(frontmatter[0].length);
  const rows = scanLines(body);
  const slugger = new GithubSlugger();
  const headers = [];
  for (const row of rows) {
    if (row.inside || row.boundary) continue;
    const heading = row.line.match(/^#{1,6} (.+)$/);
    const anchor = heading ? slugger.slug(headingText(heading[1])) : null;
    const question = row.line.match(/^## (\d+)\. (.+)$/);
    if (question) headers.push({ index: row.index, number: Number(question[1]), title: headingText(question[2]), anchor });
  }
  const items = [], warnings = [], excluded = [], audits = [];
  const seen = new Set();
  const preamble = rows.slice(0, headers[0]?.index ?? rows.length).map((row) => row.line).join('\n').trim();
  if (preamble) excluded.push({ reason: 'company-introduction', content: preamble });
  if (!headers.length) warnings.push({ companySlug, reason: 'no-numbered-problem-headings' });
  headers.forEach((header, index) => {
    if (seen.has(header.number)) throw new Error(`${companySlug}: duplicate source number ${header.number}`);
    seen.add(header.number);
    const raw = rows.slice(header.index + 1, headers[index + 1]?.index ?? rows.length).map((row) => row.line).join('\n');
    const id = `oa-${companySlug}-${header.number}`;
    const excludedTitle = nonProblems.get(`${companySlug}:${header.number}`);
    if (excludedTitle) {
      if (excludedTitle !== header.title) throw new Error(`${id}: excluded introduction changed; review required`);
      excluded.push({ number: header.number, title: header.title, reason: 'editorial-not-a-problem', content: raw.trim() });
      warnings.push({ companySlug, number: header.number, reason: 'editorial-not-a-problem' });
      return;
    }
    const parsed = parseBody(raw, id);
    if (!parsed.statement) warnings.push({ id, reason: 'source-has-no-separate-statement' });
    const { audit, ...content } = parsed;
    if (audit.totalLines !== audit.retainedLines + audit.solutionLines + audit.structuralLines) throw new Error(`${id}: unaccounted source lines`);
    audits.push({ id, ...audit });
    const languages = [...new Set(content.solutions.map((solution) => solution.language))];
    if (!content.explanation) warnings.push({ id, reason: 'source-has-no-separate-explanation' });
    if (!languages.length) warnings.push({ id, reason: 'source-has-no-reference-code' });
    if (raw.includes('{/*')) warnings.push({ id, reason: 'source-author-comment-preserved-as-text' });
    if (scanLines(raw).some((row) => !row.inside && /^### Q\d+[.:]/.test(row.line))) warnings.push({ id, reason: 'source-groups-multiple-subquestions' });
    items.push({ id, companySlug, companyName, number: header.number, title: header.title,
      sourceUrl: `${ORIGIN}/docs/companies/${companySlug}#${header.anchor}`,
      languages, ...content, contentHash: hash(raw) });
  });
  return { company: { slug: companySlug, name: companyName, count: items.length }, items, warnings, excluded, audits };
}

export function importCatalog(sourceRoot, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('A full immutable source commit is required');
  const directory = join(sourceRoot, 'web/content/docs/companies');
  const metaText = readFileSync(join(directory, 'meta.json'), 'utf8');
  const pages = JSON.parse(metaText).pages;
  if (!Array.isArray(pages) || new Set(pages).size !== pages.length || pages.some((page) => !/^[a-z0-9-]+$/.test(page))) throw new Error('Invalid source company order');
  const files = readdirSync(directory).filter((file) => file.endsWith('.mdx')).sort();
  const extras = files.filter((file) => !pages.includes(file.slice(0, -4)));
  if (extras.some((file) => file !== 'index.mdx')) throw new Error(`Unlisted company files: ${extras.join(', ')}`);
  const catalog = { schemaVersion: 1, source: { repository: REPOSITORY, commit, origin: ORIGIN }, companies: [], items: [] };
  const manifest = { schemaVersion: 1, source: catalog.source, metaHash: hash(metaText), files: [], warnings: [], totals: {} };
  for (const slug of [...pages, ...extras.map((file) => file.slice(0, -4))]) {
    const text = readFileSync(join(directory, `${slug}.mdx`), 'utf8');
    if (slug === 'index') {
      manifest.files.push({ file: `${slug}.mdx`, sourceHash: hash(text), questionCount: 0, excluded: [{ reason: 'directory-page', content: text }] });
      manifest.warnings.push({ companySlug: slug, reason: 'directory-page-not-imported-as-problem' });
      continue;
    }
    const parsed = parseCompany(text, slug);
    if (parsed.items.length) catalog.companies.push(parsed.company);
    catalog.items.push(...parsed.items);
    manifest.files.push({ file: `${slug}.mdx`, sourceHash: hash(text), questionCount: parsed.items.length, excluded: parsed.excluded, audit: parsed.audits });
    manifest.warnings.push(...parsed.warnings);
  }
  manifest.totals = { sourceFiles: files.length, companies: catalog.companies.length, questions: catalog.items.length, solutions: catalog.items.reduce((sum, item) => sum + item.solutions.length, 0), warnings: manifest.warnings.length };
  manifest.catalogHash = hash(JSON.stringify(catalog, null, 2) + '\n');
  return { catalog, manifest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceRoot, output = resolve(dirname(fileURLToPath(import.meta.url)), '../content/oa-master')] = process.argv.slice(2);
  if (!sourceRoot) throw new Error('Usage: node scripts/import-oa-master.mjs <authorized-source-checkout> [output-directory]');
  const commit = execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['-C', sourceRoot, 'status', '--porcelain', '--', 'web/content/docs/companies'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Source companies have uncommitted changes; provenance would be inaccurate');
  const { catalog, manifest } = importCatalog(sourceRoot, commit);
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  writeFileSync(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest.totals));
}
