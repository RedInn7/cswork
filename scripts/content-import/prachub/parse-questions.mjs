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
/** Split markdown into text and fenced-code segments (CommonMark fences; an unclosed fence runs to the end). */
function segments(md) {
  const out = [];
  let text = [], fence = null;
  for (const line of md.split('\n')) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence.mark[0]}{${fence.mark.length},}\\s*$`).test(line)) { out.push(fence); fence = null; } else fence.lines.push(line);
      continue;
    }
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (m && !(m[1][0] === '`' && m[2].includes('`'))) {
      out.push({ text: text.join('\n') }); text = [];
      fence = { mark: m[1], info: m[2].trim(), lines: [] };
    } else text.push(line);
  }
  if (fence) out.push(fence);
  out.push({ text: text.join('\n') });
  return out;
}
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
// Plain GFM only: CSWORK renders bodies with react-markdown + skipHtml, so <details> would drop the labels.
const quote = (label, md) => [`> **${label}**`, '>', ...md.trim().split('\n').map((l) => (l ? `> ${l}` : '>'))].join('\n');
/** Text-only fixes: the site's own math normalisation, and PracHub self-references. */
function fixText(t, demote = 0) {
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$${m.trim().replace(/\n/g, ' ')}$$\n`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => `$${m.trim().replace(/\n/g, ' ')}$`)
    .replace(/\bPracHub(?:'s|’s)?\s+(?=[a-z])/g, '') // "a deterministic PracHub practice wrapper" -> "a deterministic practice wrapper"
    .replace(/\bPracHub\b/g, 'this platform');
  return demote ? t.replace(/^#{1,6}(?=\s)/gm, (h) => '#'.repeat(Math.min(6, h.length + demote))) : t;
}
/**
 * Clean one markdown field. Locked placeholders (```premium-lock <Section>```, ```premium-lock-hint <n>```) are
 * dropped together with the heading they stand under; ```hint <title>``` blocks become "> **Hint: <title>**" quotes.
 * demote: shift headings down that many levels (the text is placed under a heading of ours).
 */
export function cleanMd(md, { demote = 0 } = {}) {
  let locked = false;
  const parts = [];
  for (const seg of segments(md || '')) {
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
      parts.push(`\n${quote(label ? `Hint: ${label}` : 'Hint', fixText(seg.lines.join('\n')))}\n`); // blank lines: no lazy continuation
    } else {
      parts.push([seg.mark + seg.info, ...seg.lines, seg.mark].join('\n'));
    }
  }
  return { md: parts.join('\n').replace(/\n{3,}/g, '\n\n').trim(), locked };
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
/** Token-set Jaccard; used to skip a console statement that only repeats the main body. */
function similar(a, b) {
  const A = words(a), B = words(b);
  let i = 0;
  for (const w of A) i += B.has(w) ? 1 : 0;
  return i / (A.size + B.size - i || 1);
}
/** One schema problem (coding or SQL) -> {part, md, locked}. The statement is omitted from md when it repeats mainMd. */
function problem(pr, heading, title, mainMd) {
  const st = cleanMd(dropTitle(dropTitle(pr.problem_statement || pr.question || '', title), pr.title), { demote: 1 });
  const constraints = (Array.isArray(pr.constraints) ? pr.constraints : []).map(String).filter((c) => c.trim());
  const samples = (pr.examples?.length ? pr.examples : pr.test_cases || []).map((e) => ({
    input: str(e.input), output: str(e.output ?? e.expected_output), explanation: e.explanation || null,
  }));
  const hints = (pr.hints || []).map((h) => fixText(String(h), false).trim()).filter(Boolean);
  const ap = pr.approach?.explanation ? pr.approach : null;
  const approach = ap && { explanation: cleanMd(ap.explanation, { demote: 3 }).md, timeComplexity: ap.time_complexity || null, spaceComplexity: ap.space_complexity || null };
  const tables = (pr.tables || []).map((t) => ({ name: t.name, columns: t.columns || [], sampleData: t.sample_data || [] }));
  const er = pr.expected_result;
  const out = [heading && `## ${heading}`, similar(st.md, mainMd) < 0.8 && st.md];
  if (constraints.length && !/^#+\s*\**constraints/im.test(st.md)) out.push(`### Constraints\n\n${list(constraints)}`);
  for (const t of tables) {
    out.push(`### Table \`${t.name}\`\n\n${mdTable(t.columns.map((c) => ({ column: c.name, type: c.type, constraints: (c.constraints || []).join(', ') })), ['column', 'type', 'constraints'])}`);
    if (t.sampleData.length) out.push(`Sample data:\n\n${mdTable(t.sampleData)}`);
  }
  if (er?.sample_output?.length || er?.description) out.push(['### Expected output', er.description, er.sample_output?.length && mdTable(er.sample_output, er.columns)].filter(Boolean).join('\n\n'));
  if (samples.length) {
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
  return { part, md: out.filter(Boolean).join('\n\n'), locked: st.locked };
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
    const r = problem(pr, probs.length > 1 ? pr.title || `Part ${i + 1}` : pr.title || 'Problem', title, main.md);
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
