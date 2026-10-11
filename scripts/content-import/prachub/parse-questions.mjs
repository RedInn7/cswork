// PracHub coding + interview question pages -> parsed/coding-questions.jsonl, parsed/interview-questions.jsonl
//   node parse-questions.mjs            parse every cached page (re-runnable, output sorted by id)
//   node parse-questions.mjs --check    self-check of the markdown cleaner
// Source of truth is the page's Next.js flight payload (`initialPost` prop): it is what both the visible page and
// the <article data-seo-content> crawler copy are rendered from, but it keeps the exact markdown and the lock flags
// (is_locked, lock_cohort, premium_sections_locked, solution_locked) that the crawler copy does not show.
import assert from 'node:assert/strict';
import { listRaw, readRaw, sourceUrl, jsonLd, meta, stripTags, writeJsonl } from './common.mjs';

const TYPES = [
  { dir: 'coding-questions', type: 'coding_question', prefix: 'cq' },
  { dir: 'interview-questions', type: 'interview_question', prefix: 'iq' },
];
// ponytail: lock_cohort = PracHub's paywall experiment (content is served but shown locked to a visitor cohort);
// treated as premium. PRACHUB_INCLUDE_COHORT=1 imports those questions too.
const INCLUDE_COHORT = process.env.PRACHUB_INCLUDE_COHORT === '1';

/** Rows of the Next.js flight payload: id -> parsed JSON value, or {text} for "T" text chunks. */
export function flightRows(html) {
  let s = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) s += JSON.parse(m[1]);
  const buf = Buffer.from(s);
  const rows = new Map();
  for (let i = 0; i < buf.length;) {
    const colon = buf.indexOf(0x3a, i);
    if (colon < 0) break;
    const id = buf.toString('utf8', i, colon);
    if (buf[colon + 1] === 0x54) { // T<hex byte length>,<text>
      const comma = buf.indexOf(0x2c, colon);
      const end = comma + 1 + parseInt(buf.toString('latin1', colon + 2, comma), 16);
      rows.set(id, { text: buf.toString('utf8', comma + 1, end) });
      i = end;
    } else {
      let nl = buf.indexOf(0x0a, colon);
      if (nl < 0) nl = buf.length;
      try { rows.set(id, JSON.parse(buf.toString('utf8', colon + 1, nl))); } catch { /* I[...] / HL[...] module rows */ }
      i = nl + 1;
    }
  }
  return rows;
}
/** Resolve "$<id>" references, "$$" escapes and "$undefined" in a flight value. */
function deref(rows, v) {
  if (typeof v === 'string') {
    if (v === '$undefined') return null;
    if (/^\$[0-9a-f]+$/.test(v)) {
      const row = rows.get(v.slice(1));
      return row && typeof row.text === 'string' ? row.text : deref(rows, row ?? null);
    }
    return v.startsWith('$$') ? v.slice(1) : v;
  }
  if (Array.isArray(v)) return v.map((x) => deref(rows, x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deref(rows, x)]));
  return v;
}
function findProp(v, key) {
  if (!v || typeof v !== 'object') return null;
  if (!Array.isArray(v) && v[key] && typeof v[key] === 'object') return v[key];
  for (const x of Array.isArray(v) ? v : Object.values(v)) {
    const r = findProp(x, key);
    if (r) return r;
  }
  return null;
}

// ---------- markdown ----------
const FENCE = /^(\s*)((?:[-*+]|\d+[.)])\s+)?(`{3,}|~{3,})(.*)$/; // also "1. ```text" and indented fences in list items
/** Split markdown into text and fenced-code segments (CommonMark fences; an unclosed fence runs to the end). */
function segments(md) {
  const out = [];
  let text = [], fence = null;
  for (const line of md.split('\n')) {
    if (fence) {
      if (new RegExp(`^\\s*${fence.mark[0]}{${fence.mark.length},}\\s*$`).test(line)) { out.push(fence); fence = null; } else fence.lines.push(line);
      continue;
    }
    const m = FENCE.exec(line);
    if (m && !(m[3][0] === '`' && m[4].includes('`'))) {
      out.push({ text: text.join('\n') }); text = [];
      fence = { lead: m[1] + (m[2] || ''), indent: m[1] + ' '.repeat((m[2] || '').length), mark: m[3], info: m[4].trim(), lines: [] };
    } else text.push(line);
  }
  if (fence) out.push(fence);
  out.push({ text: text.join('\n') });
  return out;
}
const fenced = (f) => [(f.lead ?? f.indent) + f.mark + f.info, ...f.lines, f.indent + f.mark].join('\n');

// Line-structured text outside fences (ASCII/pipe tables without a delimiter row, CSV rows, literals, schemas, SQL,
// example I/O) collapses into one paragraph when rendered; fenceRuns puts each run of two or more such lines in a
// ```text block. Short label lines between them ("users", "Rows:") join the run; prose lines end it.
const PROSE = /\b[A-Za-z][a-z’'-]+[,;:]?\s+(?:[a-z][a-z’'-]*[,;:]?\s+){2,}[a-z][a-z’'-]+\b/; // 4+ plain words in a row
const prose = (l) => PROSE.test(l.replace(/`[^`]*`|"[^"]*"|\b(?:null|none|nan|true|false)\b/gi, '0'));
const LIST = /^\s*(?:[-*+]|\d+[.)])\s+/;
const cellsOf = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/);
const DELIM = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const FIELD = /^\s*(?:[-+]?[\d.]+%?|"[^"]*"|'[^']*'|[\w.@:/+-]+(?: [\w.@:/+-]+){0,2}|)\s*$/;
const balanced = (l) => { let d = 0; for (const ch of l) if ((d += '([{'.includes(ch) ? 1 : ')]}'.includes(ch) ? -1 : 0) < 0) return false; return !d; };
const FRAME = [ // structured whatever the words
  /^\s*[+|]?[-=]{3,}(?:[+|][-=]+)+[+|]?\s*$|^\s*\+[-=]{3,}\+?\s*$|^\s*[-=]{3,}(?: +[-=]{3,})*\s*$/, // table borders
  /^\s*\|.*\|\s*$|^\s*(?:[|│]\s+)*(?:[+`\\|]--+ |[├└]──)/, // boxed rows, tree art
  /^\s*["'`]?(?:SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|WITH|(?:LEFT |RIGHT |INNER |FULL |CROSS )*JOIN|UNION|INSERT INTO|UPDATE|DELETE FROM|CREATE (?:TABLE|VIEW|INDEX)|LIMIT|AND|OR|ON|CASE|WHEN|ELSE|END|VALUES)(?:\s|$)|^\s*--\s/,
  /^\s*(?:def|class)\s+\w+.*:\s*$|^\s*[\]})]+[,;.]?`?\s*$/, // python block heads, closing brackets
  /^\s*(?:\*\*)?(?:Input|Output|Expected output|Returns?|Result)(?:\*\*)?\s*:(?:\*\*)?\s*(?:$|`?(?:[[{("'\d-]|true\b|false\b|True\b|False\b|None\b|null\b|[A-Za-z_]\w*\s*=))/,
];
const DATA = [ // structured unless the line reads as prose
  /^\s*`?[[{](?![^\]]*\]\()(?![ xX]\] )/, // list / dict literal (not a link or task item)
  /^\s*`?[A-Za-z_][\w.]*(?:\[[^\]]*\])*\s*[-+*/]?=(?!=)\s*\S/, // assignment
  /^\s*["'][^"']+["']\s*:\s*\S/, // json key
  /^\s*\((?!\w{1,4}\)\s).*,.*\)\s*[,;]?\s*$/, // tuple (not an "(1) ..." enumeration)
  /\S {2,}\S+ {2,}\S/, // whitespace-aligned columns
];
function structured(l) {
  if (LIST.test(l) || /^\s*>|^\s*#{1,6}\s/.test(l)) return false;
  l = l.replace(/^(\s*)`([^`]+)`\s*$/, '$1$2'); // a whole line of inline code
  const c = cellsOf(l.replace(/`[^`]*`/g, 'x'));
  if (FRAME.some((r) => r.test(l)) || (c.length >= 2 && c.some((x) => x.trim()) && c.every((x) => x.length <= 60) && (c.length > 3 || !prose(l)))) return true;
  const code = l.replace(/\s(?:--|#|\/\/)\s.*$/, ''); // trailing comment
  if (prose(code)) return false;
  const f = l.trim().split(',');
  if (f.length >= 3 && f.every((x) => FIELD.test(x)) && (/\d/.test(l) || !/,\s/.test(l) || f.every((x) => /^\s*[A-Za-z_]\w*\s*$/.test(x)))) return true; // csv
  if (/^\s*[A-Za-z_][\w.]*(?:\(|\s\(.*[,=])/.test(code) && /\)\s*[,;.]?\s*$/.test(code) && balanced(code)) return true; // call / schema
  return DATA.some((r) => r.test(code)) && (!/^\s*\(/.test(code) || balanced(code));
}
const label = (l) => !prose(l) && !LIST.test(l) && !/^\s*>|^\s*#{1,6}\s|^\s*(?:\*\*)?(?:Explanation|Note)\b/i.test(l);
const lead = (l) => label(l) && !/:\s*$|^\s*\*\*|^\s*Example/i.test(l) && l.trim().split(/\s+/).length <= 4 && !l.replace(/\(.*\)/, '').includes(',');
const indentOf = (l) => /^\s*/.exec(l)[0].length;
/** One text segment -> [{text} | fence] with its structured runs fenced (and code-span pipes in table rows escaped). */
function fenceRuns(text) {
  const lines = text.split('\n'), out = [];
  let buf = [];
  const brk = (l) => !l.trim() || /^ {0,3}#{1,6}(\s|$)/.test(l);
  for (let i = 0; i < lines.length;) {
    if (brk(lines[i])) { buf.push(lines[i++]); continue; }
    let j = i;
    while (j < lines.length && !brk(lines[j])) j++;
    const block = lines.slice(i, j);
    i = j;
    if (/^ {4}/.test(block[0])) { buf.push(...block); continue; } // indented code or nested content
    let end = block.findIndex((l, k) => l.includes('|') && DELIM.test(block[k + 1] || '') && /\|.*-|-.*\|/.test(block[k + 1]) && cellsOf(l).length === cellsOf(block[k + 1]).length);
    if (end < 0) end = block.length; // a GFM table runs from its header row to the block end
    const item = (k) => block.slice(0, k + 1).findLast((l) => LIST.test(l)), colOf = (l) => (l ? LIST.exec(l)[0].length : 0);
    let py = -1; // the body of a python def/class is code too
    const isS = block.map((l, k) => {
      if (k >= end) return false;
      if (py >= 0 && indentOf(l) > py) return true;
      const s = structured(l.replace(LIST, '')); // a list item may start with a structured line
      py = /^\s*(?:def|class)\s/.test(l) && s ? indentOf(l) : -1;
      return s;
    });
    for (let k = 0; k < end;) {
      let a = k, b = k, n = 1;
      if (isS[k]) for (let m = k + 1; m < end && !LIST.test(block[m]) && (isS[m] || label(block[m])); m++) if (isS[m]) { b = m; n++; }
      if (n < 2 || (LIST.test(block[a]) && indentOf(block[a + 1]) < colOf(block[a]))) { buf.push(block[k++]); continue; } // lazy lines leave the item
      if (a > 0 && !isS[a - 1] && !LIST.test(block[a]) && lead(block[a - 1])) { a--; buf.pop(); }
      while (b + 1 < end && /:\s*$/.test(block[b]) && label(block[b + 1]) && block[b + 1].trim().split(/\s+/).length <= 3) b++;
      // fenced inside the list item it continues (or starts: "1. ```text"); lazy continuation lines end the list
      const li = LIST.exec(block[a]), col = colOf(item(a)), run = block.slice(a, b + 1).map((l) => l.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]*)`/g, '$1'));
      if (li) run[0] = ' '.repeat(col) + run[0].replace(LIST, '');
      if (/^\s*`/.test(run[0]) && /`\s*$/.test(run.at(-1))) { run[0] = run[0].replace('`', ''); run[run.length - 1] = run.at(-1).replace(/`(\s*)$/, '$1'); }
      const indent = li || run.every((l) => indentOf(l) >= col) ? ' '.repeat(col) : '';
      out.push({ text: buf.join('\n') + (indent ? '' : '\n') }, { lead: li?.[0], indent, mark: '```', info: 'text', lines: run.map((l) => ' '.repeat(Math.max(0, indent.length - indentOf(l))) + l) });
      buf = indent ? [] : [''];
      k = b + 1;
    }
    if (end > 0 && end < block.length && indentOf(block[end]) < colOf(item(end))) buf.push(''); // a table lazily after a list item is no table
    buf.push(...block.slice(end, end + 2), ...block.slice(end + 2).map((l) => l.replace(/`[^`\n]+`/g, (s) => s.replace(/(?<!\\)\|/g, '\\|'))));
  }
  out.push({ text: buf.join('\n') });
  return out;
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
// Plain GFM only: CSWORK renders bodies with react-markdown (no raw HTML; angle-bracket text such as <timestamp> shows as text), so no <details>.
const quote = (label, md) => [`> **${label}**`, '>', ...md.trim().split('\n').map((l) => (l ? `> ${l}` : '>'))].join('\n');
// The source wraps text before "(1)" / "1)" ("O(\n1)", "put(1,\n10)", "get\n(\n1)") and pads "O( 1)".
const unwrap = (t) => t.replace(/\(\n(?=\S[^\n()]{0,19}\))/g, '(').replace(/,\n(?=\d+\))/g, ', ').replace(/\bO\s*\n\s*\(/g, 'O(').replace(/\bO\( +(?=\S)/g, 'O(');
// The old site's console contract ("Because this platform grades a function, implement ...") -> "Implement ...".
const PLATFORM = /(^|[.!?]\s+|\n)(?:(?:Because|Since|As) (?:this platform|PracHub)\b[^.,\n]*|(?:On|For|In) (?:this platform|PracHub)),\s*([^.\n]*)/g;
const FILLER = /^- (?:Clarify input sizes, value ranges, mutability, return format, and tie-breaking|State the target time and space complexity before coding|Call out edge cases such as empty inputs, duplicates, invalid values, overflow, and boundary sizes)\.\n?/gm;
/** Text-only fixes: the site's own math normalisation, PracHub self-references and template filler. */
function fixText(t, demote = 0) {
  t = t.replace(/\u200b/g, '').replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$${m.trim().replace(/\n/g, ' ')}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m.trim().replace(/\n/g, ' ')}$`)
    .replace(PLATFORM, (all, pre, rest) => (rest && /function|class|solution|implement|I\/O|operation|grade/i.test(all) ? pre + rest[0].toUpperCase() + rest.slice(1) : all))
    .replace(/\bPracHub(?:'s|’s)?\s+(?=[a-z])/g, '') // "a deterministic PracHub practice wrapper" -> "a deterministic practice wrapper"
    .replace(/\bPracHub\b/g, 'this platform')
    .replace(FILLER, '');
  return demote ? t.replace(/^#{1,6}(?=\s)/gm, (h) => '#'.repeat(Math.min(6, h.length + demote))) : t;
}
/** Drop headings with nothing under them (the next heading is not deeper, or the text ends) and statement-long headings -> paragraphs. */
function tidyHeadings(md) {
  const lines = md.split('\n'), out = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], f = FENCE.exec(l);
    if (fence) { if (f && !f[2] && f[3][0] === fence[0] && f[3].length >= fence.length && !f[4].trim()) fence = null; }
    else if (f && !(f[3][0] === '`' && f[4].includes('`'))) fence = f[3];
    else if (l.length > 200 && /^#{1,6}\s/.test(l)) { out.push(l.replace(/^#+\s+(?:(Question|Scenario|Problem)\s+(?=[A-Z]))?/, (_, w) => (w ? `**${w}** ` : ''))); continue; }
    else if (/^#{1,6}\s/.test(l)) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = /^(#{1,6})\s/.exec(lines[j] || '');
      if (j === lines.length || (next && next[1].length <= /^#+/.exec(l)[0].length)) continue;
    }
    out.push(l);
  }
  return out.join('\n');
}
/**
 * Clean one markdown field. Locked placeholders (```premium-lock <Section>```, ```premium-lock-hint <n>```) are
 * dropped together with the heading they stand under; ```hint <title>``` blocks become "> **Hint: <title>**" quotes.
 * demote: shift headings down that many levels (the text is placed under a heading of ours).
 */
export function cleanMd(md, { demote = 0 } = {}) {
  let locked = false;
  const parts = [];
  for (const seg of segments((md || '').replace(/\u200b/g, '')).flatMap((s) => (s.text === undefined ? [s] : fenceRuns(unwrap(s.text))))) {
    if (seg.text !== undefined) { parts.push(fixText(seg.text, demote)); continue; }
    const [lang, ...rest] = seg.info.split(/\s+/);
    const label = rest.join(' ');
    if (lang.startsWith('premium-lock')) {
      locked = true;
      const prev = parts.length - 1;
      const lines = parts[prev].replace(/\s+$/, '').split('\n');
      const h = /^#{1,6}\s+(.*)$/.exec(lines.at(-1));
      if (h && label && norm(h[1]) === norm(label)) parts[prev] = lines.slice(0, -1).join('\n') + '\n';
    } else if (lang === 'hint') {
      parts.push(`\n${quote(label ? `Hint: ${label}` : 'Hint', fixText(seg.lines.join('\n'))).replace(/^/gm, seg.indent)}\n`); // blank lines: no lazy continuation
    } else {
      parts.push(fenced(seg));
    }
  }
  return { md: tidyHeadings(parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()), locked };
}
/** Drop a leading heading that only repeats the title. */
const dropTitle = (md, title) => md.trimStart().replace(/^#{1,6}\s+(.*)\n*/, (all, h) => (norm(h) === norm(title) ? '' : all));
const list = (xs, ordered) => xs.map((x, i) => `${ordered ? `${i + 1}.` : '-'} ${String(x).trim()}`).join('\n');
const str = (v) => (v == null ? null : typeof v === 'string' ? v : JSON.stringify(v));
const cell = (v) => (v == null ? 'NULL' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));
function mdTable(rows, columns) {
  const cols = columns?.length ? columns : [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  if (!cols.length) return '';
  return [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${cols.map((c) => cell(r?.[c])).join(' | ')} |`)].join('\n');
}

// ---------- schema problems (the coding console) ----------
const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9_]+/g) || []);
/** Token sets of a and b: Jaccard, share of a's tokens found in b, and how many a adds; used to skip a console statement that repeats the main body. */
function overlap(a, b) {
  const A = words(a), B = words(b);
  let i = 0;
  for (const w of A) i += B.has(w) ? 1 : 0;
  return { jaccard: i / (A.size + B.size - i || 1), cover: i / (A.size || 1), added: A.size - i };
}
// What a statement already shows: "Example 1:", "## Examples", "**Example**", Input:/Output: lines; "Constraints:", "## Assumptions / Constraints".
const EXAMPLES = /^\s*(?:#{1,6}\s+|[-*]\s+)?(?:\*\*|__)?\s*(?:Examples?|Sample (?:input|output|test|case)s?)\b|\*\*examples?\b/im;
const IO = /^\s*(?:[-*]\s+)?(?:\*\*)?(Input|Output)(?:\*\*)?\s*:(?:\*\*)?\s*(?:$|`?(?:[[{("'\d-]|true\b|false\b|True\b|False\b|None\b|null\b|[A-Za-z_]\w*\s*=))/gim;
const showsExamples = (md) => EXAMPLES.test(md) || new Set([...md.matchAll(IO)].map((m) => m[1].toLowerCase())).size === 2;
const CONSTRAINTS = /^\s*(?:#{1,6}\s+.*\bconstraints?\b.*|(?:\*\*|__)?.{0,30}\bconstraints?\b.{0,40}?(?::|\*\*|__)(?:\*\*|__|:)*|(?:\*\*)?constraints?(?:\*\*)?)\s*$/im;
const TEMPLATE_CONSTRAINT = /^(?:Inputs are (?:provided as )?Python literals (?:matching|compatible with) the function signature|Return a deterministic (?:exact-match (?:value|result)|value exactly matching the requested output))\.?$/i;
/**
 * One schema problem (coding or SQL) -> {part, md, locked}. A statement that repeats mainMd is omitted from md (for a
 * single problem also one that only restates it), and so are constraints / examples a shown statement already has.
 */
function problem(pr, heading, title, mainMd, single) {
  const st = cleanMd(dropTitle(dropTitle(pr.problem_statement || pr.question || '', title), pr.title), { demote: 1 });
  const constraints = (Array.isArray(pr.constraints) ? pr.constraints : []).map(String).filter((c) => c.trim() && !TEMPLATE_CONSTRAINT.test(c.trim()));
  const samples = (pr.examples?.length ? pr.examples : pr.test_cases || []).map((e) => ({
    input: str(e.input), output: str(e.output ?? e.expected_output), explanation: e.explanation || null,
  }));
  const hints = (pr.hints || []).map((h) => fixText(String(h), false).trim()).filter(Boolean);
  const ap = pr.approach?.explanation ? pr.approach : null;
  const approach = ap && { explanation: cleanMd(ap.explanation, { demote: 3 }).md, timeComplexity: ap.time_complexity || null, spaceComplexity: ap.space_complexity || null };
  const tables = (pr.tables || []).map((t) => ({ name: t.name, columns: t.columns || [], sampleData: t.sample_data || [] }));
  const er = pr.expected_result;
  const { jaccard, cover, added } = overlap(st.md, mainMd);
  // a restatement adds a few words; one that adds a console contract ("Implement solution(...) that replays ...") adds dozens
  const restated = jaccard >= 0.8 || (single && cover >= 0.8 && added <= 10);
  const seen = single ? `${mainMd}\n${st.md}` : restated ? mainMd : st.md; // the main statement is right above a single problem
  const out = [heading && `## ${heading}`, !restated && st.md];
  if (constraints.length && !CONSTRAINTS.test(seen)) out.push(`### Constraints\n\n${list(constraints)}`);
  for (const t of tables) {
    out.push(`### Table \`${t.name}\`\n\n${mdTable(t.columns.map((c) => ({ column: c.name, type: c.type, constraints: (c.constraints || []).join(', ') })), ['column', 'type', 'constraints'])}`);
    if (t.sampleData.length) out.push(`Sample data:\n\n${mdTable(t.sampleData)}`);
  }
  if (er?.sample_output?.length || er?.description) out.push(['### Expected output', er.description, er.sample_output?.length && mdTable(er.sample_output, er.columns)].filter(Boolean).join('\n\n'));
  // Many statements already list their examples; appending the samples again repeats them (they stay in extra.samples).
  if (samples.length && !showsExamples(seen)) {
    out.push('### Examples\n\n' + samples.map((s, i) => [`**Example ${i + 1}**`, '```text', `Input: ${s.input}`, `Output: ${s.output}`, '```', s.explanation && `Explanation: ${s.explanation}`].filter(Boolean).join('\n')).join('\n\n'));
  }
  if (hints.length) out.push(`### Hints\n\n${list(hints, true)}`);
  if (approach) {
    const cx = [approach.timeComplexity && `- Time complexity: ${approach.timeComplexity}`, approach.spaceComplexity && `- Space complexity: ${approach.spaceComplexity}`].filter(Boolean).join('\n');
    out.push(['### Approach', approach.explanation, cx].filter(Boolean).join('\n\n'));
  }
  if (pr.solution_query || pr.solution_explanation) out.push(['### Solution', pr.solution_explanation, pr.solution_query && '```sql\n' + pr.solution_query + '\n```'].filter(Boolean).join('\n\n'));
  const part = { title: heading || pr.title || null, statement: st.md, constraints, samples, hints, approach };
  if (tables.length) Object.assign(part, { tables, expectedOutput: er ? { description: er.description || null, columns: er.columns || null, rows: er.sample_output || [] } : null });
  return { part, md: out.slice(1).some(Boolean) ? out.filter(Boolean).join('\n\n') : '', locked: st.locked }; // no bare heading
}

// ---------- page -> item ----------
const hasCjk = (s) => /[一-龥]/.test(s || '');
/** The site's own choice of question body (enhanced markdown, else the raw post unless private; never Chinese source text). */
const mainBody = (p) => (p.content_enhanced && !hasCjk(p.content_enhanced) ? p.content_enhanced
  : p.source_content_private ? '' : p.content_raw && !hasCjk(p.content_raw) ? p.content_raw : '');
const iso = (s) => (!s ? null : /(Z|[+-]\d\d:?\d\d)$/.test(s) ? s : `${s}Z`);
const slugify = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DIFF = new Set(['easy', 'medium', 'hard']);

/** Returns {item} or {skip: reason}; throws on unparseable pages. */
export function parsePage(html, { dir, type, prefix }, slug) {
  const rows = flightRows(html);
  const raw = [...rows.values()].map((v) => findProp(v, 'initialPost')).find(Boolean);
  if (!raw) throw new Error('no initialPost in flight payload');
  const p = deref(rows, raw);
  if (p.is_locked) return { skip: 'locked' };
  if (p.lock_cohort && !INCLUDE_COHORT) return { skip: 'lockedCohort' };
  if (p.is_hidden) return { skip: 'hidden' };
  const title = (p.title || '').trim();
  if (!title) throw new Error('no title');

  const main = cleanMd(dropTitle(mainBody(p), title));
  let locked = main.locked;
  const sections = [main.md];
  const sd = p.schema_data && typeof p.schema_data === 'object' ? p.schema_data : null;
  const probs = !sd ? [] : sd.problems || sd.questions || (sd.problem_statement || sd.examples ? [sd] : []);
  const parsed = probs.map((pr, i) => {
    const r = problem(pr, probs.length > 1 ? pr.title || `Part ${i + 1}` : pr.title || 'Problem', title, main.md, probs.length === 1);
    locked ||= r.locked;
    return r;
  });
  sections.push(...parsed.map((r) => r.md));
  const solutionPublic = !p.solution_locked && (p.solution || p.solution_explanation);
  if (solutionPublic) {
    const sol = cleanMd(p.solution || '', { demote: 2 });
    locked ||= sol.locked;
    const parts = [p.solution_explanation && cleanMd(p.solution_explanation, { demote: 2 }).md, sol.md, p.expected_results && cleanMd(p.expected_results, { demote: 2 }).md].filter(Boolean);
    sections.push(`## Solution\n\n${parts.join('\n\n')}`);
  }
  const body = sections.filter(Boolean).join('\n\n').trim();
  if (!main.md && !parsed.length) return { skip: main.locked ? 'locked' : 'noPublicBody' };

  const ld = jsonLd(html).find((o) => o['@type'] === 'LearningResource' || o['@type'] === 'TechArticle') || {};
  const related = [];
  const nav = /<nav aria-label="Related [^"]*">([\s\S]*?)<\/nav>/.exec(html);
  for (const m of (nav?.[1] || '').matchAll(/<a href="\/(?:coding|interview)-questions\/([^"/?#]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    related.push({ kind: 'question', slug: m[1], title: stripTags(m[2].split('<!-- -->')[0]).trim() || undefined });
  }
  const tags = [...new Set([...(p.tags || []), ...(p.topics || []), sd?.topic].flatMap((t) => (typeof t === 'string' ? t : t?.name || '').split(/\s*,\s*/)).filter((t) => t && t !== p.category))];
  const single = parsed.length === 1 ? parsed[0].part : null;
  const extra = {
    samples: parsed.flatMap((r) => r.part.samples),
    constraints: single?.constraints.length ? single.constraints : null,
    parts: parsed.length > 1 ? parsed.map((r) => r.part) : null,
  };
  if (single?.tables) Object.assign(extra, { tables: single.tables, expectedOutput: single.expectedOutput });
  const summary = fixText(p.seo_summary || ld.description || meta(html, 'description') || '', false).trim() || null;

  const item = {
    id: `${prefix}-${slug}`, type, slug, title, summary, body,
    company: p.company ? { slug: slugify(p.company), name: p.company } : null,
    role: p.position || null, category: p.category || null, round: p.interview_round || null, seniority: p.seniority || null,
    difficulty: DIFF.has(String(p.difficulty).toLowerCase()) ? String(p.difficulty).toLowerCase() : null,
    tags,
    publishedAt: iso(p.created_at) || ld.datePublished || null,
    updatedAt: iso(p.updated_at) || ld.dateModified || null,
    relations: [...(p.experience_slug ? [{ kind: 'experience', slug: p.experience_slug }] : []), ...related],
    extra,
    sourceUrl: sourceUrl(dir, slug),
    partial: locked || !!p.premium_sections_locked || !!(p.has_solution && p.solution_locked && !p.solution),
  };
  // Regex matches on the page are V8 sliced strings that pin the whole HTML; a JSON round-trip detaches them
  // (without it the item list holds every page in memory, ~170 KB each).
  return { item: JSON.parse(JSON.stringify(item)) };
}

function selfCheck() {
  const md = '# T\n\nIntro \\(x^2\\) on PracHub.\n\n```hint Where to start\nUse a map.\n```\n\n#### What This Part Should Cover\n\n```premium-lock What This Part Should Cover\n```\n\n```python\n# not a heading\n```\n\n```premium-lock-hint 2\n```';
  const r = cleanMd(dropTitle(md, 'T'));
  assert(r.locked, 'lock detected');
  assert(!/premium-lock|What This Part|PracHub|^# T/m.test(r.md), 'locked section, heading, brand and title removed');
  assert(r.md.includes('> **Hint: Where to start**\n>\n> Use a map.') && r.md.includes('$x^2$'), 'hint + math');
  assert(cleanMd('## A\n```py\n# c\n```', { demote: 1 }).md === '### A\n```py\n# c\n```', 'demote skips code');
  const t = cleanMd(['Sample df:', '+----+-----+', '| id | amt |', '+----+-----+', '| 1  | 2.5 |', '+----+-----+', '', 'Plain prose\nstays prose.', '',
    '| a | b |', '| --- | --- |', '| 1 | `x|y` |', '', '1. **Input:** `n = 3`', '   **Output:** `6`', '', '#### Detailed Answer', '', '#### Setup', '',
    'Because this platform grades a function, implement `solution(ops)` in O(\n1) time.', '', '### Clarifying Questions to Ask',
    '- Clarify input sizes, value ranges, mutability, return format, and tie-breaking.'].join('\n')).md;
  assert(t.includes('Sample df:\n\n```text\n+----+-----+') && t.includes('Plain prose\nstays prose.'), 'ascii table fenced, prose kept');
  assert(t.includes('| 1 | `x\\|y` |') && t.includes('1. ```text\n   Input: n = 3\n   Output: 6\n   ```'), 'gfm table kept with code pipe escaped; list I/O fenced in its item');
  assert(!/Detailed Answer|Clarif|platform/.test(t) && t.includes('#### Setup\n\nImplement `solution(ops)` in O(1) time.'), 'empty headings, filler, grader clause, O(\\n1)');
  const p = problem({ problem_statement: 'Return the sum of nums.', constraints: ['Inputs are Python literals matching the function signature.'], examples: [{ input: [1, 2], output: 3 }] },
    'Problem', 'T', 'Return the sum of nums.\n\nExample 1:\nnums = [1, 2] -> 3', true);
  assert(p.md === '' && p.part.samples.length === 1 && !p.part.constraints.length, 'restated statement, template constraint and shown examples not repeated; samples kept');
  console.log(r.md);
}

if (process.argv.includes('--check')) selfCheck();
else {
  for (const t of TYPES) {
    const stats = { pages: 0, emitted: 0, partial: 0, skipped: {}, failures: 0 };
    const items = [];
    for (const slug of listRaw(t.dir)) {
      stats.pages++;
      try {
        const r = parsePage(readRaw(t.dir, slug), t, slug);
        if (r.skip) { stats.skipped[r.skip] = (stats.skipped[r.skip] || 0) + 1; continue; }
        items.push(r.item);
        stats.partial += r.item.partial ? 1 : 0;
      } catch (e) {
        stats.failures++;
        console.error(`[${t.dir}] ${slug}: ${e.message}`);
      }
    }
    stats.emitted = writeJsonl(t.dir, items);
    console.log(`[${t.dir}]`, JSON.stringify(stats));
  }
}
