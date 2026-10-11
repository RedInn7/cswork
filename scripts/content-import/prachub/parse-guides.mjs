// Company x role interview guides (/interview-guide/<slug>) -> parsed/guides.jsonl (type 'guide', id gd-<slug>).
//   node scripts/content-import/prachub/parse-guides.mjs                  all raw/interview-guide pages
//   node scripts/content-import/prachub/parse-guides.mjs --files a.html   dry run on local pages (.html/.html.gz)
//   node scripts/content-import/prachub/parse-guides.mjs --self-test
// Source: the page's initialGuide payload (stats, rounds, listed questions, FAQ, editorial Markdown);
// the editorial Markdown is used only when the page renders all of it (else the rendered HTML).
// Second pass: company, role and numbers are masked, each body is fingerprinted, and the share of its
// text that also appears in many other guides (template text) decides extra.boilerplate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, realpathSync, renameSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARSED, jsonLd, sourceUrl } from './common.mjs';
import {
  run, flight, flightOwner, flightEntity, parseHtml, findAll, attr, textOf, toMarkdown, publicBody, debrand, debrandText,
  linkRelations, dedupeRelations, iso, slugify, squash, pageText, str,
} from './parse-articles.mjs';

// Funnel order of interview rounds (the payload lists them alphabetically); unknown rounds keep payload order.
const ROUND_ORDER = ['HR Screen', 'Recruiter Screen', 'Phone Screen', 'Online Assessment', 'Take-home', 'Take Home',
  'Technical Screen', 'Onsite', 'Final Round', 'Team Match'];
// Page sections drawn from payload data (rebuilt as tables below) or link lists (kept as relations).
const DATA_SECTIONS = new Set(['overview', 'difficulty', 'topics', 'question-bank', 'faq-items', 'related-guides']);

const num = (v) => (Number.isFinite(v) ? v : null);
const pct = (n, total) => `${total ? Math.round((n / total) * 100) : 0}%`;
const table = (head, rows) => [head, head.map(() => '---'), ...rows].map((r) => `| ${r.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n');
const norm = (s) => squash(s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' '));
/** True when the opening words of `part` already occur in `md`. */
const contains = (md, part) => norm(md).includes(norm(part).split(' ').slice(0, 10).join(' '));

function parse(html, slug, count) {
  const rows = flight(html);
  const props = flightOwner(rows, 'initialGuide') || {};
  // Another guide variant may name the prop differently: the richest payload object with this slug.
  const g = props.initialGuide || flightEntity(rows, slug);
  if (!g) throw new Error('no guide payload');
  if (g.is_published === false) return { skip: 'unpublished' };
  const doc = parseHtml(html);

  // Editorial part: the guide article plus any section the page does not draw from stats data.
  const nodes = findAll(doc, (n) => n.tag === 'article' || (n.tag === 'section' && !DATA_SECTIONS.has(attr(n, 'aria-labelledby'))));
  const extraSections = nodes.filter((n) => n.tag === 'section');
  const pub = publicBody(html, g, { tag: '#root', attrs: '', kids: nodes });
  let editorial = pub.md;
  if (pub.source === 'payload')
    for (const s of extraSections) {
      const md = toMarkdown(s).md;
      if (md && !contains(editorial, md)) editorial += `\n\n${md}`;
    }
  if (!editorial && pub.partial) return { skip: 'locked' };

  const sections = findAll(doc, (n) => n.tag === 'section');
  const section = (id) => sections.find((s) => attr(s, 'aria-labelledby') === id);
  const heading = (id) => {
    const h = section(id) && findAll(section(id), (n) => n.tag === 'h2')[0];
    return h ? squash(textOf(h)) : null;
  };
  // The overview paragraph usually repeats the editorial intro; keep it only when it does not.
  const overview = section('overview');
  const overviewMd = overview ? toMarkdown({ tag: '#root', attrs: '', kids: overview.kids.filter((k) => k.tag === 'p') }).md : '';

  const bank = Object.keys(g.round_counts_bank || {}).length ? g.round_counts_bank : g.round_counts || {};
  const rank = (r) => (ROUND_ORDER.includes(r) ? ROUND_ORDER.indexOf(r) : ROUND_ORDER.length);
  const mix = g.difficulty_mix || {};
  const prep = /Typical prep<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/.exec(html);
  const stats = {
    questions: num(g.total_question_count),
    rounds: Object.entries(bank).filter(([, n]) => Number.isFinite(n)).sort(([a], [b]) => rank(a) - rank(b)).map(([name, questions]) => ({ name, questions })),
    difficulty: mix.total ? { easy: mix.easy ?? 0, medium: mix.medium ?? 0, hard: mix.hard ?? 0, unknown: mix.unknown ?? 0, total: mix.total } : null,
    topics: (g.category_counts || []).filter((c) => c?.category).map((c) => ({ name: c.category, questions: c.count ?? 0 })),
    experiences: num(g.experience_count),
    typicalPrep: prep ? squash(pageText(prep[1])) || null : null,
    readingTime: num(g.reading_time),
  };

  const company = str(g.company);
  const role = str(g.position);
  const out = [`## ${heading('overview') || `Interviewing at ${company}`}`];
  if (overviewMd && !contains(editorial, overviewMd)) out.push(debrand(overviewMd).md);
  const facts = [['Practice bank', stats.questions && `${stats.questions}+ questions`], ['Rounds', stats.rounds.length],
    ['Typical prep', stats.typicalPrep], ['Interview reports', stats.experiences]].filter(([, v]) => v);
  if (facts.length) out.push(facts.map(([k, v]) => `- **${k}:** ${v}`).join('\n'));
  if (stats.rounds.length) out.push('### Interview rounds', table(['Round', 'Questions'], stats.rounds.map((r) => [r.name, r.questions])));
  if (stats.difficulty)
    out.push(`## ${heading('difficulty') || `How hard is the ${company} ${role} interview?`}`,
      table(['Difficulty', 'Share', 'Questions'], ['Easy', 'Medium', 'Hard'].map((k) => [k, pct(stats.difficulty[k.toLowerCase()], stats.difficulty.total), stats.difficulty[k.toLowerCase()]])));
  if (stats.topics.length)
    out.push(`## ${heading('topics') || `What ${company} actually tests for`}`,
      table(['Topic', 'Share', 'Questions'], stats.topics.map((t) => [t.name, pct(t.questions, stats.questions || stats.topics.reduce((a, x) => a + x.questions, 0)), t.questions])));
  const d = debrand(editorial);
  if (d.changed) count('debranded');
  if (pub.source === 'html') count('htmlBody');
  const body = [...out, d.md].filter(Boolean).join('\n\n');

  const crumbs = jsonLd(html).find((x) => x['@type'] === 'BreadcrumbList')?.itemListElement || [];
  const companySlug = crumbs.map((x) => /\/companies\/([^/?#]+)/.exec(String(x?.item || ''))?.[1]).find(Boolean);
  const listed = [...(g.sample_questions || []), ...Object.values(g.questions_by_round || {}).flatMap((byCat) => Object.values(byCat || {}).flat())];
  const level = String(g.difficulty_level || '').toLowerCase();
  return {
    item: {
      id: `gd-${slug}`, type: 'guide', slug, title: squash(debrandText(String(g.title || slug))),
      summary: squash(debrandText(String(g.meta_description || g.seo_summary || ''))) || null, body,
      company: company ? { slug: companySlug || slugify(company), name: company } : null,
      role, category: null, difficulty: ['easy', 'medium', 'hard'].includes(level) ? level : null, round: null, seniority: null,
      tags: [...new Set((g.tags || []).map((t) => squash(String(t))).filter((t) => t && !/prachub/i.test(t)))],
      publishedAt: iso(g.first_published_at) || iso(g.created_at), updatedAt: iso(g.content_updated_at) || iso(g.updated_at),
      relations: dedupeRelations([
        ...listed.map((q) => ({ kind: 'question', slug: q?.slug, title: q?.title })),
        ...[...(g.sibling_guides || []), ...(props.relatedGuides || [])].map((x) => ({ kind: 'guide', slug: x?.slug, title: x?.title })),
        ...(g.experiences || []).map((x) => ({ kind: 'experience', slug: String(x?.href || '').split(/[?#]/)[0].split('/').filter(Boolean).pop(), title: x?.title })),
        ...linkRelations(body),
      ], { kind: 'guide', slug }),
      extra: {
        stats,
        faq: (g.faq_items || []).map((f) => ({ q: squash(debrandText(String(f?.question || ''))), a: debrandText(String(f?.answer || '')).trim() })).filter((f) => f.q && f.a),
      },
      sourceUrl: sourceUrl('interview-guide', slug), partial: pub.partial,
    },
  };
}

// ---------------------------------------------------------------- boilerplate analysis

const SHINGLE = 5; // words
const MIN_GUIDES = 50; // fewer guides cannot separate template text from content
const TEMPLATE_DF = 0.005; // a 5-gram seen in >= 0.5% of guides (min 10) is template text
// ponytail: calibration knob, judged on the templateShare histogram once all ~11k guides are parsed.
const BOILERPLATE_SHARE = 0.7;
const ROLE_SHORT = { 'software engineer': ['swe'], 'machine learning engineer': ['mle', 'ml engineer'], 'data scientist': ['ds'],
  'data engineer': ['de'], 'product manager': ['pm'] };
const CORP = /\s+(?:inc|llc|ltd|corp|corporation|co|company|group|technologies|technology|labs|holdings)\.?$/;

/** Body words, lower-cased, with company / role names masked and digits collapsed. */
function maskedWords(body, company, role) {
  let s = ` ${body.toLowerCase()} `;
  const names = new Set();
  const c = company?.toLowerCase();
  if (c) names.add(c).add(c.replace(/^the\s+/, '')).add(c.replace(CORP, ''));
  if (role) for (const x of [role.toLowerCase(), ...(ROLE_SHORT[role.toLowerCase()] || [])]) names.add(x);
  for (const n of [...names].filter((x) => x.trim().length > 1).sort((a, b) => b.length - a.length))
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'gu'), ' \uE001 ');
  return (s.match(/[\p{L}\p{N}\uE001]+/gu) || []).map((w) => w.replace(/\p{N}+/gu, '0'));
}
const fnv = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};
/** Distinct 5-gram hashes, 1-in-4 sampled (enough for a share estimate, 4x less memory). */
function sampledShingles(w) {
  const wh = w.map(fnv);
  const set = new Set();
  for (let i = 0; i + SHINGLE <= wh.length; i++) {
    let h = 0x811c9dc5;
    for (let j = i; j < i + SHINGLE; j++) h = Math.imul(h ^ wh[j], 0x01000193);
    if (((h >>> 0) & 3) === 0) set.add(h >>> 0);
  }
  return Uint32Array.from(set);
}
const family = (slug) => /-interview-questions-guide-\d{4}$/.test(slug) ? 'questions-guide-YYYY' : /-interview-guide-\d{4}$/.test(slug) ? 'guide-YYYY'
  : slug.endsWith('-interview-guide') ? 'guide' : 'other';

/** extra.fingerprint (masked-body hash), extra.templateShare and extra.boilerplate, plus a corpus report. */
export function boilerplate(items, stats) {
  const sets = items.map((it) => {
    const w = maskedWords(it.body, it.company?.name, it.role);
    it.extra.fingerprint = createHash('sha1').update(w.join(' ')).digest('hex').slice(0, 16);
    return sampledShingles(w);
  });
  const enough = items.length >= MIN_GUIDES;
  const df = new Uint16Array(1 << 24); // ponytail: hashed counters; collisions only matter near minDf
  for (const set of sets) for (const h of set) if (df[h >>> 8] < 65535) df[h >>> 8]++;
  const minDf = Math.max(10, Math.ceil(items.length * TEMPLATE_DF));
  const report = { guides: items.length, minDf, threshold: BOILERPLATE_SHARE, boilerplate: 0, substantive: 0, histogram: {}, byFamily: {} };
  items.forEach((it, i) => {
    const share = sets[i].length ? sets[i].filter((h) => df[h >>> 8] >= minDf).length / sets[i].length : 1;
    it.extra.templateShare = enough ? Math.round(share * 100) / 100 : null;
    it.extra.boilerplate = enough ? share >= BOILERPLATE_SHARE : null;
    if (!enough) return;
    report[it.extra.boilerplate ? 'boilerplate' : 'substantive']++;
    const bucket = `${(Math.min(9, Math.floor(share * 10)) / 10).toFixed(1)}+`;
    report.histogram[bucket] = (report.histogram[bucket] || 0) + 1;
    const f = (report.byFamily[family(it.slug)] ||= { guides: 0, boilerplate: 0 });
    f.guides++;
    f.boilerplate += it.extra.boilerplate ? 1 : 0;
  });
  if (!enough) report.note = `fewer than ${MIN_GUIDES} guides: templateShare/boilerplate left null`;
  const groups = {};
  for (const it of items) groups[it.extra.fingerprint] = (groups[it.extra.fingerprint] || 0) + 1;
  const dup = Object.values(groups).filter((n) => n > 1);
  Object.assign(report, { identicalAfterMasking: { groups: dup.length, guides: dup.reduce((a, n) => a + n, 0), largest: Math.max(0, ...dup) } });
  report.histogram = Object.fromEntries(Object.entries(report.histogram).sort(([a], [b]) => a.localeCompare(b)));
  stats.boilerplate = report;
}

/**
 * Byte-for-byte common.writeJsonl output (sorted by id, one object per line), written line by line:
 * writeJsonl holds the whole file three times in memory, which overran the 2.2 GB default heap in an
 * 11k-guide trial run.
 */
export function writeStreamed(name, items) {
  mkdirSync(PARSED, { recursive: true });
  const path = join(PARSED, `${name}.jsonl`);
  const fd = openSync(`${path}.tmp`, 'w');
  [...items].sort((a, b) => a.id.localeCompare(b.id)).forEach((it, i) => writeSync(fd, `${i ? '\n' : ''}${JSON.stringify(it)}`));
  writeSync(fd, '\n');
  closeSync(fd);
  renameSync(`${path}.tmp`, path);
  return items.length;
}

function selfTest() {
  let seed = 7;
  const word = () => ((seed = (seed * 48271) % 2147483647) % 99999).toString(36).replace(/\d/g, (d) => 'ghijklmnop'[d]);
  const unique = Array.from({ length: 6000 }, word).join(' '); // letters only: digits are masked
  const template = (c) => `## Interviewing at ${c}\n\n${c} interviews start with a recruiter call. `
    + Array.from({ length: 300 }, (_, i) => `step ${i} of the ${c} software engineer loop covers topic ${i % 17}`).join('. ');
  const items = Array.from({ length: 60 }, (_, i) => ({ slug: `c${i}-software-engineer-interview-questions-guide-2026`,
    body: template(`Company${i}`) + (i === 0 ? `\n\n${unique}` : ''), company: { name: `Company${i}` }, role: 'Software Engineer', extra: {} }));
  const stats = {};
  boilerplate(items, stats);
  assert.equal(items[1].extra.boilerplate, true);
  assert.equal(items[0].extra.boilerplate, false);
  assert.equal(items[1].extra.fingerprint, items[2].extra.fingerprint); // identical apart from the company name
  assert.equal(stats.boilerplate.boilerplate, 59);
  assert.deepEqual(maskedWords("Stripe's SWE loop: 4 rounds", 'Stripe', 'Software Engineer'), ['\uE001', 's', '\uE001', 'loop', '0', 'rounds']);
  console.log('self-test ok');
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test') selfTest();
  else run({ rawType: 'interview-guide', name: 'guides', parse, finish: boilerplate, write: writeStreamed });
}
