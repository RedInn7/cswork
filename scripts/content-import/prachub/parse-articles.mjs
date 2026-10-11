// Knowledge Hub articles (/resources/<slug>) -> parsed/articles.jsonl (type 'article', id ar-<slug>).
//   node scripts/content-import/prachub/parse-articles.mjs                  all raw/resources pages
//   node scripts/content-import/prachub/parse-articles.mjs --files a.html   dry run on local pages (.html/.html.gz)
//   node scripts/content-import/prachub/parse-articles.mjs --self-test
// Kept: English and Chinese articles. Skipped: the listing page, other languages, pieces written to sell the old
// site, "-2" copies. Body: the payload Markdown with embedded HTML converted, sentences / items / sections that promote
// the old site removed whole, TeX in remark-math syntax (extra.math).
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

// Payload fields that hold a page body as Markdown (guide/resource: content, experience: content_md, question:
// content_enhanced, concept: explanation_md).
const BODY_FIELDS = ['content', 'content_md', 'content_enhanced', 'content_markdown', 'markdown', 'body', 'explanation_md'];

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

// ---------------------------------------------------------------- Markdown helpers

const CODE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$|(`+)(?!`)[^\n]*?[^`\n]\2(?!`)/gm; // fences, inline spans

/** fn(text) with code masked as \uE001n\uE002 tokens; code comes back through codeFn. */
export function outsideCode(md, fn, codeFn = (c) => c) {
  const code = [];
  const t = md.replace(CODE, (m) => `\uE001${code.push(m) - 1}\uE002`);
  return fn(t).replace(/\uE001(\d+)\uE002/g, (_, i) => codeFn(code[i]));
}

const KNOWN = new Set([...BLOCK, 'center', 'iframe', 'video', 'picture', 'source', 'svg', ...'a abbr b br cite code del em font i img ins kbd mark q s samp small span strong sub sup u'.split(' ')]);
const START = /<\/?([a-zA-Z][\w-]*)(?=[\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>/y;

/** End of the element whose start (or end) tag is at i: after its matching end tag, else after the tag itself. */
function elementEnd(s, i) {
  START.lastIndex = i;
  const m = START.exec(s);
  const name = m[1].toLowerCase();
  if (m[0][1] === '/' || VOID.has(name) || m[0].endsWith('/>')) return START.lastIndex;
  const re = new RegExp(`<(/?)${name}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`, 'gi');
  re.lastIndex = START.lastIndex;
  let depth = 1;
  for (let x; (x = re.exec(s)); ) if ((depth += x[1] ? -1 : x[0].endsWith('/>') ? 0 : 1) === 0) return re.lastIndex;
  return START.lastIndex;
}
const isTag = (s, i) => { START.lastIndex = i; const m = START.exec(s); return !!m && KNOWN.has(m[1].toLowerCase()); };
const VIDEO = /<iframe\b[^>]*?\bsrc="(?:https?:)?\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([\w-]+)[^"]*"[^>]*>(?:\s*<\/iframe>)?/gi;

/** A YouTube embed as a link paragraph: "Video: <title>" (the title attribute may be double-escaped). */
function videoLink(iframe, id) {
  const title = unescapeHtml(unescapeHtml(/\btitle="([^"]*)"/.exec(iframe)?.[1] || '')).trim().replace(/^YouTube video player$/i, '');
  return `<p><a href="https://www.youtube.com/watch?v=${id}">Video: ${(title || 'YouTube').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</a></p>`;
}

/**
 * Payload Markdown with its embedded HTML rewritten as Markdown (the site shows raw HTML as text):
 * diagram figures and <svg> are dropped, YouTube embeds become a link line, the rest goes through toMarkdown.
 */
export function embeddedHtml(md) {
  if (!/<[a-zA-Z]/.test(md)) return md;
  return outsideCode(md, (t) => {
    let out = '';
    let last = 0;
    for (let i = t.indexOf('<'); i >= 0; i = t.indexOf('<', Math.max(i + 1, last))) {
      if (i < last || !isTag(t, i)) continue;
      let end = elementEnd(t, i);
      for (let j; (j = end + /^\s*/.exec(t.slice(end))[0].length) < t.length && isTag(t, j); ) end = elementEnd(t, j);
      const html = t.slice(i, end)
        .replace(/<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?<svg\b[\s\S]*?<\/figure>/gi, '')
        .replace(VIDEO, videoLink)
        .replace(/\uE001(\d+)\uE002/g, '<code>\uE001$1\uE002</code>');
      const md = toMarkdown(parseHtml(html)).md.replace(/`\uE001(\d+)\uE002`/g, '\uE001$1\uE002');
      const block = /(?:^|\n)[ \t]*$/.test(t.slice(0, i)) && /^[ \t]*(?:\n|$)/.test(t.slice(end));
      out += t.slice(last, i) + (block ? `\n\n${md}\n\n` : md);
      last = end;
    }
    return last ? (out + t.slice(last)).replace(/\n{3,}/g, '\n\n') : t;
  });
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
// The old site speaking of itself without its name ("our AI mock interview tool", "supplied by this platform").
const SELF = /\b(?:by|on) (?:this|our) (?:platform|site)\b|\bour platform (?:connects|allows|pairs|offers|gives|lets|helps|provides|has)\b|\bthis site['’]s\b|\bour (?:AI[- ]?(?:mock|interview\w*|coach|tutor|grader|feedback)|mock interview(?:s|er| tool)?|(?:interview |coding )?question bank|(?:real )?interview questions|written solutions|premium|pro plan|subscription|community|discord|newsletter)\b/i;
const CTA_LINK = /\]\((?:\/(?:pricing|login|register|signup|mcp|daily-quest)\b|https?:\/\/(?:discord\.gg|discord\.com\/invite)\/)/i;
const SITE_URL = /https?:\/\/(?:www\.)?prachub\.com(\/[^\s)\]"'<>]*)?/gi;
const linkText = (s) => s.replace(/(?<!!)\[((?:[^\]\\]|\\.)*)\]\([^)]*\)/g, '$1');
/** Names the old site (old-site link targets aside: the builder maps them), speaks as it, or links to its sign-up pages. */
export const promotes = (s) => BRAND.test(s.replace(SITE_URL, '')) || SELF.test(linkText(s)) || CTA_LINK.test(s);

/** Word-level de-branding for short labels (titles, FAQ, table headers): URLs become site paths, brand words go. */
export function debrandText(s) {
  if (!s || !BRAND.test(s)) return s;
  return s
    .replace(SITE_URL, (_, p) => p || '/')
    .replace(/\s+by PracHub(?:\.com)?\b/gi, '')
    .replace(/\bPracHub(?:\.com)?['’]s\b/gi, 'the')
    .replace(/\b(?:on|at|from|via|with|using|in) PracHub(?:\.com)?\b/gi, 'here')
    .replace(/(^|[ \t])PracHub(?:\.com)?\b(?:[ \t](?=\S))?/gim, '$1')
    .replace(/\bPracHub(?:\.com)?\b/gi, '');
}
const capital = (s) => s.replace(/^(\W*)(\p{Ll})/u, (m, a, c) => a + c.toUpperCase());

const ABBR = /\b(?:e\.g|i\.e|vs|etc|cf|approx|incl|Dr|Mr|Ms|Mrs|St|No|Fig|Inc|Ltd|Jr|Sr|\p{Lu})\.$/u;
/** Sentences of a block, each with its trailing whitespace; a line break also ends one. */
export function sentences(t) {
  const out = [];
  let last = 0;
  for (const m of t.matchAll(/[.!?]+["”’)\]*_]*[ \t]+|[。！？]+["”’」』)]*[ \t]*|[ \t]*\n/g)) {
    if (m[0][0] === '.' && ABBR.test(t.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
    out.push(t.slice(last, m.index + m[0].length));
    last = m.index + m[0].length;
  }
  return last < t.length ? [...out, t.slice(last)] : out;
}

// A sentence that leans on the one before it ("They are practice records", "Use it to …"); "This guide …" does not.
const LEANS = /^\W*(?:(?:\S+\s+){0,3}?(?:it|its|they|them|their|these|those)\b|(?:That|This(?! (?:guide|article|post|page|section|table|tutorial|walkthrough|series|list)\b))\b)/i;

/** A promoting sentence without its brand-only parenthetical or tail (after a dash, semicolon or CJK comma); null if that is not enough. */
function trimClause(x) {
  const [, core, end] = /^([\s\S]*?)([.!?。！？]*["”’)\]*_」』]*\s*)$/.exec(x);
  let t = core.replace(/\s*\([^()]*\)/g, (p) => (promotes(p) ? '' : p));
  if (promotes(t)) {
    const cut = [...t.matchAll(/\s+[—–]\s+|;\s+|[；，]/g)].findLast((m) => !promotes(t.slice(0, m.index)));
    if (!cut) return null;
    t = t.slice(0, cut.index);
  }
  return /[\p{L}\p{N}]/u.test(t) ? t + end : null;
}

/** A paragraph without the sentences that promote the old site (or lean on one); '' when only a label is left. */
function cleanProse(t) {
  if (!promotes(t)) return t;
  // A paragraph set wholly in emphasis keeps its markers when its last sentence goes.
  const wrap = /^(\*{1,2}|_{1,2})(?=\S)([\s\S]*\S)\1$/.exec(t);
  if (wrap && !wrap[2].includes(wrap[1])) return (wrap[1] + cleanProse(wrap[2]) + wrap[1]).replace(/^(\*+|_+)\1$/, '');
  const kept = [];
  let cut = false;
  for (const x of sentences(t)) {
    const y = promotes(x) ? trimClause(x) : cut && LEANS.test(x) ? null : x;
    cut = y === null;
    if (y) kept.push(y);
  }
  let out = kept.join('').replace(/\s*\\$/, '').trim();
  if ((out.match(/\*\*/g) || []).length % 2) out = out.replace(/\*\*(?![\s\S]*\*\*)/, ''); // a bold run cut in half
  return /[\p{L}\p{N}]/u.test(out.replace(/^\W*\*\*[^*]*\*\*\W*$|^[^.!?\n]{0,60}:$/u, '')) ? out : '';
}

const ITEM = /^([ \t]*)([-*+]|\d+([.)]))[ \t]+/;
/** A list without the items that promote the old site (with their nested items); ordered items are renumbered. */
function cleanList(b) {
  const items = [];
  for (const l of b.split('\n')) {
    const m = ITEM.exec(l);
    if (m || !items.length) items.push({ m, lines: [m ? l.slice(m[0].length) : l] });
    else items.at(-1).lines.push(l);
  }
  const out = [];
  const next = new Map(); // indent -> next number of the ordered list at that depth
  let skip = Infinity;
  for (const { m, lines } of items) {
    const depth = m ? m[1].length : 0;
    for (const d of next.keys()) if (d > depth) next.delete(d);
    if (m?.[3] && !next.has(depth)) next.set(depth, parseInt(m[2], 10));
    if (depth > skip) continue;
    skip = Infinity;
    const text = cleanProse(lines.join('\n'));
    if (!text) {
      skip = depth;
      continue;
    }
    if (!m) out.push(text);
    else if (!m[3]) out.push(m[0] + text);
    else {
      out.push(`${m[1]}${next.get(depth)}${m[3]}${m[0].slice(m[1].length + m[2].length)}${text}`);
      next.set(depth, next.get(depth) + 1);
    }
  }
  return out.join('\n');
}

const cells = (row) => row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/);
/** A table without columns headed by the old site and rows about it; a "PracHub question" label column keeps its rows. */
function cleanTable(b) {
  const [head, delim, ...body] = b.split('\n').map(cells);
  const drop = head.map((c, i) => i > 0 && promotes(c));
  if (drop.some(Boolean) && drop.filter((x) => !x).length < 2) return '';
  if (promotes(head[0])) head[0] = ` ${capital(debrandText(head[0]).trim())} `;
  const rows = [head, delim];
  for (const r of body) {
    if (promotes(r[0] || '')) continue;
    const c = r.map((x, i) => (i && !drop[i] && promotes(x) ? ` ${cleanProse(x.trim())} ` : x));
    if (!c.some((x, i) => x !== r[i] && !x.trim())) rows.push(c);
  }
  return rows.length > 2 ? rows.map((r) => `|${r.filter((_, i) => !drop[i]).join('|')}|`).join('\n') : '';
}

/** One block (paragraph, list, table, quote) without what promotes the old site. */
function cleanBlock(b) {
  if (!promotes(b)) return b;
  if (/^[ \t]*>/.test(b)) {
    const q = cleanBlocks(b.replace(/^[ \t]*> ?/gm, ''));
    return q && q.replace(/^/gm, '> ').replace(/^> $/gm, '>');
  }
  if (/^[ \t]*\|/.test(b) && /^[ \t]*\|?[ \t]*:?-{3,}/.test(b.split('\n')[1] || '')) return cleanTable(b);
  if (ITEM.test(b)) return cleanList(b);
  const at = b.search(/\n(?=[ \t]*(?:[-*+]|\d+[.)])[ \t])/); // a paragraph running straight into a list
  if (at < 0) return cleanProse(b);
  const [intro, list] = [cleanProse(b.slice(0, at)), cleanList(b.slice(at + 1))];
  return list ? [intro, list].filter(Boolean).join('\n') : intro.endsWith(':') ? '' : intro;
}

// A heading naming the old site over a practice list, a CTA or an FAQ entry about it: the section goes.
const PRACTICE_HEAD = /\b(?:practi[cs]\w*|rehears\w*|drills?|exercises?|prompts?|related|verified|adjacent|next|extend\w*|follow-ups?|links?|resources?|reading|vs\.?|versus|alternatives?|replace|fits?|try|use|start)\b|\b(?:five|four|three|which|these|more)\s+(?:\w+\s+){0,2}PracHub\b|PracHub\s+(?:questions?|exercises?|prompts?)\b|\?\s*$/i;
const unbrandHeading = (h) => h.replace(/\s+(?:from|in|on|at|via|with) (?:the )?PracHub(?:['’]s)?(?: (?:question )?bank)?\b/gi, '')
  .replace(/\bPracHub(?:['’]s)? and |\s+and PracHub\b|\bPracHub(?:['’]s)?\s*/gi, '');
/** Letters of prose a section keeps besides link lists and practice tables (rows that open with a link). */
const substance = (md) => md.split('\n').filter((l) => !/^\s*(?:[-*+]|\d+[.)]|\|)\s*\[/.test(l)).join('\n')
  .replace(/!?\[[^\]]*\]\([^)]*\)/g, '').replace(/[^\p{L}\p{N}]+/gu, '').length;

/**
 * Prose without the old site: sentences, list items and table rows/columns that promote it go; a section under a
 * heading naming it goes unless it is real content (then only the heading loses the name); emptied headings go too.
 */
function cleanBlocks(t) {
  const out = []; // [text, heading level or 0, lost something]
  const lose = () => { const h = out.findLast((x) => x[1]); if (h) h[2] = true; };
  let held = null; // [heading naming the old site, level, blocks]
  const settle = () => {
    if (!held) return;
    const [head, level, blocks] = held;
    held = null;
    const body = cleanBlocks(blocks.join('\n\n'));
    const title = unbrandHeading(head);
    if (PRACTICE_HEAD.test(head) || promotes(title) || substance(body) < 500) return lose();
    out.push([title, level, false]);
    if (body) out.push([body, 0, false]);
  };
  for (const b of t.replace(SITE_URL, (_, p) => p || '/').replace(/^(#{1,6}[ \t].*)\n(?!\n)/gm, '$1\n\n').split(/\n{2,}/)) {
    const h = /^(#{1,6})[ \t]/.exec(b);
    if (h && held && h[1].length <= held[1]) settle();
    if (held) held[2].push(b);
    else if (h && promotes(b)) held = [b, h[1].length, []];
    else if (h) out.push([b, h[1].length, false]);
    else {
      const c = cleanBlock(b);
      if (c) out.push([c, 0, false]);
      else {
        lose();
        if (/\S\s+\S[^\n]*:\s*$/.test(out.at(-1)?.[0] || '') && !out.at(-1)[1]) out.pop(); // its intro ("Practice these next:")
      }
    }
  }
  settle();
  for (let i = out.length - 1; i >= 0; i--) if (out[i][1] && out[i][2] && !(out[i + 1] && (!out[i + 1][1] || out[i + 1][1] > out[i][1]))) out.splice(i, 1);
  return out.map((x) => x[0]).join('\n\n');
}

/** Brand-free names in code: "Original PracHub exercise" -> "Original exercise", prachub-lab -> sample-lab. */
const neutral = (c) => (!BRAND.test(c) ? c : c
  .replace(/(?:www\.)?prachub\.com/gi, 'example.com')
  .replace(/\bPracHub[ \t]+(?=\p{Ll})/gu, '')
  .replace(/"prac"/g, '"sam"').replace(/"hub"/g, '"ple"') // the Java string-folding example spells the brand in parts
  .replace(/prachub/gi, (m) => (m === 'PRACHUB' ? 'SAMPLE' : m[0] === 'P' ? 'Sample' : 'sample')));

/**
 * Body de-branding: what promotes the old site goes as a whole sentence, list item, table row/column or
 * section, so the rest stays grammatical; old-site URLs become site paths; code gets neutral names.
 */
export function debrand(md) {
  if (!BRAND.test(md) && !SELF.test(md) && !CTA_LINK.test(md)) return { md, changed: false };
  const out = outsideCode(md, cleanBlocks, neutral).replace(/\n{3,}/g, '\n\n').trim();
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
    // A card link: its title is the first text block, not the metadata lines after it ("Airbnb · Data Scientist").
    const head = findAll(a, (n) => n.tag === 'div' && !n.kids.some((k) => k.tag === 'div'))[0];
    if (kind && kinds.includes(kind)) out.push({ kind, slug: m[2], title: squash(textOf(head || a)) || undefined });
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

/** A summary without old-site sentences; one cut off with "......" ends in an ellipsis after its last whole word. */
function summaryText(s) {
  const t = squash(cleanProse(squash(s)));
  if (!/(?:\.{3,}|…)$/.test(t)) return t || null;
  return `${t.replace(/[\s.…]+$/, '').replace(/(?:[\s,;:(]+(?:and|or|the|a|an|of|to|for|with|in|on|about|as|like|including))+$/i, '')}…`;
}

/** Title / summary / dates / tags from the payload entity, falling back to JSON-LD and meta tags. */
export function pageBasics(html, e = {}) {
  const ld = jsonLd(html).find((x) => /Article|BlogPosting|LearningResource/.test(String(x['@type']))) || {};
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html.replace(/<div class="sr-only"[\s\S]*?<\/div>/, ''));
  const summary = [e.meta_description, meta(html, 'description'), e.summary, ld.description].find((x) => typeof x === 'string' && x.trim());
  return {
    title: squash(debrandText(cleanTitle(String(str(e.title) || str(e.name) || ld.headline || (h1 && pageText(h1[1])) || meta(html, 'og:title') || '')))),
    summary: summary ? summaryText(summary) : null,
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
const SCRIPT_RUNS = SCRIPTS.map(([k, re]) => [k, new RegExp(`(?=\\p{L})${re.source}`, 'gu')]);
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
  const count = Object.fromEntries(SCRIPT_RUNS.map(([k, re]) => [k, (text.match(re) || []).length]).filter(([, n]) => n));
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

// ---------------------------------------------------------------- payload clean-up

const CITE = /(?:\s+(?:from|by|via|of|in))?\s*\*\*:{0,2}contentReference\[oaicite:\d+\]\{index=\d+\}\*\*|\s*:{0,2}contentReference\[oaicite:\d+\]\{index=\d+\}/g;
const CP1252 = Object.fromEntries('€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ'.split('').map((c, i) => [c, 0x80 + i]));

/** Payload fixes: ChatGPT citation markers, cp1252 mojibake ("â€œ"), control characters, an unclosed code fence. */
export function tidy(md) {
  return closeFence(md.replace(CITE, '')
    .replace(/â[\u0080-\u00BF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]{2}/g, (m) => {
      const c = Buffer.from([...m].map((x) => CP1252[x] ?? x.charCodeAt(0))).toString('utf8');
      return c.includes('\uFFFD') ? m : c;
    })
    // oxlint-disable-next-line no-control-regex -- a mangled "\u0024" left U+0002 before the 4
    .replace(/\u00024/g, '$')
    // oxlint-disable-next-line no-control-regex -- control characters are the target
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFEFF]/g, ''));
}

/** A code fence left open is closed before the first blank line followed by a heading, a table or prose. */
function closeFence(md) {
  const lines = md.split('\n');
  let open = -1;
  lines.forEach((l, i) => {
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(l);
    const o = open >= 0 && /^ {0,3}(`{3,}|~{3,})/.exec(lines[open])[1];
    if (m && open < 0) open = i;
    else if (m && m[1][0] === o[0] && m[1].length >= o.length && !m[2].trim()) open = -1;
  });
  if (open < 0) return md;
  const fence = /^ {0,3}(`{3,}|~{3,})/.exec(lines[open])[1];
  const end = lines.findIndex((l, i) => i > open && !l.trim() && /^(?:#{1,6}\s|\||[A-Z][^=;{}()]*\s[a-z]+\s[a-z]+)/.test(lines[i + 1] || ''));
  if (end < 0) return `${md}\n${fence}`;
  lines.splice(end, 0, fence);
  return closeFence(lines.join('\n'));
}

const untracked = (u) => {
  const [, base, query, hash = ''] = /^([^?#]*)\?([^#]*)(#.*)?$/.exec(u) || [];
  if (!query) return u;
  const keep = query.split('&').filter((p) => !/^utm_/i.test(p));
  return base + (keep.length ? `?${keep.join('&')}` : '') + hash;
};
/** Links: utm_* parameters dropped, "[t]([url](url))" repaired, relative targets (not site paths) reduced to their text. */
export const fixLinks = (md) => outsideCode(md, (t) => t
  .replace(/\]\(\[([^\]\s]+)\]\([^)\s]*\)\)/g, ']($1)')
  .replace(/https?:\/\/[^\s)\]>"'<]+/g, (u) => (/[?&]utm_/i.test(u) ? untracked(u) : u))
  .replace(/(?<!!)\[((?:[^\]\\]|\\.)*)\]\((?![a-z][a-z0-9+.-]*:|[/#])[^)\s]*\)/gi, '$1'));

// ---------------------------------------------------------------- math

const TEX = /\\(?:frac|dfrac|tfrac|sum|prod|int|sqrt|text|mathrm|mathbf|mathbb|mathcal|operatorname|mid|cap|cup|cdot|times|le|leq|ge|geq|neq|approx|sim|propto|infty|partial|nabla|log|ln|exp|alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|sigma|tau|phi|pi|rho|omega|Sigma|Delta|hat|bar|tilde|vec|left|right|quad|ldots|cdots|in|to|rightarrow|binom|top|Pr|Theta|Omega|ldots|lfloor|rfloor|lceil|rceil|ge|ne)(?![a-zA-Z])/;

/** Formulas set in bare parentheses (their "\(" was lost), e.g. "(P(A\mid B)=P(A\cap B)/P(B))", become $…$. */
function parenTex(t) {
  let out = '';
  let last = 0;
  for (let i = t.indexOf('('); i >= 0; i = t.indexOf('(', i + 1)) {
    if (i < last || (i && !/[\s:]/.test(t[i - 1]))) continue;
    let depth = 0;
    let j = i;
    for (; j < t.length && t[j] !== '\n'; j++) if (t[j] === '(') depth++; else if (t[j] === ')' && --depth === 0) break;
    const inner = t.slice(i + 1, j);
    if (depth || !TEX.test(inner) || /\$|\]\(/.test(inner)) continue;
    out += `${t.slice(last, i)}$${inner}$`;
    last = j + 1;
  }
  return out + t.slice(last);
}

/** Dollar amounts escaped: remark-math pairs dollars like code spans, so "a $1 stake … $p$" would open a formula. */
function currency(line) {
  const ones = [...line.matchAll(/\\.|\$\$|\$/g)].filter((m) => m[0] === '$').map((m) => m.index);
  const esc = new Set();
  for (let k = 0; k < ones.length; k++) {
    const inner = k + 1 < ones.length ? line.slice(ones[k] + 1, ones[k + 1]) : '';
    const tex = inner.replace(/\\text\{[^}]*\}|\\[a-zA-Z]+/g, ' ').replace(/\{[^{}]*\}/g, ' ').replace(/\{[^{}]*\}/g, ' ');
    // A formula has no run of prose words, bold markers or table-cell pipes, and is no "$5–" range start;
    // "$ x $" padding is fine when it holds TeX.
    const formula = inner && !/[a-zA-Z]{2,} [a-zA-Z]{2,} [a-zA-Z]{2,}/.test(tex) && !/\*\*|^\d[\d,.]*[–—-]$/.test(inner)
      && !(/^\s*\|/.test(line) && /(?<!\\)\|/.test(inner)) && (/[\\^_{}]/.test(inner) || /^\S(?:.*\S)?$/.test(inner));
    if (formula) k++;
    else esc.add(ones[k]);
  }
  return esc.size ? line.replace(/\$/g, (m, i) => (esc.has(i) ? '\\$' : m)) : line;
}

/**
 * TeX the way remark-math reads it ($…$, $$…$$), and whether there is any: \(…\) and \[…\] delimiters, formulas in
 * bare parentheses and KaTeX output copied as text are rewritten; dollar amounts next to formulas are escaped.
 * `katex`: the page rendered math, so plain "$T$" counts too.
 */
export function mathMarkdown(md, katex = false) {
  let math = false;
  const out = outsideCode(md, (t) => {
    if (!katex && !TEX.test(t) && !/\$[^$\n]*[\\^_{][^$\n]*\$/.test(t)) return t;
    const x = t.replace(/\\\\(?=[a-zA-Z]{2})/g, '\\') // "$L=\\lambda W$": a doubled command backslash
      .replace(/\S*?(\\[a-zA-Z]+(?:\{(?:[^{}\n]|\{[^{}\n]*\})*\})+)\S*?\u200B/g, (m, y) => `$${y}$`) // KaTeX copied as text
      .replace(/\\\[([\s\S]+?)\\\]/g, (m, y) => (TEX.test(y) || /[=^_]/.test(y) ? `$$${y}$$` : m))
      .replace(/\\\((.+?)\\\)/g, (m, y) => `$${y.trim()}$`)
      .split('\n').map(currency).join('\n')
      // Formulas stay as they are apart from "#" (a KaTeX error); bare-parenthesis formulas only outside them.
      .split(/(\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/)
      .map((p, i) => (i % 2 ? p.replace(/(?<!\\)#/g, '\\#') : parenTex(p)))
      .join('');
    math = /(?<!\\)\$/.test(x); // a formula is left once dollar amounts are escaped
    return math ? x : t;
  });
  return { md: out, math };
}

// ---------------------------------------------------------------- articles

export const MIN_BODY = 200; // chars of body left after locked parts are removed; less is not worth importing
const LANGS = new Set(['en', 'zh']); // the site's languages

// Review and comparison titles ("X Review 2026", "Is X Worth It", "X vs Y"); a code review is an interview format.
const REVIEW = /\b(?:reviews?|alternatives?|worth|enough|gone|dead|honest|better than)\b|够用|够面试|值得|评测|测评|替代|能过/i;
const VERSUS = /\b(?:vs\.?|versus|which|best|ranked)\b|对比/i;
const FORMAT_REVIEW = /\b(?:code|recruiter|holistic|human|architecture|diff|build|progress|take-home|live|system|peer|security|resume|design|incident|performance) reviews?\b/gi;
// The old site as the product (compared, chosen, the subject of a claim), not one of its questions being cited.
const PITCH = /\b(?:vs\.?|versus|or|than|and|use|using|try|choose|pick|start with|replace)\s+PracHub\b(?!['’]s?\s+(?:[\w-]+\s+){0,3}?(?:questions?|prompts?|exercises?|records?|examples?)\b)|\bPracHub(?:['’]s)?\s+(?:is|was|can|gives|offers|lets|helps|has|covers|supplies|fits|works|makes|provides|wins|adds|focuses|shows|does|vs\.?|free|premium|model|approach|advantage|strength|edge)\b|\|\s*\**PracHub(?:\.com)?\**\s*\|/gi;

/** How often the visible text names the old site, and how often it pitches it as the product. */
export function brandUse(md) {
  const text = linkText(md.replace(CODE, ' ').replace(SITE_URL, ''));
  return { mentions: (text.match(/prachub/gi) || []).length, pitches: (text.match(PITCH) || []).length };
}

/**
 * Written to sell the old site: the slug or title names it, or a review / comparison of prep products names it
 * 5+ times and pitches it (the pitch phrases are English; Chinese reviews go by the count).
 */
export function promotional(slug, title, md, language) {
  if (BRAND.test(slug) || BRAND.test(title)) return true;
  const { mentions, pitches } = brandUse(md);
  const kind = title.replace(FORMAT_REVIEW, '');
  const zh = language === 'zh';
  return pitches >= 8 || (mentions >= 5 && ((REVIEW.test(kind) && (zh || pitches >= 1)) || (VERSUS.test(kind) && (zh || pitches >= 2))));
}

const roleName = (r) => (r && /^(?:[A-Z][a-z]+){2,}$/.test(r) ? r.replace(/([a-z])(?=[A-Z])/g, '$1 ') : r); // "SoftwareEngineer"

function parse(html, slug, count) {
  if (slug === '_index') return { skip: 'index' }; // the listing page (testimonials), not an article
  const e = flightEntity(flight(html), slug) || {};
  if (e.is_locked === true) return { skip: 'locked' };
  const b = pageBasics(html, e);
  // Articles are free (is_free): the payload Markdown is the body even where the page renders it differently.
  const pub = e.is_free !== false && str(e.content) ? { md: e.content, partial: false, source: 'payload' } : publicBody(html, e);
  const md = fixLinks(embeddedHtml(tidy(pub.md)));
  const language = detectLanguage(md);
  if (!LANGS.has(language)) return { skip: `language:${language}` };
  if (promotional(slug, cleanTitle(String(e.title || meta(html, 'og:title') || '')), md, language)) return { skip: 'promo' };
  const d = debrand(dropLeadIn(md, b.title));
  const m = mathMarkdown(d.md);
  if (m.md.length < MIN_BODY) return { skip: pub.partial ? 'locked' : 'empty' };
  if (d.changed) count('debranded');
  if (m.math) count('math');
  if (pub.source === 'html') count('htmlBody');
  return {
    item: {
      id: `ar-${slug}`, type: 'article', slug, title: b.title || slug, summary: b.summary, body: m.md,
      company: companyOf(e.company), role: roleName(str(e.position) || str(e.role)), category: str(e.category), difficulty: null, round: null, seniority: null,
      tags: b.tags, publishedAt: b.publishedAt, updatedAt: b.updatedAt,
      relations: dedupeRelations(linkRelations(m.md)),
      extra: {
        language,
        ...(m.math && { math: true }),
        // Not the branded OG card or an inline SVG card.
        coverImage: [str(e.featured_image), meta(html, 'og:image')].find((u) => u && !BRAND.test(u) && !u.startsWith('data:')) || null,
        readingTime: e.reading_time ?? null,
        resourceType: e.resource_type || null,
      },
      sourceUrl: sourceUrl('resources', slug), partial: pub.partial,
    },
  };
}

/** Drops an "x-2" copy whose title and text repeat article "x" (5-word shingles, Jaccard >= 0.8). */
function dropCopies(items, stats) {
  const bySlug = new Map(items.map((it) => [it.slug, it]));
  const shingles = (it) => new Set(grams(words(it.body), 5));
  for (let k = items.length - 1; k >= 0; k--) {
    const base = bySlug.get(/^(.+)-\d+$/.exec(items[k].slug)?.[1]);
    if (!base || base.title.toLowerCase() !== items[k].title.toLowerCase()) continue;
    const [a, c] = [shingles(base), shingles(items[k])];
    let both = 0;
    for (const x of a) if (c.has(x)) both++;
    if (both >= 0.8 * (a.size + c.size - both)) {
      items.splice(k, 1);
      stats.skipped.duplicate = (stats.skipped.duplicate || 0) + 1;
    }
  }
}

function selfTest() {
  const doc = parseHtml('<article><h2 id="x"><span aria-hidden="true">05</span><span>Plan</span></h2><p>Use <code>a_b</code> &amp; <strong>care</strong> on <a href="https://prachub.com/concepts/joins">joins</a>.</p>'
    + '<ul><li>one</li><li>two<ol><li>deep</li></ol></li></ul><pre><code class="language-py">x = 1\n</code></pre>'
    + '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1|2</td><td>3</td></tr></tbody></table>'
    + '<div><p>Unlock the full answer with Premium</p></div><div class="sr-only">seo copy</div></article>');
  const { md, locked } = toMarkdown(doc);
  assert.equal(md, '## Plan\n\nUse `a_b` & **care** on [joins](https://prachub.com/concepts/joins).\n\n- one\n- two\n  1. deep\n\n```py\nx = 1\n```\n\n| A | B |\n| --- | --- |\n| 1\\|2 | 3 |');
  assert.equal(locked, 1);
  const d = debrand([
    '## Setup', '', "Start with [PracHub's heap question](https://prachub.com/coding-questions/heap). It is a record. Use a heap — see the "
      + 'PracHub question: [x](https://prachub.com/coding-questions/x). Read [joins](https://prachub.com/concepts/joins).',
    '', '1. Try it on PracHub.', '2. Time it.', '3. Explain.',
    '', '| PracHub question | Focus | LeetCode | PracHub |', '| --- | --- | --- | --- |', '| [A](https://prachub.com/coding-questions/a) | heaps | yes | yes |',
    '| PracHub Premium | x | y | z |', '', '## Practice on PracHub', '', 'Links.', '', '## Next', '', '*Note: checked in 2026; PracHub records are practice.*',
    '', '```js', '// Original PracHub exercise', 'const lab = "prachub-lab";', '```'].join('\n'));
  assert.equal(d.md, ['## Setup', '', 'Use a heap. Read [joins](/concepts/joins).', '', '1. Time it.', '2. Explain.',
    '', '| Question | Focus | LeetCode |', '| --- | --- | --- |', '| [A](/coding-questions/a) | heaps | yes |', '', '## Next', '', '*Note: checked in 2026.*',
    '', '```js', '// Original exercise', 'const lab = "sample-lab";', '```'].join('\n'));
  assert.deepEqual(linkRelations(d.md), [{ kind: 'concept', slug: 'joins' }, { kind: 'question', slug: 'a' }]);
  assert.equal(debrand('Our platform connects you with mentors. Tables need keys.').md, 'Tables need keys.');
  assert.equal(debrand('## Plan\n\n### Day 1\n\nUse PracHub daily.\n\n### Day 2\n\nBuild.').md, '## Plan\n\n### Day 2\n\nBuild.');
  const fifty = Array.from({ length: 12 }, (_, i) => `${i + 1}. Tell me about a time you changed a plan under pressure.`).join('\n');
  assert.equal(debrand(`## The PracHub Behavioral 50\n\nPracHub ranks these.\n\n${fifty}\n\n## Five PracHub questions to practice next\n\n- [A](/x)`).md, `## The Behavioral 50\n\n${fifty}`);
  assert.equal(debrandText("Reviewed by PracHub. Start from PracHub's bank, practice on PracHub."), 'Reviewed. Start from the bank, practice here.');
  assert.deepEqual(sentences('See e.g. this. Then that!\nNext'), ['See e.g. this. ', 'Then that!\n', 'Next']);
  assert.equal(embeddedHtml('Intro.\n\n<figure><svg><text>x</text></svg><figcaption>c</figcaption></figure>\n\n<div><iframe src="https://www.youtube.com/embed/abc?si=1" title="Joins &amp;amp; NULLs"></iframe></div>\n\n'
    + '<table><tr><th>a</th></tr><tr><td><strong>1</strong></td></tr></table>\n\nUse `<p>` and <code>x</code>.'),
    'Intro.\n\n[Video: Joins & NULLs](https://www.youtube.com/watch?v=abc)\n\n| a |\n| --- |\n| **1** |\n\nUse `<p>` and `x`.');
  assert.equal(tidy('BERT from **:contentReference[oaicite:0]{index=0}**, a model. \u00e2\u20ac\u0153q\u00e2\u20ac\u009d\n\n```py\nx = 1\n\nThis line is prose again.'),
    'BERT, a model. \u201cq\u201d\n\n```py\nx = 1\n```\n\nThis line is prose again.');
  assert.equal(fixLinks('[a](https://x.io/p?utm_source=openai&id=2) [b]([https://y.io/](https://y.io/)) [c](citation) [d](/concepts/e)'),
    '[a](https://x.io/p?id=2) [b](https://y.io/) c [d](/concepts/e)');
  const tex = mathMarkdown('Let \\(n\\) be odd: (P(A\\mid B)=1). A $1 stake wins $b with probability $p$.\n\n\\[\nx^2\n\\]');
  assert.deepEqual(tex, { md: 'Let $n$ be odd: $P(A\\mid B)=1$. A \\$1 stake wins \\$b with probability $p$.\n\n$$\nx^2\n$$', math: true });
  assert.equal(mathMarkdown('Pay $5 and $10 now.').math, false);
  assert.equal(promotional('x', 'Foo Review 2026: Is It Worth It?', 'PracHub is free. PracHub, PracHub, PracHub and PracHub.', 'en'), true);
  assert.equal(promotional('x', 'Code Review Interview Guide', 'Use PracHub. PracHub PracHub PracHub PracHub.', 'en'), false);
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
  else run({ rawType: 'resources', name: 'articles', parse, finish: dropCopies });
}
