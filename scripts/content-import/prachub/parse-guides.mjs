// Company x role interview guides (/interview-guide/<slug>) -> parsed/guides.jsonl (type 'guide', id gd-<slug>).
//   node scripts/content-import/prachub/parse-guides.mjs                  all raw/interview-guide pages
//   node scripts/content-import/prachub/parse-guides.mjs --files a.html   dry run on local pages (.html/.html.gz)
//   node scripts/content-import/prachub/parse-guides.mjs --self-test
// Two page generations:
// - structured (almost all): props.initial.guide (schema 1.3). The body is rebuilt from it in the page's section
//   order: brief, overview, interview process, where candidates lose points, questions with approach / worked
//   solution / follow-ups, practice checklist, behavioral prompts. Hero widgets, stat cards, CTAs, provenance notes,
//   candidate-report excerpts and link lists stay out; the FAQ goes to extra.faq, related guides to relations.
// - initialGuide: stats, rounds, listed questions, FAQ, editorial Markdown; the editorial Markdown is used only
//   when the page renders all of it (else the rendered HTML).
// Second pass: company, role and numbers are masked, each body is fingerprinted, and the share of its
// text that also appears in many other guides (template text) decides extra.boilerplate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, realpathSync, renameSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARSED, jsonLd, meta, sourceUrl } from './common.mjs';
import {
  run, flight, flightOwner, flightEntity, parseHtml, findAll, attr, textOf, toMarkdown, publicBody, debrand, debrandText,
  linkRelations, dedupeRelations, iso, slugify, squash, pageText, str, sentences, tidy, embeddedHtml, fixLinks, dropSections, outsideCode,
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

// In guides "our platform" / "on this platform" is the hiring company speaking (reported questions, job copy), and the
// old site only ever names itself: the shared self-reference rule is masked so only text naming the old site goes.
const unbrand = (md) => debrand(md.replace(/\b([Oo])(?=ur\b)|\b([Tt])(?=his (?:site|platform)\b)/g, '$1$2\uE010')).md.replace(/\uE010/g, '');

/** The first description that survives de-branding, preferring one not cut off, in at most two sentences. */
function summaryOf(candidates) {
  const whole = (s) => /[.!?)"”’]$/.test(s) && !/\.{3,}$/.test(s); // meta descriptions end mid-word or in "......" when cut
  const ok = candidates.map((s) => squash(unbrand(squash(String(s || ''))))).filter((s) => /[\p{L}\p{N}]/u.test(s));
  const best = ok.find(whole) || ok[0];
  if (!best) return null;
  const two = sentences(best).slice(0, 2);
  const t = (two.join('').length > 300 ? two.slice(0, 1) : two).join('').trim(); // a card shows a sentence or two, not a paragraph
  return whole(t) ? t : `${t.replace(/(?:\.{2,}|…)$/, '').replace(/\s+\S*$/, '').replace(/[\s,;:(-]+$/, '')}…`;
}
// "No. It is PracHub's own research …": the shared sentence splitter reads "No." as an abbreviation, so a leading
// yes / no is split off first and survives when the sentence after it goes.
const answer = (s) => unbrand(String(s || '').trim().replace(/^(Yes|No)\.[ \t]+/, '$1.\n')).replace(/^(Yes|No)\.\n/, '$1. ');
const faqOf = (items) => (items || []).map((f) => ({ q: squash(debrandText(String(f?.question || ''))), a: answer(f?.answer) })).filter((f) => f.q && f.a);

// ---------------------------------------------------------------- structured guides (schema 1.3)

const CATEGORY_ORDER = ['coding', 'sql', 'design', 'debugging']; // the page's question filter order; others follow
// The old site's company slug, which the guide slug starts with and experiences / questions use (é -> "-", & -> "and").
const siteSlug = (s) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const IMAGE_LINK = /\]\(https?:\/\/[^)\s]+\.(?:png|jpe?g|gif|webp|svg)\)/i;
const fence = (code, lang) => {
  const f = '`'.repeat(Math.max(3, ...(code.match(/`+/g) || []).map((x) => x.length + 1)));
  return `${f}${lang || ''}\n${code.replace(/\n+$/, '')}\n${f}`;
};

/** Markdown body of a structured guide, in the page's section order; `changed` is set when old-site text went. */
function structuredBody(g) {
  let changed = false;
  // Payload strings are one-line inline Markdown: without old-site sentences, and never read as a heading or list.
  const p = (s) => {
    const t = squash(String(s || ''));
    let u = unbrand(t);
    if (u !== t) changed = true;
    // Links to teaching images, which are not published: the sentence pointing at them (and one leaning on it) goes.
    let cut = false;
    if (IMAGE_LINK.test(u)) u = sentences(u).filter((x) => !(cut = IMAGE_LINK.test(x) || (cut && /^\W*(?:these|this|they|it)\b/i.test(x)))).join('').trim();
    return u.replace(/^(\d+)([.)])(?=\s)/, '$1\\$2').replace(/^([#>+*-])(?=\s)/, '\\$1');
  };
  const list = (xs, ordered) => (xs || []).map(p).filter(Boolean).map((x, i) => `${ordered ? `${i + 1}.` : '-'} ${x}`).join('\n');
  const part = (label, md) => (md ? `**${label}**\n\n${md}` : '');
  const sect = (head, ...parts) => (parts.some(Boolean) ? [head, ...parts] : []);
  const out = [];

  const s60 = g.summary60 || {};
  const note = p(g.loop?.note);
  const brief = [p(s60.companyProduct), p(s60.roleScope), p(s60.roundSummary)].filter((x, i) => x && (i < 2 || x !== note));
  out.push(...sect('## The 60-second brief', ...brief, part('Focus areas', list(s60.focus?.length ? s60.focus : g.hero?.focus))));
  const overview = (g.overview || []).map(p).filter((x) => x && !brief.some((b) => contains(b, x)));
  out.push(...sect('## Overview', ...overview));

  out.push(...sect(`## ${p(g.loop?.title) || 'The interview process'}`, note, ...(g.loop?.steps || []).flatMap((s) =>
    sect(`### ${p(s.name || s.title)}`, p(s.description), part('What to demonstrate', list(s.evaluates)), part('How to prepare', list(s.prepare))))));
  out.push(...sect('## Where candidates lose points', ...(g.losingPoints || []).flatMap((l) => (p(l.failure) ? sect(`### ${p(l.failure)}`, p(l.avoid)) : []))));

  const exercises = new Map((g.workedExercises || []).map((e) => [e.questionId, e]));
  const worked = (e, prompt) => {
    const parts = [!contains(prompt || '', e.prompt || '') && p(e.prompt), list(e.steps, true), e.code ? fence(e.code, e.language) : '',
      p(e.expectedResult) && `**Expected result:** ${p(e.expectedResult)}`, part('Verify it yourself', list(e.checks))].filter(Boolean);
    return parts.length ? [`**Worked solution**${e.durationMinutes ? ` (${e.durationMinutes} min)` : ''}`, ...parts].join('\n\n') : '';
  };
  const card = (q) => {
    const prompt = p(q.prompt);
    const title = squash(debrandText(String(q.title || '')));
    // Card titles are often the prompt cut at ~70 characters: a prompt that short is the heading instead.
    const cut = !title || title === squash(String(q.prompt || '')) || (title.endsWith('…') && String(q.prompt || '').startsWith(title.slice(0, -1)));
    const head = cut && prompt.length <= 200 ? prompt : title;
    const tags = [q.difficulty && cap(q.difficulty), ...(q.topics || []).filter((t) => !/^other topics?$/i.test(t))].filter(Boolean);
    const e = exercises.get(q.id);
    exercises.delete(q.id);
    return head ? sect(`### ${head}`, tags.length ? `*${tags.map(squash).join(' · ')}*` : '', head === prompt ? '' : prompt,
      part('Approach', list(q.approach, true)), e ? worked(e, q.prompt) : '', part('Follow-up', list(q.followUp))) : [];
  };
  // A few pages also list their FAQ entries as question cards ("Q: How long …"): the FAQ shows them already.
  const asked = new Set((g.faq || []).map((f) => norm(String(f?.question || ''))));
  const open = (g.questions || []).filter((q) => !q.locked && !asked.has(norm(String(q.prompt || '').replace(/^Q:\s*/, ''))));
  const rank = (q) => (CATEGORY_ORDER.includes(q.category) ? CATEGORY_ORDER.indexOf(q.category) : CATEGORY_ORDER.length);
  const technical = open.filter((q) => q.category !== 'behavioral').sort((a, b) => rank(a) - rank(b)).flatMap(card);
  const behavioral = open.filter((q) => q.category === 'behavioral');
  const behavioralCards = behavioral.flatMap(card);
  // A worked exercise whose question is not listed is a practice card of its own.
  const orphans = [...exercises.values()].flatMap((e) => (p(e.title) ? sect(`### ${p(e.title)}`, worked(e, '')) : []));
  out.push(...sect('## Questions & practice', ...technical, ...orphans));

  const days = (g.plan?.days || []).flatMap((d) => {
    const tasks = list(d.tasks);
    const deliverable = p(d.deliverable);
    return tasks || deliverable ? [`**Day ${d.day}${p(d.title) ? ` — ${p(d.title)}` : ''}**`, tasks, deliverable && `*Deliverable:* ${deliverable}`] : [];
  });
  out.push(...sect('## Suggested practice checklist', ...(days.length ? [p(g.plan.description), ...days] : [])));

  // The page lists every behavioral prompt after the cards; the ones without a card are listed here once.
  const carded = new Set(behavioral.map((q) => squash(String(q.prompt || ''))));
  const prompts = list((g.behavioral?.prompts || []).filter((x) => !carded.has(squash(String(x)))), true);
  out.push(...sect(`## ${p(g.behavioral?.title) || 'Behavioral questions'}`, p(g.behavioral?.intro), prompts, ...behavioralCards));
  return { md: out.filter(Boolean).join('\n\n'), changed };
}

/** Item for a structured guide page (`props` holds initial.guide, related and sibling guides, candidate reports). */
function structured(html, slug, props, count) {
  const g = props.initial.guide;
  const company = str(g.hero?.company);
  const role = str(g.hero?.position);
  const ld = jsonLd(html).find((x) => /Article/.test(String(x['@type']))) || {};
  const b = structuredBody(g);
  const body = tidy(b.md);
  if (b.changed) count('debranded');
  count('structured');
  const questions = (g.questions || []).filter((q) => !q.locked);
  const mix = { easy: 0, medium: 0, hard: 0, unknown: 0, total: questions.length };
  for (const q of questions) mix[['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'unknown']++;
  const topics = {};
  for (const q of questions) topics[q.category] = (topics[q.category] || 0) + 1;
  return {
    item: {
      id: `gd-${slug}`, type: 'guide', slug, title: squash(debrandText(String(str(g.hero?.title) || str(ld.headline) || slug))),
      // The meta description always describes the guide; the hero summary is often the job description's opening.
      summary: summaryOf([meta(html, 'description'), g.discovery?.description, g.hero?.summary]), body,
      company: company ? { slug: siteSlug(company) || slugify(company), name: company } : null,
      role, category: null, difficulty: null, round: null, seniority: null, tags: [],
      publishedAt: iso(ld.datePublished), updatedAt: iso(ld.dateModified) || iso(g.publication?.modifiedAt) || iso(g.updatedAt),
      relations: dedupeRelations([
        ...[...(props.siblingGuides || []), ...(props.relatedGuides || [])].map((x) => ({ kind: 'guide', slug: x?.slug, title: x?.title })),
        // Candidate reports are linked, never quoted: their excerpts are personal accounts.
        ...(props.experiences || []).map((x) => ({ kind: 'experience', slug: String(x?.href || '').split(/[?#]/)[0].split('/').filter(Boolean).pop(), title: x?.title })),
        ...linkRelations(body),
      ], { kind: 'guide', slug }),
      extra: {
        stats: {
          questions: num(g.hero?.stats?.companyQuestionCount?.value),
          rounds: (g.loop?.steps || []).map((s) => ({ name: squash(String(s.name || s.title || '')), questions: null })).filter((r) => r.name),
          difficulty: mix.total ? mix : null,
          topics: Object.entries(topics).map(([name, n]) => ({ name, questions: n })),
          experiences: num(g.hero?.stats?.experienceCount?.value),
          typicalPrep: null,
          readingTime: num(g.summary60?.readingMinutes),
        },
        faq: faqOf(g.faq),
      },
      sourceUrl: sourceUrl('interview-guide', slug), partial: questions.length < (g.questions || []).length,
    },
  };
}

// ---------------------------------------------------------------- initialGuide pages

const FAQ_HEAD = /^(?:\d+\.\s*)?(?:FAQs?|Frequently asked questions)$/i;

function parse(html, slug, count) {
  if (slug === '_index') return { skip: 'index' }; // the guide listing page
  const rows = flight(html);
  const props = flightOwner(rows, 'initialGuide') || flightOwner(rows, 'relatedGuides') || {};
  if (props.initial?.guide?.hero) return structured(html, slug, props, count);
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
  let faq = faqOf(g.faq_items);
  // Embedded HTML (diagram SVGs, video iframes) shows as text: rewritten as Markdown. Page navigation ("12 · FAQ",
  // "Back to all six questions ↑", "Open the full-size diagram" of a dropped image), the closing link list and a FAQ
  // that repeats extra.faq (rendered pages keep only its answers) go; a FAQ entry the body already asks goes from extra.faq.
  editorial = dropSections(outsideCode(fixLinks(embeddedHtml(tidy(editorial))), (t) => t
    .replace(/^\d{1,2} · [A-Z][\w &/-]*$|^(?![-*+>|#\s])[^\n[\]]*[→↑↓]$|^\[[^\]\n]*\]\(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg)\)$/gm, '')), /^keep practi[cs]ing$/i);
  if (faq.some((f) => editorial.includes(f.q) || contains(editorial, f.a))) editorial = dropSections(editorial, FAQ_HEAD);
  faq = faq.filter((f) => !editorial.includes(f.q));

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
  const who = [company, role].filter(Boolean).join(' ');
  const out = overviewMd && !contains(editorial, overviewMd) ? [unbrand(overviewMd)] : [];
  // Without a company the page's heading reads "Interviewing at" with nothing after it: no company stats block then.
  if (company) {
    const facts = [['Practice bank', stats.questions && `${stats.questions}+ questions`], ['Rounds', stats.rounds.length],
      ['Typical prep', stats.typicalPrep], ['Interview reports', stats.experiences]].filter(([, v]) => v);
    if (facts.length) out.push(facts.map(([k, v]) => `- **${k}:** ${v}`).join('\n'));
    if (stats.rounds.length) out.push('### Interview rounds', table(['Round', 'Questions'], stats.rounds.map((r) => [r.name, r.questions])));
    if (out.length) out.unshift(`## ${heading('overview') || `Interviewing at ${company}`}`);
  }
  if (stats.difficulty)
    out.push(`## ${heading('difficulty') || `How hard is the ${who ? `${who} ` : ''}interview?`}`,
      table(['Difficulty', 'Share', 'Questions'], ['Easy', 'Medium', 'Hard'].map((k) => [k, pct(stats.difficulty[k.toLowerCase()], stats.difficulty.total), stats.difficulty[k.toLowerCase()]])));
  if (stats.topics.length)
    out.push(`## ${heading('topics') || `What ${company || 'the interview'} actually tests for`}`,
      table(['Topic', 'Share', 'Questions'], stats.topics.map((t) => [t.name, pct(t.questions, stats.questions || stats.topics.reduce((a, x) => a + x.questions, 0)), t.questions])));
  const d = unbrand(editorial);
  if (squash(d) !== squash(editorial)) count('debranded');
  if (pub.source === 'html') count('htmlBody');
  const body = [...out, d].filter(Boolean).join('\n\n');

  const crumbs = jsonLd(html).find((x) => x['@type'] === 'BreadcrumbList')?.itemListElement || [];
  const companySlug = crumbs.map((x) => /\/companies\/([^/?#]+)/.exec(String(x?.item || ''))?.[1]).find(Boolean);
  const listed = [...(g.sample_questions || []), ...Object.values(g.questions_by_round || {}).flatMap((byCat) => Object.values(byCat || {}).flat())];
  const level = String(g.difficulty_level || '').toLowerCase();
  return {
    item: {
      id: `gd-${slug}`, type: 'guide', slug, title: squash(debrandText(String(g.title || slug))),
      summary: summaryOf([g.meta_description, g.seo_summary, meta(html, 'description')]), body,
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
      extra: { stats, faq },
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

  const note = 'PracHub has no confirmed round sequence for Acme. Treat the sections below as preparation areas.';
  const guide = {
    summary60: { companyProduct: 'Acme builds ledgers.', roleScope: 'Expect SQL.', roundSummary: note, focus: ['Idempotent writes', 'Keyset paging'] },
    overview: ['Acme builds ledgers.', '1. Engineers own services.'],
    loop: { title: 'The Acme interview process', note, steps: [{ name: 'Screen', description: 'A call.', evaluates: ['Fit'], prepare: ["Drill PracHub's SQL set.", 'List constraints.'] }] },
    losingPoints: [{ failure: 'Guessing', avoid: 'Measure first. Visuals: [trace](https://cdn.example/t.png). These are fictional.' }],
    faq: [{ question: 'How long is the process?', answer: 'Weeks.' }],
    questions: [
      { id: 'q1', category: 'design', difficulty: 'hard', topics: ['other topics'], title: 'Design a feed for our pl…', prompt: 'Design a feed for our platform.', approach: ['Size it.'], followUp: ['Scale?'] },
      { id: 'q2', category: 'coding', difficulty: 'easy', topics: ['heaps'], title: 'Top K', prompt: 'Return the k largest values.', approach: [], followUp: [] },
      { id: 'q3', category: 'behavioral', difficulty: 'medium', topics: [], title: 'A conflict', prompt: 'Tell me about a conflict.', approach: ['Name it.'], followUp: [] },
      { id: 'q5', category: 'debugging', difficulty: 'easy', title: 'Why is it slow? Walk through the first thing to measure and what each…', prompt: 'Why is it slow? Walk through the first thing to measure and what each result would tell you about the cause, then how you would confirm the fix under the same load before you close the incident and write it up for the team in a short note.', approach: [], followUp: [] },
      { id: 'q4', category: 'coding', locked: true, title: 'Locked', prompt: 'Hidden.' },
      { id: 'q6', category: 'design', title: 'Q: How long is the process?', prompt: 'Q: How long is the process?', approach: ['Clarify.'] },
    ],
    workedExercises: [{ questionId: 'q2', durationMinutes: 20, prompt: 'Return the k largest values.', steps: ['Use a min-heap of size k.'], code: 'heapq.nlargest(k, xs)', language: 'python', expectedResult: 'O(n log k).', checks: ['k = 0 returns [].'] }],
    plan: { description: 'One week.', days: [{ day: 1, title: 'PracHub drills', tasks: ['Run the PracHub drill.', 'Write a heap.'], deliverable: 'A heap.' }] },
    behavioral: { title: 'Behavioural preparation', intro: 'Bring stories.', prompts: ['Tell me about a conflict.', 'Why us?'] },
  };
  const md = structuredBody(guide);
  assert.equal(md.changed, true);
  assert.equal(md.md, ['## The 60-second brief', 'Acme builds ledgers.', 'Expect SQL.', '**Focus areas**', '- Idempotent writes\n- Keyset paging',
    '## Overview', '1\\. Engineers own services.', '## The Acme interview process', 'Treat the sections below as preparation areas.',
    '### Screen', 'A call.', '**What to demonstrate**', '- Fit', '**How to prepare**', '- List constraints.',
    '## Where candidates lose points', '### Guessing', 'Measure first.',
    '## Questions & practice', '### Top K', '*Easy · heaps*', 'Return the k largest values.', '**Worked solution** (20 min)', '1. Use a min-heap of size k.',
    '```python\nheapq.nlargest(k, xs)\n```', '**Expected result:** O(n log k).', '**Verify it yourself**', '- k = 0 returns [].',
    '### Design a feed for our platform.', '*Hard*', '**Approach**', '1. Size it.', '**Follow-up**', '- Scale?',
    '### Why is it slow? Walk through the first thing to measure and what each…', '*Easy*', guide.questions[3].prompt,
    '## Suggested practice checklist', 'One week.', '**Day 1**', '- Write a heap.', '*Deliverable:* A heap.',
    '## Behavioural preparation', 'Bring stories.', '1. Why us?', '### A conflict', '*Medium*', 'Tell me about a conflict.', '**Approach**', '1. Name it.'].join('\n\n'));
  assert.equal(summaryOf(['Prep for Acme: drills and a plan that stops mid', 'A guide to the Acme loop. It covers rounds. It ends with a plan.']), 'A guide to the Acme loop. It covers rounds.');
  assert.equal(summaryOf(['Covers the flow (screen, onsite, and......']), 'Covers the flow (screen, onsite…');
  assert.equal(answer("No. It is PracHub's own research for Acme. Rounds vary."), 'No. Rounds vary.');
  assert.equal(siteSlug('Société Générale & Co.'), 'soci-t-g-n-rale-and-co');
  console.log('self-test ok');
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test') selfTest();
  else run({ rawType: 'interview-guide', name: 'guides', parse, finish: boilerplate, write: writeStreamed });
}
