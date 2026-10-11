// Interview concepts (/concepts/<slug>) -> parsed/concepts.jsonl (type 'concept', id cp-<slug>).
//   node scripts/content-import/prachub/parse-concepts.mjs                  all raw/concepts pages
//   node scripts/content-import/prachub/parse-concepts.mjs --files a.html   dry run on local pages (.html/.html.gz)
// Body: the payload Markdown when the page renders all of it, else the rendered content converted to
// Markdown; headings keep the section structure. The "Practice these" / "Related concepts" card lists
// become relations instead of body text. The run report counts section headings across all concepts.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sourceUrl } from './common.mjs';
import {
  run, flight, flightEntity, parseHtml, contentRoot, publicBody, debrand, dropSections, dropLeadIn,
  anchorRelations, linkRelations, dedupeRelations, pageBasics, str, MIN_BODY,
} from './parse-articles.mjs';

const LISTS = /^(?:practice (?:these|questions|this concept)|related (?:concepts|questions))\b/i;

function parse(html, slug, count) {
  const e = flightEntity(flight(html), slug) || {};
  if (e.is_locked === true) return { skip: 'locked' };
  const doc = parseHtml(html);
  const b = pageBasics(html, e);
  const title = b.title.replace(/\s+Tech Interview Concept$/i, '') || slug;
  const pub = publicBody(html, e, contentRoot(html, doc));
  const d = debrand(dropLeadIn(dropSections(pub.md, LISTS), title));
  if (d.md.length < MIN_BODY) return { skip: pub.partial ? 'locked' : 'empty' };
  if (d.changed) count('debranded');
  if (pub.source === 'html') count('htmlBody');
  return {
    item: {
      id: `cp-${slug}`, type: 'concept', slug, title, summary: b.summary, body: d.md,
      company: null, role: str(e.position) || str(e.role), category: str(e.category), difficulty: null, round: null, seniority: null,
      tags: b.tags, publishedAt: b.publishedAt, updatedAt: b.updatedAt,
      relations: dedupeRelations([...anchorRelations(doc, ['concept', 'question']), ...linkRelations(d.md)], { kind: 'concept', slug }),
      extra: {},
      sourceUrl: sourceUrl('concepts', slug), partial: pub.partial,
    },
  };
}

/** How often each `##` heading occurs: concepts should share a fixed set of sections. */
function sectionReport(items, stats) {
  const n = {};
  for (const it of items) for (const h of new Set(it.body.match(/^## .+$/gm) || [])) n[h.slice(3)] = (n[h.slice(3)] || 0) + 1;
  stats.sections = Object.fromEntries(Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 15));
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  run({ rawType: 'concepts', name: 'concepts', parse, finish: sectionReport });
