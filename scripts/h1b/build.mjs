#!/usr/bin/env node
// Builds lib/content/h1b-sponsors.json from the USCIS H-1B Employer Data Hub exports
// (https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub), US government
// data in the public domain. Download the yearly files into one directory, then:
//   node scripts/h1b/build.mjs <dir> [--updated=YYYY-MM-DD]
// Only per-company yearly totals and the matched employer names are written: no tax IDs,
// cities or ZIP codes. Companies come from lib/content/h1b-aliases.json (company page slug →
// employer names, exact or /regex/ on the normalized name); spot-check what it prints.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const FISCAL_YEARS = 5;
export const SOURCE = 'USCIS H-1B Employer Data Hub';
export const SOURCE_URL = 'https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub';
const OUT = resolve(import.meta.dirname, '../../lib/content/h1b-sponsors.json');
const ALIASES = resolve(import.meta.dirname, '../../lib/content/h1b-aliases.json');
const EMPLOYERS_SHOWN = 10;

// Older files count Initial / Continuing; newer ones split six ways. New employment = New
// Employment + New Concurrent + Change of Employer; continuing = Continuation + Change with
// Same Employer + Amended, so both line up with the old two columns.
const SERIES = {
  initial: 'new',
  newemployment: 'new',
  newconcurrent: 'new',
  changeofemployer: 'new',
  continuing: 'cont',
  continuation: 'cont',
  changewithsameemployer: 'cont',
  amended: 'cont',
};
const COUNT = new RegExp(`^(${Object.keys(SERIES).join('|')})(approval|denial)s?$`);
const key = (header) => header.toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (value = '') => Number(value.replace(/[,\s]/g, '')) || 0;

/** A downloaded file as text: the hub has exported UTF-8 and UTF-16 (tab-separated) files. */
export function readTable(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  return buffer.toString('utf8').replace(/^﻿/, '');
}

/** RFC 4180 rows; tab-separated when the header line has a tab. Blank rows are dropped. */
export function parseCsv(text) {
  const end = text.indexOf('\n');
  const delimiter = text.slice(0, end < 0 ? undefined : end).includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [],
    field = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') field += text[++i];
      else quoted = false;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** One record per row: fiscal year, employer and the four totals. Throws on an unknown layout. */
export function records(rows, file = '') {
  const [head = [], ...body] = rows;
  const keys = head.map(key);
  const fy = keys.indexOf('fiscalyear');
  // "Employer" in older files, "Employer (Petitioner) Name" in newer ones.
  const employer = keys.findIndex((k) => k.startsWith('employer'));
  const counts = keys.flatMap((k, i) => {
    const m = COUNT.exec(k);
    return m ? [{ i, field: SERIES[m[1]] + (m[2] === 'approval' ? 'Approved' : 'Denied') }] : [];
  });
  if (fy < 0 || employer < 0 || counts.length < 4)
    throw new Error(`${file}: not an H-1B Employer Data Hub export (columns: ${head.join(', ')})`);
  return body.map((r) => {
    const out = { fy: num(r[fy]), employer: (r[employer] ?? '').trim(), newApproved: 0, newDenied: 0, contApproved: 0, contDenied: 0 };
    for (const { i, field } of counts) out[field] += num(r[i]);
    return out;
  });
}

// Legal-form endings the hub spells many ways ("Google LLC", "GOOGLE INC.").
const SUFFIX = /\s(?:INC|INCORPORATED|L ?L ?C|L ?L ?P|L ?P|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|P ?C|N ?A)$/;
/** Upper case, punctuation to spaces, no leading THE or trailing legal form: "The MathWorks, Inc." → "MATHWORKS". */
export function normalizeName(name) {
  let n = name.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/^THE /, '');
  for (let prev = ''; prev !== n; ) n = (prev = n).replace(SUFFIX, '');
  return n;
}

/** employer name → company slug or null: exact aliases first, then /regex/ ones in file order. */
export function matcher(aliases) {
  const exact = new Map(),
    patterns = [];
  for (const [slug, names] of Object.entries(aliases))
    for (const alias of names) {
      if (alias.length > 2 && alias.startsWith('/') && alias.endsWith('/')) {
        patterns.push([new RegExp(alias.slice(1, -1)), slug]);
        continue;
      }
      const n = normalizeName(alias);
      if (exact.has(n) && exact.get(n) !== slug) throw new Error(`alias "${alias}" is listed for ${exact.get(n)} and ${slug}`);
      exact.set(n, slug);
    }
  return (employer) => {
    const n = normalizeName(employer);
    return exact.get(n) ?? patterns.find(([re]) => re.test(n))?.[1] ?? null;
  };
}

/**
 * `tables`: [{file, rows}] → the h1b-sponsors.json object (latest `years` fiscal years).
 * @param {{ file: string, rows: string[][] }[]} tables
 * @param {Record<string, string[]>} aliases
 * @param {{ updated?: string | null, years?: number }} [options]
 */
export function build(tables, aliases, { updated = null, years = FISCAL_YEARS } = {}) {
  const match = matcher(aliases);
  const seen = new Map();
  const all = tables.flatMap(({ file, rows }) => {
    const list = records(rows, file);
    // The same year in two files would count twice.
    for (const fy of new Set(list.map((r) => r.fy))) {
      if (seen.has(fy) && seen.get(fy) !== file) throw new Error(`FY${fy} is in both ${seen.get(fy)} and ${file}`);
      seen.set(fy, file);
    }
    return list;
  });
  const fiscalYears = [...seen.keys()].filter((fy) => fy > 2000).sort((a, b) => a - b).slice(-years);
  const totals = new Map();
  for (const r of all) {
    const slug = fiscalYears.includes(r.fy) && match(r.employer);
    if (!slug) continue;
    let c = totals.get(slug);
    if (!c) totals.set(slug, (c = { years: new Map(fiscalYears.map((fy) => [fy, { fy, newApproved: 0, newDenied: 0, contApproved: 0, contDenied: 0 }])), employers: new Map() }));
    const y = c.years.get(r.fy);
    for (const f of ['newApproved', 'newDenied', 'contApproved', 'contDenied']) y[f] += r[f];
    const name = r.employer.toUpperCase().replace(/\s+/g, ' ');
    c.employers.set(name, (c.employers.get(name) ?? 0) + r.newApproved + r.contApproved);
  }
  const companies = {};
  for (const slug of [...totals.keys()].sort()) {
    const c = totals.get(slug);
    companies[slug] = {
      years: [...c.years.values()],
      employers: [...c.employers].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, EMPLOYERS_SHOWN).map(([n]) => n),
    };
  }
  return { updated, source: SOURCE, sourceUrl: SOURCE_URL, fiscalYears, companies };
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) throw new Error('usage: node scripts/h1b/build.mjs <dir> [--updated=YYYY-MM-DD]');
  const updated = args.find((a) => a.startsWith('--updated='))?.slice(10) ?? new Date().toISOString().slice(0, 10);
  const tables = readdirSync(dir)
    .filter((f) => /\.(csv|tsv|txt)$/i.test(f))
    .sort()
    .map((file) => ({ file, rows: parseCsv(readTable(readFileSync(join(dir, file)))) }));
  const aliases = JSON.parse(readFileSync(ALIASES, 'utf8')).companies;
  const out = build(tables, aliases, { updated });
  // One line per company keeps the file small and its diffs readable.
  const head = JSON.stringify({ ...out, companies: undefined }, null, 1).slice(0, -2);
  const body = Object.entries(out.companies).map(([slug, c]) => `  ${JSON.stringify(slug)}: ${JSON.stringify(c)}`);
  writeFileSync(OUT, `${head},\n "companies": {\n${body.join(',\n')}\n }\n}\n`);
  // For the spot check: what each company matched, and which got nothing.
  for (const [slug, c] of Object.entries(out.companies)) console.log(`${slug}: ${c.employers.join(' | ')}`);
  const missing = Object.keys(aliases).filter((slug) => !out.companies[slug]);
  if (missing.length) console.warn(`no rows: ${missing.join(', ')}`);
  console.log(`FY${out.fiscalYears.join(', FY')}: ${Object.keys(out.companies).length} companies → ${OUT}`);
}
