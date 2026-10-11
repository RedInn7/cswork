// PracHub interview experiences -> parsed/experiences.jsonl (authorized import, public pages only).
// Source of truth is the page's RSC payload (`initialExperience`): markdown body (content_md), rounds,
// outcome, seniority and the linked practice questions. Locked experiences are counted and skipped.
// Also exports the RSC / scrub / run helpers used by parse-learning.mjs and parse-cheatsheets.mjs.
//   /opt/homebrew/bin/node scripts/content-import/prachub/parse-experiences.mjs [--self-test]
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listRaw, readRaw, sourceUrl, jsonLd, writeJsonl } from './common.mjs';

/** Next.js flight rows from the inline `self.__next_f.push([1,"..."])` scripts: id -> JSON text | {text}. */
function rscRows(html) {
  const chunks = [];
  for (const m of html.matchAll(
    /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g,
  ))
    chunks.push(JSON.parse(`"${m[1]}"`));
  const buf = Buffer.from(chunks.join(''), 'utf8');
  const rows = new Map();
  for (let i = 0; i < buf.length;) {
    const colon = buf.indexOf(':', i);
    if (colon < 0) break;
    const id = buf.toString('latin1', i, colon);
    if (buf[colon + 1] === 0x54) {
      // "T<hex UTF-8 byte length>,<text>": length-prefixed, the next row follows without a newline.
      const comma = buf.indexOf(',', colon);
      const end =
        comma + 1 + parseInt(buf.toString('latin1', colon + 2, comma), 16);
      rows.set(id, { text: buf.toString('utf8', comma + 1, end) });
      i = end;
    } else {
      const nl = buf.indexOf('\n', colon);
      const end = nl < 0 ? buf.length : nl;
      rows.set(id, buf.toString('utf8', colon + 1, end));
      i = end + 1;
    }
  }
  return rows;
}

/** Props of every client component ("$L…" element) in the RSC payload, "$<id>" row references resolved. */
export function rscProps(html) {
  const rows = rscRows(html);
  const cache = new Map();
  const row = (id) => {
    if (!cache.has(id)) {
      const r = rows.get(id);
      let v = null;
      if (typeof r === 'object') v = r.text;
      else {
        try {
          v = JSON.parse(r);
        } catch {
          // I[...] / HL[...] module rows are not JSON.
        }
      }
      cache.set(id, v);
    }
    return cache.get(id);
  };
  const resolve = (v, depth = 0) => {
    if (depth > 64) return v;
    if (typeof v === 'string') {
      if (v === '$undefined') return null;
      if (v.startsWith('$$')) return v.slice(1);
      const ref = /^\$@?([0-9a-f]+)$/.exec(v);
      return ref && rows.has(ref[1]) ? resolve(row(ref[1]), depth + 1) : v;
    }
    if (Array.isArray(v)) return v.map((x) => resolve(x, depth + 1));
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, resolve(x, depth + 1)]),
      );
    return v;
  };
  const props = [];
  const walk = (v) => {
    if (Array.isArray(v)) {
      if (
        v[0] === '$' &&
        typeof v[1] === 'string' &&
        v[1].startsWith('$L') &&
        v[3] &&
        typeof v[3] === 'object'
      )
        props.push(resolve(v[3]));
      v.forEach(walk);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const [id, r] of rows) if (typeof r === 'string') walk(row(id));
  return props;
}

/** PracHub lock flags seen in payloads (experiences, guides, course sections). */
export const isLocked = (o) =>
  !!o &&
  (o.locked === true ||
    o.is_locked === true ||
    o.section_lock === true ||
    o.can_access === false ||
    o.is_free === false);

const MD_KEY =
  /^(?:content(?:_md|_markdown|_enhanced)?|markdown|body(?:_md)?)$/;
/** Longest markdown-looking string field directly on `o` ('' when none). */
export const markdownOf = (o) =>
  Object.entries(o ?? {}).reduce(
    (best, [k, v]) =>
      MD_KEY.test(k) && typeof v === 'string' && v.length > best.length
        ? v
        : best,
    '',
  );

/** UTC ISO timestamp (naive PracHub timestamps are UTC, like the sibling parsers assume); else null. */
export function iso(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(/T[\d:.]+$/.test(v) ? `${v}Z` : v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
export const companyOf = (v, slug) => {
  const name = typeof v === 'string' ? v : (v?.name ?? null);
  return name ? { slug: slug ?? v?.slug ?? slugify(name), name } : null;
};

/** Relations deduped by kind+slug, first occurrence wins. */
export function uniqRelations(rs) {
  const seen = new Set();
  return rs.filter(
    (r) => !seen.has(`${r.kind}:${r.slug}`) && seen.add(`${r.kind}:${r.slug}`),
  );
}

const LINK_KIND = {
  concepts: 'concept',
  'interview-questions': 'question',
  'coding-questions': 'question',
  'interview-experiences': 'experience',
  'interview-guide': 'guide',
  learning: 'course',
};
/** Relations for site-internal Markdown links ([text](/type/slug), /learning/<course>/<lesson> -> lesson). */
export function linksIn(md) {
  const out = [];
  for (const m of md.matchAll(
    /\]\(\/([a-z-]+)\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?\/?(?=[)#?\s])/g,
  )) {
    const lesson = m[1] === 'learning' && m[3];
    if (LINK_KIND[m[1]])
      out.push({
        kind: lesson ? 'lesson' : LINK_KIND[m[1]],
        slug: lesson ? `${m[2]}__${m[3]}` : m[2],
      });
  }
  return uniqRelations(out);
}

/** Compact key/type outline of a payload, printed when a page doesn't have the expected shape. */
export function shape(v, depth = 3) {
  if (Array.isArray(v))
    return v.length && depth
      ? [shape(v[0], depth - 1), `x${v.length}`]
      : `array(${v.length})`;
  if (v && typeof v === 'object')
    return depth
      ? Object.fromEntries(
          Object.entries(v).map(([k, x]) => [k, shape(x, depth - 1)]),
        )
      : 'object';
  return typeof v === 'string' && v.length > 40 ? `string(${v.length})` : v;
}

export const scrubStats = { lines: 0 };
// PracHub's promo sentence template, also seen without the name ("…on a platform built around…").
const PROMO = /prachub|\bpracti[cs]ed something (?:very )?similar on\b/i;
/** Strip PracHub branding/CTAs from Markdown: prachub.com link/src targets become site-relative; sentences
 *  naming PracHub (bare URLs included) or in its promo template are dropped, as are lines linking to
 *  pricing/login/register. Fenced code is left untouched. */
export function scrub(md) {
  if (typeof md !== 'string') return '';
  const cta = /\]\(\/(?:pricing|login|register)\b/i;
  // A "sentence" runs to a . ! ? that is followed by whitespace, so URLs and "e.g." stay inside it. It starts
  // at a non-space, so the neighbours keep their spacing and a list item its number ("5. ").
  const s = String.raw`(?:[^.!?\n]|[.!?](?=\S))`;
  // "Transactions: a new question, with detailed coverage on PracHub." loses only the PracHub clause.
  const clause = new RegExp(
    String.raw`,\s*with\b${s}*?prachub${s}*?(?=[.!?](?:\s|$))`,
    'gi',
  );
  // A dropped promo takes along a sentence that only points back at it ("That familiarity gave me…") and
  // the "Even so, " opening the next one.
  const sentence = new RegExp(
    String.raw`(?=\S)${s}*(?:${PROMO.source})${s}*[.!?]*\s*(?:That familiarity\b${s}*[.!?]*\s*)?(?:Even so, (\w))?`,
    'gi',
  );
  const out = [];
  let fence = false,
    dropped = 0;
  for (const line of md
    .replace(
      /(\]\(\s*<?|\b(?:src|href)=["'])https?:\/\/(?:www\.)?prachub\.com(?=\/)/gi,
      '$1',
    )
    .split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) fence = !fence;
    if (fence || !(PROMO.test(line) || cta.test(line))) {
      out.push(line);
      continue;
    }
    dropped++;
    const kept = cta.test(line)
      ? ''
      : line
          .replace(clause, '')
          .replace(sentence, (_, next) => next?.toUpperCase() ?? '');
    if (/[a-z0-9]/i.test(kept.replace(/^\s*(?:[-*+>]|#+|\d+[.)])\s*/, '')))
      out.push(kept.trimEnd());
  }
  scrubStats.lines += dropped;
  const text = out.join('\n');
  return (dropped ? text.replace(/\n{3,}/g, '\n\n') : text).replace(
    /^\s*\n|\s+$/g,
    '',
  );
}

/** Single newlines inside top-level paragraphs -> Markdown hard breaks ("  " line ends): the source page
 *  shows them as line breaks, react-markdown joins the lines. Code (fenced, indented, `inline`), lists,
 *  headings, tables, blockquotes and blank-line breaks are left alone (CommonMark/GFM block rules). */
function hardBreaks(md) {
  const lines = md.split('\n');
  const indent = (l) => l.length - l.trimStart().length;
  const fenceOf = (l) => /^\s*(`{3,}|~{3,})/.exec(l)?.[1] ?? null;
  // List item -> column its content starts at.
  const itemAt = (l) => {
    const m = /^( {0,3}(?:[-*+]|\d{1,9}[.)]))([ \t]+|$)/.exec(l);
    return m && m[1].length + (m[2].length > 4 || !m[2] ? 1 : m[2].length);
  };
  const leaf = /^ {0,3}(?:#{1,6}(?:[ \t]|$)|([-*_])(?:[ \t]*\1){2,}[ \t]*$)/; // heading, rule
  // A table starts at a row with a pipe followed by a |---|---| delimiter row.
  const tableAt = (i) =>
    lines[i].includes('|') &&
    /\|/.test(lines[i + 1] ?? '') &&
    /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/.test(
      lines[i + 1],
    );
  // Lines that end a paragraph rather than continue it: only "1." starts a list there, "2." is text.
  const ends = (i) =>
    leaf.test(lines[i]) ||
    /^ {0,3}(?:>|```|~~~|[-*+][ \t]+\S|1[.)][ \t]+\S)/.test(lines[i]) ||
    tableAt(i);
  let ctx = null, // 'para' | 'list' | 'quote' | 'table' | 'code' (indented)
    offset = 0, // content column of the current top-level list item
    gap = false, // blank line since the last list line
    fence = null,
    para = [];
  const flush = (heading) => {
    // A paragraph underlined with === / --- is a heading; a newline inside a `code span` is code.
    if (!heading && para.length > 1) {
      const text = para.map((i) => lines[i]).join('\n');
      const code = [
        ...text.matchAll(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g),
      ].map((m) => [m.index, m.index + m[0].length]);
      let at = 0;
      for (const i of para.slice(0, -1)) {
        at += lines[i].length;
        if (
          !code.some(([a, b]) => a < at && at < b) &&
          !/ {2}$|\\$/.test(lines[i])
        )
          lines[i] = `${lines[i].trimEnd()}  `;
        at++;
      }
    }
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (fence) {
      if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(l))
        fence = null;
      continue;
    }
    if (!l.trim()) {
      flush();
      gap = true;
      if (ctx !== 'list' && ctx !== 'code') ctx = null;
      continue;
    }
    const item = itemAt(l);
    if (ctx === 'para') {
      if (/^ {0,3}(?:=+|-+)[ \t]*$/.test(l)) {
        flush(true);
        ctx = null;
        continue;
      }
      if (!ends(i)) {
        para.push(i);
        continue;
      }
      flush();
    } else if (ctx === 'code' && indent(l) >= 4) continue;
    // Items, indented lines and lazy text (no blank line before) stay in the list.
    else if (
      ctx === 'list' &&
      (item || indent(l) >= offset || (!gap && !ends(i)))
    ) {
      if (item && indent(l) < offset) offset = item;
      fence = fenceOf(l);
      gap = false;
      continue;
    } else if (ctx === 'quote' && (/^ {0,3}>/.test(l) || !ends(i))) continue;
    else if (ctx === 'table' && !ends(i)) continue;
    // A new block.
    gap = false;
    fence = indent(l) < 4 ? fenceOf(l) : null;
    if (item) offset = item;
    ctx =
      indent(l) >= 4
        ? 'code'
        : fence || leaf.test(l)
          ? null
          : item
            ? 'list'
            : /^ {0,3}>/.test(l)
              ? 'quote'
              : tableAt(i)
                ? 'table'
                : 'para';
    if (ctx === 'para') para = [i];
  }
  flush();
  return lines.join('\n');
}

/** Parse the raw pages of `type` with fn(slug, html) -> item | 'locked' | 'duplicate'; failures are counted. */
export function run(label, type, fn, slugs = listRaw(type)) {
  const items = [];
  const stats = {
    pages: 0,
    emitted: 0,
    partial: 0,
    locked: 0,
    duplicate: 0,
    failed: 0,
  };
  let shown = false;
  for (const slug of slugs) {
    if (slug === '_index') continue; // listing page, not content
    stats.pages++;
    try {
      const r = fn(slug, readRaw(type, slug));
      if (typeof r === 'string') stats[r]++;
      else {
        items.push(r);
        stats.emitted++;
        if (r.partial) stats.partial++;
      }
    } catch (e) {
      if (++stats.failed <= 20)
        console.error(`[${label}] FAIL ${slug}: ${e.message}`);
      if (e.detail && !shown) {
        shown = true;
        console.error(
          `[${label}] payload shape: ${JSON.stringify(e.detail).slice(0, 3000)}`,
        );
      }
    }
  }
  return { items, stats };
}

/** Write <name>.jsonl (skipped when the type has no raw pages yet) and print the counts. */
export function save(name, { items, stats }) {
  if (stats.pages) writeJsonl(name, items);
  console.log(
    `[${name}] ${JSON.stringify(stats)}${stats.pages ? '' : ' (no raw pages yet, nothing written)'}`,
  );
}

export const isMain = (url) =>
  !!process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(url);

const TYPE = 'interview-experiences';
const OUTCOME = {
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'No response', // the page's wording
  no_response: 'No response',
  in_progress: 'In progress',
  unknown: null,
};
const DIFFICULTY = new Set(['easy', 'medium', 'hard']);
const tally = { lock_type: {}, outcome: {}, seniority: {} }; // printed so reruns can check the mappings

function parseExperience(slug, html) {
  const props = rscProps(html);
  const exp = props.find((p) => p.initialExperience)?.initialExperience;
  if (!exp)
    throw Object.assign(new Error('no initialExperience in RSC payload'), {
      detail: shape(props),
    });
  for (const k in tally) tally[k][exp[k]] = (tally[k][exp[k]] ?? 0) + 1;
  const ld = jsonLd(html);
  const post = ld.find((o) => o['@type'] === 'BlogPosting');
  if (exp.locked === true || post?.isAccessibleForFree === false)
    return 'locked';
  const body = hardBreaks(scrub(exp.content_md));
  if (!body) throw new Error('empty content_md');
  // content_preview is the body's opening as plain text. A promo sentence it cuts short ("I had practiced
  // somethi…") is beyond scrub(): a cut-off last sentence the debranded body doesn't have goes too.
  const flat = (s) =>
    s
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .toLowerCase();
  let summary = scrub(exp.content_preview);
  if (PROMO.test(exp.content_md))
    summary = summary
      .replace(/(?<=^|[.!?]\s+)[^.!?]+…$/, (cut) =>
        flat(body).includes(flat(cut)) ? cut : '',
      )
      .trimEnd();
  const companyUrl = ld
    .find((o) => o['@type'] === 'BreadcrumbList')
    ?.itemListElement?.map((e) => e.item)
    .find((u) => /\/companies\/[^/]+$/.test(u ?? ''));
  const outcome = String(exp.outcome ?? 'unknown');
  const difficulty = String(exp.difficulty ?? '').toLowerCase();
  // "General" is the payload's "no level given"; the page shows no Level for it.
  const level = exp.seniority === 'General' ? null : (exp.seniority ?? null);
  // "Practice the questions from this interview" (linked_posts) plus any internal links in the body.
  const linked = (exp.linked_posts ?? [])
    .filter((p) => p?.slug)
    .map((p) => ({
      kind: 'question',
      slug: p.slug,
      title: p.title ?? undefined,
    }));
  return {
    id: `ex-${slug}`,
    type: 'experience',
    slug,
    title: exp.title ?? null,
    summary: summary || null,
    body,
    // The company the page shows (JSON-LD `about`, "Interview at a glance"), e.g. "Amazon India (ADCI)" for
    // the payload's "ADCI - Karnataka": the payload's aliases would split one company into several.
    company: companyOf(
      post?.about?.name ?? exp.company,
      companyUrl?.split('/companies/')[1],
    ),
    role: exp.position ?? null,
    category: null,
    round: exp.interview_round ?? exp.rounds?.[0] ?? null,
    seniority: level,
    difficulty: DIFFICULTY.has(difficulty) ? difficulty : null,
    tags: [],
    publishedAt: iso(exp.published_at),
    updatedAt: iso(exp.updated_at),
    relations: uniqRelations([...linked, ...linksIn(body)]),
    extra: {
      result: Object.hasOwn(OUTCOME, outcome)
        ? OUTCOME[outcome]
        : outcome.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
      rounds: exp.rounds ?? [],
      level,
      // The page's date ("Reported Jul 2026", "Interview date Aug 2026") is reported_at's month.
      date: exp.reported_at ?? null,
      dateBasis: exp.date_basis ?? null,
    },
    sourceUrl: sourceUrl(TYPE, slug),
    partial: false,
  };
}

function selfTest() {
  const md =
    'One\ntwo `co\nde`\nthree\n\n- item\n  more\n\n```\na\nb\n```\nHead\nline\n---';
  assert.equal(
    hardBreaks(md),
    md.replace('One', 'One  ').replace('de`', 'de`  '),
  );
  assert.equal(
    scrub('5. Sets: new, with detailed coverage on PracHub. Hard.'),
    '5. Sets: new. Hard.',
  );
  assert.equal(
    scrub(
      'A b. Then I had practiced something very similar on prachub.com. That familiarity helped. C d.',
    ),
    'A b. C d.',
  );
  assert.equal(
    scrub(
      'I had practiced something similar on a platform, so I was ready. Even so, it was hard.',
    ),
    'It was hard.',
  );
  console.log('self-test ok');
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === '--self-test') selfTest();
  else {
    save('experiences', run('experiences', TYPE, parseExperience));
    console.log(
      `[experiences] values ${JSON.stringify(tally)}; scrubbed ${scrubStats.lines} branding/CTA lines`,
    );
  }
}
