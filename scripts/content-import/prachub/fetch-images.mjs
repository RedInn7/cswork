// Downloads the images we publish so the site serves its own copies.
//   node scripts/content-import/prachub/fetch-images.mjs
// Files: $PRACHUB_DIR/assets/<sha1>.<ext>   Map: parsed/assets-map.json (url -> /content-assets/<file>)
// Resumable: URLs already in the map are skipped; files no longer kept are pruned.
// Only explanatory diagrams are kept. Cover/hero art, promo graphics, testimonials and pasted
// screenshots carry the old site's logo, QR codes or nothing worth keeping (checked by eye);
// the builder drops every image that has no local copy.
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR, PARSED } from './common.mjs';

const ASSETS = join(DIR, 'assets');
const MAP = join(PARSED, 'assets-map.json');
const UA = 'Mozilla/5.0 (compatible; CSWORK-content-migration/1.0; authorized)';
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const KEEP = /^https:\/\/ik\.imagekit\.io\/9osfw19dn\/(cheatsheets\/(concepts|sections)|resources\/diagrams)\//;

/** Image URLs in Markdown (![alt](url "title")) and inline <img src>. */
export function imageUrls(text) {
  const out = [];
  for (const m of text.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) out.push(m[1]);
  return out;
}
export const absolute = (url) =>
  /^https?:\/\//i.test(url) ? url : url.startsWith('//') ? `https:${url}` : url.startsWith('/') ? `https://prachub.com${url}` : null;
/** Every text field that can hold Markdown. */
export const texts = (item) => [item.body, item.extra?.bodyZh, ...(item.extra?.faq || []).map((f) => f.a)].filter(Boolean);

async function main() {
  mkdirSync(ASSETS, { recursive: true });
  const map = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : {};
  for (const url of Object.keys(map)) if (!KEEP.test(absolute(url) || '')) delete map[url];
  const kept = new Set(Object.values(map).map((local) => local.split('/').pop()));
  let pruned = 0;
  for (const name of readdirSync(ASSETS)) {
    if (kept.has(name)) continue;
    unlinkSync(join(ASSETS, name));
    pruned++;
  }
  if (pruned) console.log(`pruned ${pruned} files that are not published`);
  const wanted = new Set();
  for (const file of readdirSync(PARSED).filter((f) => f.endsWith('.jsonl'))) {
    for await (const line of createInterface({ input: createReadStream(join(PARSED, file)), crlfDelay: Infinity })) {
      if (!line.trim()) continue;
      for (const text of texts(JSON.parse(line)))
        for (const url of imageUrls(text)) if (KEEP.test(absolute(url) || '') && !map[url]) wanted.add(url);
    }
  }
  const todo = [...wanted];
  console.log(`images: ${Object.keys(map).length} already local, ${todo.length} to fetch`);
  let i = 0, ok = 0, failed = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (i < todo.length) {
      const url = todo[i++];
      const started = Date.now();
      try {
        const r = await fetch(absolute(url), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
        const type = (r.headers.get('content-type') || '').split(';')[0].trim();
        const bytes = Buffer.from(await r.arrayBuffer());
        if (!r.ok || !TYPES[type] || bytes.length > MAX_BYTES || !bytes.length) throw new Error(`${r.status} ${type} ${bytes.length}B`);
        const name = `${createHash('sha1').update(bytes).digest('hex')}.${TYPES[type]}`;
        if (!existsSync(join(ASSETS, name))) writeFileSync(join(ASSETS, name), bytes);
        map[url] = `/content-assets/${name}`;
        ok++;
      } catch (e) {
        failed++;
        console.log(`failed ${url}: ${e.message}`);
      }
      if ((ok + failed) % 100 === 0) writeFileSync(MAP, JSON.stringify(map, null, 1));
      await sleep(Math.max(0, 500 - (Date.now() - started)));
    }
  }));
  writeFileSync(MAP, JSON.stringify(map, null, 1));
  console.log(`done: fetched ${ok}, failed ${failed}, total local ${Object.keys(map).length}`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) await main();
