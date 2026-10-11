// Knowledge Hub articles (/resources/<slug>) -> parsed/articles.jsonl (type 'article', id ar-<slug>).
//   node scripts/content-import/prachub/parse-articles.mjs                  all raw/resources pages
//   node scripts/content-import/prachub/parse-articles.mjs --files a.html   dry run on local pages (.html/.html.gz)
//   node scripts/content-import/prachub/parse-articles.mjs --self-test
// This file also exports the page helpers shared with parse-guides.mjs and parse-concepts.mjs
// (the task allows only the three parser files); the article run only starts when executed directly.
import assert from 'node:assert/strict';
import { readFileSync, realpathSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listRaw, readRaw, sourceUrl, seoArticle, jsonLd, meta, writeJsonl } from './common.mjs';

// ---------------------------------------------------------------- Next.js flight payload

/** RSC rows from the inline self.__next_f pushes: id -> {text} (T rows) | {json} (parsed lazily). */
export function flight(html) {
  let s = '';
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) s += JSON.parse(`"${m[1]}"`);
  const buf = Buffer.from(s, 'utf8');
  const rows = new Map();
  for (let i = 0; i < buf.length; ) {
    const colon = buf.indexOf(0x3a, i);
    if (colon < 0) break;
    const id = buf.toString('latin1', i, colon);
    const hex = /^[0-9a-f]+$/.test(id);
    if (hex && buf[colon + 1] === 0x54) {
      // "<id>:T<utf-8 byte length in hex>,<text>" and the next row follows without a newline.
      const comma = buf.indexOf(0x2c, colon);
      const end = comma + 1 + parseInt(buf.toString('latin1', colon + 2, comma), 16);
      rows.set(id, { text: buf.toString('utf8', comma + 1, end) });
      i = end;
      continue;
    }
    let end = buf.indexOf(0x0a, colon);
    if (end < 0) end = buf.length;
    if (hex) rows.set(id, { json: buf.toString('utf8', colon + 1, end) });
    i = end + 1;
  }
  return rows;
}

function rowValue(rows, id) {
  const row = rows.get(id);
  if (!row) return undefined;
  if ('text' in row) return row.text;
  if (!('value' in row)) {
    try {
      row.value = JSON.parse(row.json);
    } catch {
      row.value = undefined; // module/hint rows ("I[...]", "HL[...]") are not data
    }
  }
  return row.value;
}

/** Resolve "$<row>[:path]" references, "$undefined" and "$$" escapes inside a flight value. */
export function resolve(rows, v, depth = 0) {
  if (depth > 60) return null;
  if (typeof v === 'string') {
    if (v[0] !== '$') return v;
    if (v === '$undefined') return null;
    if (v[1] === '$') return v.slice(1);
    if (v[1] === 'D') return v.slice(2);
    const m = /^\$([0-9a-f]+)((?::[^:]+)*)$/.exec(v);
    if (!m) return v; // component / promise / symbol references carry no content
    let x = rowValue(rows, m[1]);
    for (const k of m[2].split(':').slice(1)) x = Array.isArray(x) && x[0] === '$' && k === 'props' ? x[3] : x?.[k];
    return resolve(rows, x, depth + 1);
  }
  if (Array.isArray(v)) return v.map((x) => resolve(rows, x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(rows, x, depth + 1)]));
  return v;
}

function walk(v, fn) {
  if (!v || typeof v !== 'object') return;
  if (!Array.isArray(v)) fn(v);
  for (const x of Object.values(v)) walk(x, fn);
}

/** The resolved object that carries `key`, e.g. the client props holding 'initialGuide'. */
export function flightOwner(rows, key) {
  for (const [id, row] of rows) {
    if (!row.json?.includes(`"${key}":`)) continue;
    let hit = null;
    walk(rowValue(rows, id), (o) => { if (!hit && key in o) hit = o; });
    if (hit) return resolve(rows, hit);
  }
  return null;
}

/** The richest object whose slug is the page slug (the page entity when its prop name is unknown). */
export function flightEntity(rows, slug) {
  let best = null;
  for (const [id, row] of rows) {
    if (!row.json?.includes(`"slug":${JSON.stringify(slug)}`)) continue;
    walk(rowValue(rows, id), (o) => {
      if (o.slug === slug && (!best || Object.keys(o).length > Object.keys(best).length)) best = o;
    });
  }
  return best && resolve(rows, best);
}

// Payload fields that hold a page body as Markdown (guide/resource: content, experience: content_md, question: content_enhanced).
const BODY_FIELDS = ['content', 'content_md', 'content_enhanced', 'content_markdown', 'markdown', 'body'];

// ---------------------------------------------------------------- HTML -> Markdown

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const unescapeHtml = (s) =>
  s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, d, x, n) =>
    d ? String.fromCodePoint(+d) : x ? String.fromCodePoint(parseInt(x, 16)) : NAMED[n.toLowerCase()] ?? m);

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Site chrome and widgets never belong to a body.
const DROP = new Set(['button', 'nav', 'form', 'input', 'select', 'textarea', 'iframe', 'canvas', 'video', 'audio',
  'dialog', 'header', 'footer', 'aside', 'head', 'title', 'meta', 'link']);
const BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'body', 'caption', 'dd', 'details', 'div', 'dl', 'dt',
  'fieldset', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'html', 'li', 'main', 'ol', 'p', 'pre',
  'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul']);
const LOCKED = /\b(?:unlock (?:the|this|every|all|full)|upgrade to premium|premium (?:section|content|feature|members?)|is a premium feature|sign (?:up|in) to (?:read|view|unlock|see)|create a free account to)\b/i;

/** Tolerant tree for React SSR markup: {tag, attrs, kids}; text nodes are unescaped strings. */
export function parseHtml(html) {
  const root = { tag: '#root', attrs: '', kids: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<(script|style|svg|template|noscript)\b[\s\S]*?<\/\1\s*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) top.kids.push(unescapeHtml(m[5]));
    else if (m[3]) {
      const el = { tag: m[3].toLowerCase(), attrs: m[4], kids: [] };
      top.kids.push(el);
      if (!VOID.has(el.tag) && !m[4].endsWith('/')) stack.push(el);
    } else if (m[2]) {
      const at = stack.findLastIndex((e) => e.tag === m[2].toLowerCase());
      if (at > 0) stack.length = at;
    }
  }
  return root;
}

export const attr = (el, name) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(el.attrs);
  return m ? unescapeHtml(m[1]) : null;
};
const hidden = (el) => /(?:^|\s)aria-hidden="true"/.test(el.attrs) || /(?:^|\s)class="(?:[^"]*\s)?sr-only[\s"]/.test(el.attrs);

/** Outermost visible descendants matching pred (hidden / sr-only subtrees are skipped). */
export function findAll(node, pred, out = []) {
  for (const k of node.kids) {
    if (typeof k === 'string' || hidden(k)) continue;
    if (pred(k)) out.push(k);
    else findAll(k, pred, out);
  }
  return out;
}
export const textOf = (n) => (typeof n === 'string' ? n : n.tag === 'br' ? '\n' : n.kids.map(textOf).join(''));
export const squash = (s) => s.replace(/\s+/g, ' ').trim();

/** GitHub-flavoured Markdown for a parsed subtree; `locked` counts dropped premium placeholders. */
export function toMarkdown(root) {
  let locked = 0;
  // Escape only what could start Markdown syntax: lone "*" between spaces, "[x]" text and "a < b" stay literal.
  const esc = (s) => s.replace(/[\\`]|\*(?!\s)|(?<!\s)\*|\](?=[([:])|<(?=[a-zA-Z/!?])/g, '\\$&')
    .replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '\\_');
  const skip = (k) => DROP.has(k.tag) || hidden(k);
  const wrap = (mark, t) => (t.trim() ? `${/^\s/.test(t) ? ' ' : ''}${mark}${t.trim()}${mark}${/\s$/.test(t) ? ' ' : ''}` : t);
  const code = (t) => {
    const ticks = '`'.repeat(Math.max(0, ...(t.match(/`+/g) || []).map((x) => x.length)) + 1);
    return t ? `${ticks}${/^`|`$/.test(t) ? ` ${t} ` : t}${ticks}` : '';
  };
  const img = (k) => {
    let src = attr(k, 'src') || '';
    const next = /^\/_next\/image\?(.*)$/.exec(src);
    if (next) src = new URLSearchParams(next[1]).get('url') || src;
    if (!src || src.startsWith('data:') || src.includes('google.com/s2/favicons')) return '';
    return `![${(attr(k, 'alt') || '').replace(/[[\]]/g, '')}](${src.replace(/ /g, '%20')})`;
  };
  const inline = (k) => {
    if (typeof k === 'string') return esc(k);
    if (skip(k)) return '';
    const inner = () => k.kids.map(inline).join('');
    switch (k.tag) {
      case 'br': return '\uE000';
      case 'img': return img(k);
      case 'code': case 'kbd': case 'samp': return code(textOf(k));
      case 'strong': case 'b': return wrap('**', inner());
      case 'em': case 'i': return wrap('*', inner());
      case 'del': case 's': return wrap('~~', inner());
      case 'a': {
        const href = attr(k, 'href') || '';
        const t = inner().trim();
        return !t ? '' : !href || href.startsWith('#') || href.startsWith('javascript:') ? t : `[${t}](${href.replace(/ /g, '%20')})`;
      }
      default: return inner();
    }
  };
  // <br> becomes a hard break, except at the edges of a block where Markdown would show a stray backslash.
  const breaks = (t) => squash(t).replace(/^(?:\uE000 ?)+|(?: ?\uE000)+$/g, '').replace(/ ?\uE000 ?/g, '\\\n');
  const line = (k) => breaks(k.kids.map(inline).join(''));
  const blocks = (node, out = []) => {
    let run = '';
    const flush = () => {
      const t = breaks(run);
      if (t) out.push(/^(?:>|[#+-](?:\s|$)|\d+[.)](?:\s|$))/.test(t) ? `\\${t}` : t);
      run = '';
    };
    for (const k of node.kids) {
      if (typeof k === 'string') {
        // Text with blank lines is raw Markdown / pre-wrap text (crawler copies): keep it verbatim.
        if (/\S/.test(k) && /\n[ \t]*\n/.test(k.trim())) {
          flush();
          out.push(k.trim());
        } else run += esc(k);
      } else if (skip(k)) continue;
      else if (!BLOCK.has(k.tag)) run += inline(k);
      else {
        flush();
        block(k, out);
      }
    }
    flush();
    return out;
  };
  const list = (k, out) => {
    const items = k.kids.filter((c) => typeof c !== 'string' && c.tag === 'li' && !skip(c));
    const toc = (li) => { const a = findAll(li, (n) => n.tag === 'a'); return a.length === 1 && (attr(a[0], 'href') || '').startsWith('#'); };
    if (!items.length || items.every(toc)) return; // in-page table of contents
    let n = Number(attr(k, 'start')) || 1;
    out.push(items.map((li) => {
      const marker = k.tag === 'ol' ? `${n++}. ` : '- ';
      const body = blocks(li).reduce((acc, b) => (acc ? acc + (/^(?:- |\d+\. )/.test(b) ? '\n' : '\n\n') + b : b), '');
      return marker + body.replace(/\n/g, `\n${' '.repeat(marker.length)}`).replace(/\n +\n/g, '\n\n');
    }).join('\n'));
  };
  const table = (k, out) => {
    const rows = findAll(k, (n) => n.tag === 'tr').map((tr) =>
      tr.kids.filter((c) => typeof c !== 'string' && (c.tag === 'th' || c.tag === 'td')).map((c) => line(c).replace(/\\\n/g, ' ').replace(/\|/g, '\\|')));
    if (!rows.length) return;
    const w = Math.max(...rows.map((r) => r.length));
    const row = (r) => `| ${Array.from({ length: w }, (_, i) => r[i] ?? '').join(' | ')} |`;
    out.push([row(rows[0]), `|${' --- |'.repeat(w)}`, ...rows.slice(1).map(row)].join('\n'));
  };
  const block = (k, out) => {
    const t = k.tag;
    if (/^h[1-6]$/.test(t)) { const s = line(k); if (s) out.push(`${'#'.repeat(+t[1])} ${s}`); return; }
    if (t === 'hr') {
      out.push('---');
      return;
    }
    if (t === 'pre') {
      const body = textOf(k).replace(/\n$/, '');
      const lang = /language-([\w+#-]+)/.exec(k.attrs + (findAll(k, (n) => n.tag === 'code')[0]?.attrs || ''))?.[1] || '';
      const fence = '`'.repeat(Math.max(3, ...(body.match(/`+/g) || []).map((x) => x.length + 1)));
      if (body.trim()) out.push(`${fence}${lang}\n${body}\n${fence}`);
      return;
    }
    if (t === 'ul' || t === 'ol') {
      list(k, out);
      return;
    }
    if (t === 'table') {
      table(k, out);
      return;
    }
    if (t === 'blockquote') { const b = blocks(k); if (b.length) out.push(b.join('\n\n').replace(/^/gm, '> ')); return; }
    if (t === 'dl') {
      const pairs = [];
      for (const n of findAll(k, (x) => x.tag === 'dt' || x.tag === 'dd'))
        if (n.tag === 'dt') pairs.push([line(n), []]);
        else if (pairs.length) pairs[pairs.length - 1][1].push(line(n));
      if (pairs.length) out.push(pairs.map(([dt, dd]) => `- **${dt}:** ${dd.join('; ')}`).join('\n'));
      return;
    }
    if (t === 'figcaption') { const s = line(k); if (s) out.push(`*${s}*`); return; }
    const text = textOf(k);
    if (text.length < 600 && LOCKED.test(text)) { locked++; return; }
    blocks(k, out);
  };
  const md = blocks(root).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { md, locked };
}

/**
 * Body root when no payload Markdown is usable: the biggest visible article (unless it is only a card
 * inside a much bigger main), else main, else the hidden crawler copy (data-seo-content), else body.
 */
export function contentRoot(html, doc = parseHtml(html)) {
  const size = (n) => textOf(n).length;
  const article = findAll(doc, (n) => n.tag === 'article').sort((a, b) => size(b) - size(a))[0];
  const main = findAll(doc, (n) => n.tag === 'main')[0];
  if (article && (!main || size(article) >= 0.3 * size(main))) return article;
  if (main) return main;
  const seo = seoArticle(html);
  return seo ? parseHtml(seo.html) : findAll(doc, (n) => n.tag === 'body')[0] || doc;
}

const words = (s) => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
const grams = (w, n = 4) => w.slice(n - 1).map((_, i) => w.slice(i, i + n).join(' '));
export const pageText = (html) => unescapeHtml(html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' '));

/** True when the rendered page (word 4-grams in `seen`) shows the start and the end of `md` (8+ words). */
export function visibleIn(md, seen) {
  const g = grams(words(md.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\]\([^)]*\)/g, ']').replace(/^(`{3,}|~{3,}).*$/gm, ' ')));
  const ok = (part) => part.filter((x) => seen.has(x)).length >= 0.8 * part.length;
  return g.length >= 5 && ok(g.slice(0, 30)) && ok(g.slice(-30));
}

/**
 * Public body: the longest payload Markdown field whose start and end the page visibly renders,
 * else Markdown of the rendered HTML (`root`, default contentRoot). A payload body the page does
 * not fully show is gated, so the item is then partial.
 */
export function publicBody(html, entity, root) {
  const fields = BODY_FIELDS.map((k) => entity?.[k]).filter((v) => typeof v === 'string' && v.trim());
  if (fields.length) {
    const seen = new Set(grams(words(pageText(html))));
    const best = fields.filter((v) => visibleIn(v, seen)).sort((a, b) => b.length - a.length)[0];
    if (best) return { md: best.trim(), partial: false, source: 'payload' };
  }
  if (root === undefined) root = contentRoot(html);
  const { md, locked } = root ? toMarkdown(root) : { md: '', locked: 0 };
  return { md, partial: locked > 0 || fields.length > 0, source: 'html' };
}

/** Drop `## Heading` sections (up to the next heading of the same or a higher level) whose title matches. */
export function dropSections(md, re) {
  let cut = 0;
  let fence = false;
  return md.split('\n').filter((l) => {
    if (/^(`{3,}|~{3,})/.test(l)) fence = !fence;
    const h = !fence && /^(#{1,6})\s+(.*)$/.exec(l);
    if (h && cut && h[1].length <= cut) cut = 0;
    if (h && !cut && re.test(h[2].replace(/[*_`\\]/g, '').trim())) cut = h[1].length;
    return !cut;
  }).join('\n').trim();
}

// Label lines that SEO copies / page headers put above the content ("Author: …", "Updated Oct 9, 2026").
const LEAD_LABEL = /^\\?(?:(?:company|role|category|difficulty|interview round|round|seniority|topics|tags|author|published|updated|last updated|language|reading time|asked of)\s*:[^\n]{0,200}|(?:last updated|updated|asked of|interview concept)\b[^\n]{0,60})$/i;
/** Drop the page lead-in: a heading that repeats the title (or a prefix of it) and label lines before the content. */
export function dropLeadIn(md, title) {
  const blocks = md.split(/\n{2,}/);
  const t = ` ${words(title).join(' ')} `;
  const isTitle = (b) => /^#{1,6}\s/.test(b) && !b.includes('\n') && t.startsWith(` ${words(b).join(' ')} `);
  let i = 0;
  while (i < blocks.length && (LEAD_LABEL.test(blocks[i]) || isTitle(blocks[i]))) i++;
  return blocks.slice(i).join('\n\n');
}

// ---------------------------------------------------------------- branding, links, metadata

const BRAND = /prachub/i;
const CTA_LINK = /\]\((?:\/(?:pricing|login|register|signup|mcp|daily-quest)\b|https?:\/\/(?:discord\.gg|discord\.com\/invite)\/)/i;
const CTA_WORDS = /\b(?:premium|sign(?:ing)? ?up|subscribe|upgrade|unlock|free trial|join)\b/i;

/** Inline de-branding: PracHub URLs become site paths, brand words are dropped with minimal edits. */
export function debrandText(s) {
  if (!s || !BRAND.test(s)) return s;
  return s
    .replace(/https?:\/\/(?:www\.)?prachub\.com(\/[^\s)\]"'<>]*)?/gi, (_, p) => p || '/')
    .replace(/\s+by PracHub(?:\.com)?\b/gi, '')
    .replace(/\b(?:on|at|from|via|with|using|in) PracHub(?:\.com)?\b/gi, 'here')
    .replace(/\bPracHub(?:\.com)?['’]s\b/gi, 'our')
    .replace(/(^|[ \t])PracHub(?:\.com)?\b(?:[ \t](?=\S))?/gim, '$1')
    .replace(/\bPracHub(?:\.com)?\b/gi, '');
}

/** Body de-branding: drop CTA blocks, de-brand the rest; fenced code is left untouched. */
export function debrand(md) {
  if (!BRAND.test(md) && !CTA_LINK.test(md)) return { md, changed: false };
  let out = '';
  let last = 0;
  const prose = (t) => t.split(/\n{2,}/).filter((b) => !(CTA_LINK.test(b) || (BRAND.test(b) && CTA_WORDS.test(b)))).map(debrandText).join('\n\n');
  for (const m of md.matchAll(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm)) {
    out += prose(md.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  out = (out + prose(md.slice(last))).replace(/\n{3,}/g, '\n\n').trim();
  return { md: out, changed: out !== md.trim() };
}

const LINK_KIND = { 'coding-questions': 'question', 'interview-questions': 'question', 'interview-experiences': 'experience',
  'interview-guide': 'guide', concepts: 'concept' };
/** Relations for site links in a (de-branded) body: /concepts/x, /coding-questions/x, /learning/c/l ... */
export function linkRelations(md) {
  const out = [];
  for (const m of md.matchAll(/\]\(\/(coding-questions|interview-questions|interview-experiences|interview-guide|concepts|learning)\/([^)\s?#]+)/g)) {
    const [a, b] = m[2].split('/');
    if (m[1] !== 'learning') out.push({ kind: LINK_KIND[m[1]], slug: a });
    else out.push(b ? { kind: 'lesson', slug: `${a}__${b}` } : { kind: 'course', slug: a });
  }
  return out;
}
/** Relations for visible <a href> links of the given kinds in a parsed page (site header/footer skipped). */
export function anchorRelations(doc, kinds) {
  const out = [];
  for (const a of findAll(doc, (n) => ['a', 'header', 'footer'].includes(n.tag)).filter((n) => n.tag === 'a')) {
    const m = /^(?:https?:\/\/(?:www\.)?prachub\.com)?\/(coding-questions|interview-questions|interview-experiences|interview-guide|concepts)\/([^/?#]+)/.exec(attr(a, 'href') || '');
    const kind = m && LINK_KIND[m[1]];
    if (kind && kinds.includes(kind)) out.push({ kind, slug: m[2], title: squash(textOf(a)) || undefined });
  }
  return out;
}
export function dedupeRelations(list, self) {
  const seen = new Set(self ? [`${self.kind}:${self.slug}`] : []);
  return list.filter((r) => r?.kind && r.slug && !seen.has(`${r.kind}:${r.slug}`) && seen.add(`${r.kind}:${r.slug}`))
    .map(({ kind, slug, title }) => (title ? { kind, slug, title } : { kind, slug }));
}

/** ISO timestamp for ISO-like inputs (naive times are UTC, as the JSON-LD shows); anything else -> null. */
export function iso(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? `${s}Z` : s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
export const slugify = (s) =>
  s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const metaAll = (html, name) =>
  [...html.matchAll(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, 'g'))].map((m) => unescapeHtml(m[1]));
export const cleanTitle = (s) => squash(s.replace(/\s*[|·]\s*PracHub\b.*$/i, ''));
/** Trimmed non-empty string or null (payload fields are sometimes objects or empty). */
export const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
export const companyOf = (v) => {
  const name = str(v) || str(v?.name);
  return name ? { slug: str(v?.slug) || slugify(name), name } : null;
};

/** Title / summary / dates / tags from the payload entity, falling back to JSON-LD and meta tags. */
export function pageBasics(html, e = {}) {
  const ld = jsonLd(html).find((x) => /Article|BlogPosting|LearningResource/.test(String(x['@type']))) || {};
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html.replace(/<div class="sr-only"[\s\S]*?<\/div>/, ''));
  const summary = [e.meta_description, meta(html, 'description'), e.summary, ld.description].find((x) => typeof x === 'string' && x.trim());
  return {
    title: squash(debrandText(cleanTitle(String(str(e.title) || str(e.name) || ld.headline || (h1 && pageText(h1[1])) || meta(html, 'og:title') || '')))),
    summary: summary ? squash(debrandText(summary)) : null,
    publishedAt: iso(e.first_published_at) || iso(e.published_at) || iso(e.created_at) || iso(ld.datePublished) || iso(meta(html, 'article:published_time')),
    updatedAt: iso(e.content_updated_at) || iso(e.updated_at) || iso(ld.dateModified) || iso(meta(html, 'article:modified_time')),
    tags: [...new Set((Array.isArray(e.tags) && e.tags.length ? e.tags : metaAll(html, 'article:tag')).map((t) => squash(String(t))).filter((t) => t && !BRAND.test(t)))],
  };
}

// ---------------------------------------------------------------- language

const SCRIPTS = [['ko', /\p{Script=Hangul}/u], ['ja', /[\p{Script=Hiragana}\p{Script=Katakana}]/u], ['zh', /\p{Script=Han}/u],
  ['hi', /\p{Script=Devanagari}/u], ['ta', /\p{Script=Tamil}/u], ['te', /\p{Script=Telugu}/u], ['kn', /\p{Script=Kannada}/u],
  ['ml', /\p{Script=Malayalam}/u], ['bn', /\p{Script=Bengali}/u], ['gu', /\p{Script=Gujarati}/u], ['th', /\p{Script=Thai}/u],
  ['ar', /\p{Script=Arabic}/u], ['he', /\p{Script=Hebrew}/u], ['ru', /\p{Script=Cyrillic}/u], ['el', /\p{Script=Greek}/u]];
const STOPWORDS = Object.entries({
  en: 'the and of to is in that for with you are this on it be your',
  fr: 'le la les des est et une pour dans vous avec sur du au qui ce',
  es: 'el los las del es por una con como su al lo más pero',
  pt: 'os do da dos das uma com não em é ao na pelo você',
  de: 'der die und das ist nicht mit für ein eine auf den dem sie',
  it: 'il che per della sono gli dei nel alla questo anche',
  nl: 'het een van niet voor met zijn op dat wordt ook',
  id: 'yang dan untuk dengan ini tidak dari dalam akan pada',
  vi: 'và của là có các cho được với một những trong không người',
  tr: 've bir bu için ile olarak değil gibi daha çok',
}).map(([lang, list]) => [lang, new Set(list.split(' '))]);

/** ISO 639-1 guess from the prose: dominant non-Latin script, else Latin stopword votes; null if unclear. */
export function detectLanguage(md) {
  const text = md.replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, ' ').replace(/`[^`\n]*`/g, ' ').replace(/\]\([^)]*\)|https?:\/\/\S+/g, ' ');
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return null;
  const count = {};
  for (const ch of letters) {
    const hit = SCRIPTS.find(([, re]) => re.test(ch));
    if (hit) count[hit[0]] = (count[hit[0]] || 0) + 1;
  }
  if (count.zh && (count.ja || 0) > 0.05 * count.zh) count.ja += count.zh; // kanji inside Japanese
  const [script, n] = Object.entries(count).sort((a, b) => b[1] - a[1])[0] || [];
  if (n >= 0.15 * letters.length) {
    if (script !== 'hi') return script;
    const mr = (text.match(/आहे|आणि|च्या|मध्ये|नाही|करा/g) || []).length;
    const hi = (text.match(/है|और|में|नहीं|के लिए|करें/g) || []).length;
    return mr > hi ? 'mr' : 'hi';
  }
  const votes = STOPWORDS.map(([lang, set]) => [lang, words(text).filter((w) => set.has(w)).length]).sort((a, b) => b[1] - a[1]);
  return votes[0][1] >= 3 ? votes[0][0] : null;
}

// ---------------------------------------------------------------- runner

/** Iterate raw pages one at a time, count outcomes, write parsed/<name>.jsonl (or dry-run --files). */
export function run({ rawType, name, parse, finish, write = writeJsonl }) {
  const args = process.argv.slice(2);
  const files = args[0] === '--files' ? args.slice(1) : null;
  const canonical = (html, fallback) => {
    const m = new RegExp(`<link rel="canonical" href="https://prachub\\.com/${rawType}/([^"?#]+)"`).exec(html);
    return m ? m[1].split('/').join('__') : fallback;
  };
  const pages = files
    ? files.map((p) => () => {
      const buf = readFileSync(p);
      const html = (p.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
      return [canonical(html, basename(p).replace(/\.html(\.gz)?$/, '')), html];
    })
    : listRaw(rawType).map((slug) => () => [slug, readRaw(rawType, slug)]);
  const stats = { raw: pages.length, emitted: 0, skipped: {}, partial: 0, failures: 0 };
  const count = (k, by = 1) => { stats[k] = (stats[k] || 0) + by; };
  const items = [];
  for (const load of pages) {
    let slug = '?';
    try {
      const [s, html] = load();
      slug = s;
      const r = parse(html, slug, count);
      if (r.skip) stats.skipped[r.skip] = (stats.skipped[r.skip] || 0) + 1;
      else items.push(r.item);
    } catch (e) {
      stats.failures++;
      console.error(`[${name}] ${slug}: ${e.message}`);
    }
  }
  finish?.(items, stats);
  stats.emitted = items.length;
  stats.partial = items.filter((i) => i.partial).length;
  if (files) for (const i of items) console.log(JSON.stringify({ ...i, body: `${i.body.slice(0, 600)}… [${i.body.length} chars]` }, null, 1));
  else write(name, items);
  console.log(JSON.stringify({ [name]: stats }, null, 1));
  return items;
}

// ---------------------------------------------------------------- articles

export const MIN_BODY = 200; // chars of body left after locked parts are removed; less is not worth importing

function parse(html, slug, count) {
  const e = flightEntity(flight(html), slug) || {};
  if (e.is_locked === true) return { skip: 'locked' };
  // Articles about PracHub itself are marketing, not content.
  if (BRAND.test(slug) || BRAND.test(cleanTitle(String(e.title || meta(html, 'og:title') || '')))) return { skip: 'promo' };
  const b = pageBasics(html, e);
  const pub = publicBody(html, e);
  const d = debrand(dropLeadIn(pub.md, b.title));
  if (d.md.length < MIN_BODY) return { skip: pub.partial ? 'locked' : 'empty' };
  if (d.changed) count('debranded');
  if (pub.source === 'html') count('htmlBody');
  const lang = String(e.language || e.lang || e.locale || '');
  return {
    item: {
      id: `ar-${slug}`, type: 'article', slug, title: b.title || slug, summary: b.summary, body: d.md,
      company: companyOf(e.company), role: str(e.position) || str(e.role), category: str(e.category), difficulty: null, round: null, seniority: null,
      tags: b.tags, publishedAt: b.publishedAt, updatedAt: b.updatedAt,
      relations: dedupeRelations(linkRelations(d.md)),
      extra: {
        language: /^[a-z]{2}(?:[-_][a-z]{2,4})?$/i.test(lang) ? lang.slice(0, 2).toLowerCase() : detectLanguage(d.md),
        coverImage: str(e.featured_image) || [meta(html, 'og:image')].find((u) => u && !BRAND.test(u)) || null, // not the branded OG card
        readingTime: e.reading_time ?? null,
        resourceType: e.resource_type || null,
      },
      sourceUrl: sourceUrl('resources', slug), partial: pub.partial,
    },
  };
}

function selfTest() {
  const doc = parseHtml('<article><h2 id="x"><span aria-hidden="true">05</span><span>Plan</span></h2><p>Use <code>a_b</code> &amp; <strong>care</strong> on <a href="https://prachub.com/concepts/joins">joins</a>.</p>'
    + '<ul><li>one</li><li>two<ol><li>deep</li></ol></li></ul><pre><code class="language-py">x = 1\n</code></pre>'
    + '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1|2</td><td>3</td></tr></tbody></table>'
    + '<div><p>Unlock the full answer with Premium</p></div><div class="sr-only">seo copy</div></article>');
  const { md, locked } = toMarkdown(doc);
  assert.equal(md, '## Plan\n\nUse `a_b` & **care** on [joins](https://prachub.com/concepts/joins).\n\n- one\n- two\n  1. deep\n\n```py\nx = 1\n```\n\n| A | B |\n| --- | --- |\n| 1\\|2 | 3 |');
  assert.equal(locked, 1);
  const d = debrand('Original PracHub mocks, see [x](https://prachub.com/concepts/joins).\n\nTry PracHub Premium today.\n\n```\nPracHub\n```');
  assert.equal(d.md, 'Original mocks, see [x](/concepts/joins).\n\n```\nPracHub\n```');
  assert.deepEqual(linkRelations(d.md), [{ kind: 'concept', slug: 'joins' }]);
  assert.equal(debrandText("Reviewed by PracHub. PracHub's bank, practice on PracHub."), 'Reviewed. our bank, practice here.');
  assert.equal(detectLanguage('Le système est conçu pour les entretiens et la préparation des candidats dans une équipe.'), 'fr');
  assert.equal(detectLanguage('Bài viết này giải thích cách chuẩn bị cho phỏng vấn và những câu hỏi thường gặp của các công ty.'), 'vi');
  assert.equal(detectLanguage('시스템 설계 면접을 준비하는 방법과 자주 나오는 질문을 정리했습니다.'), 'ko');
  const rows = flight('<script>self.__next_f.push([1,"1:{\\"a\\":\\"$2\\",\\"slug\\":\\"s\\",\\"x\\":\\"$undefined\\"}\\n2:T3,é!"])</script>');
  assert.deepEqual(flightEntity(rows, 's'), { a: 'é!', slug: 's', x: null });
  assert.equal(iso('2026-03-17T03:03:45.971530'), '2026-03-17T03:03:45.971Z');
  assert.equal(dropLeadIn('## Top K\n\nCompany: Uber\n\nUpdated Oct 9, 2026\n\nCategory theory matters.', 'Top-K'), 'Category theory matters.');
  assert.equal(dropSections('## A\n\nx\n\n## Related concepts\n\n```\n# c\n```\n\n- y\n\n## B\n\nz', /^related concepts/i), '## A\n\nx\n\n## B\n\nz');
  console.log('self-test ok');
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test') selfTest();
  else run({ rawType: 'resources', name: 'articles', parse });
}
