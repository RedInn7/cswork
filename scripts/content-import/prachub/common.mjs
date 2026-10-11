// Shared readers for the PracHub content import (authorized migration of public pages).
// Raw pages: $PRACHUB_DIR/raw/<type>/<slug>.html.gz (written by the crawler).
import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const DIR = process.env.PRACHUB_DIR || join(homedir(), 'cswork-prachub');
export const PARSED = join(DIR, 'parsed');

/** Slugs of the cached pages of one URL type, e.g. 'coding-questions'. */
export function listRaw(type) {
  const dir = join(DIR, 'raw', type);
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.html.gz')).map((f) => f.slice(0, -8)).sort()
    : [];
}
export function readRaw(type, slug) {
  return gunzipSync(readFileSync(join(DIR, 'raw', type, `${slug}.html.gz`))).toString('utf8');
}
export const sourceUrl = (type, slug) => `https://prachub.com/${type}/${slug.split('__').join('/')}`;

/** The crawler-facing copy of the page body: <article data-seo-content="..."> inner HTML. */
export function seoArticle(html) {
  const m = /<article data-seo-content="([^"]+)"[^>]*>([\s\S]*?)<\/article>/.exec(html);
  return m ? { kind: m[1], html: m[2] } : null;
}
/** All JSON-LD objects on the page (flattening @graph and arrays). */
export function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const value = JSON.parse(m[1]);
      for (const item of [value].flat()) out.push(...(item['@graph'] || [item]));
    } catch {
      // Ignore malformed blocks; the HTML still carries the content.
    }
  }
  return out;
}
export function meta(html, name) {
  const m = new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`).exec(html);
  return m ? decode(m[1]) : null;
}
export function decode(text) {
  return text
    .replace(/<!-- -->/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
export const stripTags = (html) => decode(html.replace(/<[^>]+>/g, ''));

/** Write items as JSON lines, sorted by id so reruns are diff-stable. */
export function writeJsonl(name, items) {
  mkdirSync(PARSED, { recursive: true });
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(join(PARSED, `${name}.jsonl`), sorted.map((i) => JSON.stringify(i)).join('\n') + '\n');
  return sorted.length;
}
