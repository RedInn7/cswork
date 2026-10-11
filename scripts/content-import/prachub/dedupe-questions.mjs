// Find PracHub questions CSWORK already has, so they are not imported twice:
//   oa      -> content/oa-master/catalog.json        (OA problems by company; statement text)
//   library -> $PRACHUB_DIR/ref/study_library.json    (LeetCode library; titles only)
//   prachub -> another parsed PracHub question         (coding vs interview copy, or a re-post under another slug)
// Output: parsed/question-dupes.json        [{id, dupOf:{kind,id,title,problem?}, score, method}]  problem = judge problem id  confident: skip `id`
//         parsed/question-dupes-review.json [{id, title, candidate:{kind,id,title}, score, text, title, company, reason}]
//   node dedupe-questions.mjs                                   write both files
//   node dedupe-questions.mjs --check                           self-check of the matching helpers
//   node dedupe-questions.mjs --sample <oa|prachub|library> [same|different|unknown|all] [lo hi]
//                                                               print candidate pairs (threshold calibration)
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIR, PARSED } from './common.mjs';

const OA_CATALOG = fileURLToPath(new URL('../../../content/oa-master/catalog.json', import.meta.url));
const LIBRARY = join(DIR, 'ref', 'study_library.json');
// Calibrated by reading ~110 candidate pairs (--sample), see the report. text/title = TF-IDF cosine of statements/titles.
// Same-company OA pairs >= 0.5 were all the same problem (paraphrased, often with unrelated titles); below that variants
// and multi-problem "bundles" appear. PracHub re-posts of one company share datasets (SQL) and settings ("valid sudoku" vs
// "solve sudoku" = 0.60, "islands" vs "islands II" = 0.66, "directed cycles" vs "directed paths" = 0.63 with title 0.87),
// so they need a higher text score plus a related title; coding-vs-interview copies of one question (0.45-0.65) go to review.
const T = {
  oaSame: 0.5, oaUnknown: 0.6, crossCompany: 0.9, // auto, by company relation
  phText: 0.7, phTitle: 0.3, // PracHub re-post: same company, both
  libTitle: 0.95, libGap: 0.03, libRefCover: 0.6, // LeetCode: near-identical unambiguous title, or explicit reference + title about it
  reviewOa: 0.35, reviewPh: 0.45, reviewCross: 0.6, reviewCrossPh: 0.8, reviewLib: 0.75,
};

const STOP = new Set(('a an and are as at be by for from has have in is it its of on or that the this to was were will with you your ' +
  'given return returns each which can should must if not no all any one two into than then there their they we our may ' +
  'example examples input output constraints explanation note following need write implement function design using use').split(' '));
const tokens = (s) => (s.toLowerCase().match(/[a-z0-9_]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w));
const titleTokens = (s) => tokens(s).map((w) => (w.length > 3 && /[^su]s$/.test(w) ? w.slice(0, -1) : w)); // "fees" ~ "fee"
const TASK = new Set('solve compute find check determine return calculate get handle process optimize analyze apply perform algorithm problem question leetcode lc efficient efficiently'.split(' '));
/** Share of the question title (task verbs aside) found in the LeetCode title: "right side view and local minimum" vs "Binary Tree Right Side View" = 0.5. */
const coverage = (title, libTitle) => {
  const own = titleTokens(title).filter((w) => !TASK.has(w)), lc = new Set(titleTokens(libTitle));
  return own.length ? own.filter((w) => lc.has(w)).length / own.length : 0;
};
// Two bundles are only the same question when they reference the same LeetCode problems.
const sameRefs = (a, b) => a.refs.length > 1 && a.refs.length === b.refs.length && a.refs.every((r) => b.refs.includes(r));
const GENERIC = new Set(['group', 'inc', 'llc', 'corp', 'corporation', 'labs', 'technologies', 'technology', 'tech', 'capital', 'trading',
  'securities', 'international', 'networks', 'health', 'frontend', 'mern', 'chase', 'ai', 'co', 'company', 'holdings', 'systems']);
function normCompany(name) {
  const w = (name || '').toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) || [];
  if (w[0] === 'the') w.shift();
  while (w.length > 1 && GENERIC.has(w.at(-1))) w.pop();
  const c = w.join('');
  return c && c !== 'unknown' ? c : null;
}
// "F5" ~ "F5Networks", "J.P. Morgan" ~ "JPMorgan Chase": one normalised name a prefix of the other is the same company.
const companyRel = (a, b) => (!a.company || !b.company ? 'unknown'
  : a.company.startsWith(b.company) || b.company.startsWith(a.company) ? 'same' : 'different');
/** Statement text used for similarity: drop the spoiler sections parse-questions.mjs writes (hints, approach, solution). */
const statementOf = (body) => body
  .split(/^(?=## )/m).filter((sec) => !sec.startsWith('## Solution\n')) // the solution may hold demoted ### headings
  .flatMap((sec) => sec.split(/^(?=### )/m)).filter((sec) => !/^### (Hints|Approach|Solution)\n/.test(sec)).join('\n')
  .replace(/^> \*\*Hint[^\n]*(\n>.*)*/gm, ' ')
  .replace(/[#*`|>_-]+/g, ' ');
/**
 * Several independent problems in one item ("two independent problems", Problem/Task 2, Part B, "Solve X and Y" with parts):
 * never a pure duplicate of one OA/LeetCode problem. Numbered "Part 2" alone is a follow-up of the same problem.
 */
const bundle = (title, statement, parts, refs) => refs > 1 || (parts > 1 && /,|&|\band\b/i.test(title))
  || /\b(two|three|four|five|[2-5])\s+(?:independent\s+|separate\s+|distinct\s+|different\s+|unrelated\s+)?(?:coding\s+)?(problems|questions|tasks|exercises)\b/i.test(statement)
  || /(^|\n)[#*\s]*((problem|task|question)\s*(2|b|ii)|part\s*(b|ii))\b/i.test(statement);

/** L2-normalised sublinear TF-IDF vectors for a list of token arrays. */
function tfidf(docsTokens) {
  const df = new Map();
  for (const toks of docsTokens) for (const t of new Set(toks)) df.set(t, (df.get(t) || 0) + 1);
  const n = docsTokens.length;
  return docsTokens.map((toks) => {
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    const v = new Map();
    let norm = 0;
    for (const [t, c] of tf) {
      const w = (1 + Math.log(c)) * Math.log(1 + n / df.get(t));
      v.set(t, w);
      norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [t, w] of v) v.set(t, w / norm);
    return v;
  });
}
function cosine(a, b) {
  if (a.size > b.size) [a, b] = [b, a];
  let s = 0;
  for (const [t, w] of a) s += w * (b.get(t) || 0);
  return s;
}
/** Candidate pairs via an inverted index over the k heaviest terms of each vector (near-duplicates share rare terms). */
// ponytail: top-k terms and 8 candidates per query; raise k/perQuery if an item has more near-copies than that.
function candidates(vecs, isTarget, isQuery, k = 40, perQuery = 8) {
  const top = (v) => [...v].sort((x, y) => y[1] - x[1]).slice(0, k);
  const index = new Map();
  vecs.forEach((v, i) => { if (isTarget(i)) for (const [t] of top(v)) (index.get(t) || index.set(t, []).get(t)).push(i); });
  const out = [];
  vecs.forEach((v, i) => {
    if (!isQuery(i)) return;
    const hits = new Map();
    for (const [t, w] of top(v)) for (const j of index.get(t) || []) if (j !== i) hits.set(j, (hits.get(j) || 0) + w);
    const best = [...hits].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, perQuery * 3).map(([j]) => [j, cosine(v, vecs[j])]);
    for (const [j, s] of best.sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, perQuery)) out.push([i, j, s]);
  });
  return out;
}

if (process.argv.includes('--check')) {
  const rel = (x, y) => companyRel({ company: normCompany(x) }, { company: normCompany(y) });
  assert(rel('J.P. Morgan', 'JPMorgan Chase') === 'same' && rel('F5Networks', 'F5') === 'same' && rel('The D. E. Shaw Group', 'D. E. Shaw') === 'same', 'company aliases');
  assert(rel('Meta', 'Uber') === 'different' && rel('Unknown', 'Uber') === 'unknown', 'company relation');
  assert(bundle('Solve X and Y', '', 2, 0) && bundle('T', 'Solve the two independent problems', 1, 0) && bundle('T', 'x\n**Problem 2:** y', 1, 0), 'bundles');
  assert(!bundle('Maximize Chef Assignment Profit', '## Part 2: Build Best Profit', 2, 0) && !bundle('Insert and merge an interval', '', 0, 1), 'follow-up parts are not bundles');
  assert(coverage('Implement right side view and local minimum search', 'Binary Tree Right Side View') === 0.5 && coverage('Optimize Trapping Rain Water', 'Trapping Rain Water') === 1, 'coverage');
  assert(Math.abs(cosine(...tfidf([['lru', 'cache'], ['lru', 'cache'], ['x']])) - 1) < 1e-9, 'cosine');
  console.log('ok');
  process.exit(0);
}

// ---------- load ----------
const lib = existsSync(LIBRARY) ? JSON.parse(readFileSync(LIBRARY, 'utf8')).map((l) => ({ kind: 'library', id: l.id, number: l.number, slug: l.slug, title: l.title_en.replace(/\s*🔒\s*$/, ''), problem: l.judge_problem_id || null })) : [];
const libByNum = new Map(lib.map((l) => [l.number, l]));
const libBySlug = new Map(lib.map((l) => [l.slug, l]));
function readJsonl(name) {
  const f = join(PARSED, `${name}.jsonl`);
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => {
    const it = JSON.parse(l);
    const statement = statementOf(it.body);
    const refs = new Set(); // explicit "LeetCode 146" / leetcode.com/problems/<slug> references
    for (const m of it.body.matchAll(/leetcode(?:\.com\/problems\/([a-z0-9-]+)|[\s#:.-]*(?:problem\s*)?(\d{1,4})\b)/gi)) {
      const ref = m[1] ? libBySlug.get(m[1]) : libByNum.get(Number(m[2]));
      if (ref) refs.add(ref);
    }
    return {
      kind: 'prachub', id: it.id, type: it.type, title: it.title, company: normCompany(it.company?.name), companyName: it.company?.name || null,
      text: `${it.title}\n${statement}`, bodyLen: it.body.length, partial: it.partial, refs: [...refs],
      sql: /sql/i.test(it.category || '') || !!it.extra?.tables,
      // LeetCode titles only fit coding prompts: "Design a Task Scheduler" (system design) is not LC 621.
      coding: it.type === 'coding_question' || it.category === 'Coding & Algorithms',
      bundle: bundle(it.title, statement, it.extra?.parts?.length || 0, refs.size),
    };
  });
}
const ph = [...readJsonl('coding-questions'), ...readJsonl('interview-questions')];
const oa = JSON.parse(readFileSync(OA_CATALOG, 'utf8')).items.map((o) => ({
  kind: 'oa', id: o.id, problem: o.id, title: o.title, company: normCompany(o.companyName), companyName: o.companyName, text: `${o.title}\n${statementOf(o.statement || '')}`,
}));
const docs = [...ph, ...oa];
const P = ph.length;
const textVec = tfidf(docs.map((d) => tokens(d.text)));
const titleDocs = [...docs, ...lib];
const titleVec = tfidf(titleDocs.map((d) => titleTokens(d.title)));

// ---------- candidate pairs ----------
const pairs = []; // {a: PracHub, b: OA|PracHub, text, title, company}
const seen = new Set();
for (const [i, j, text] of [...candidates(textVec, (j) => j >= P, (i) => i < P), ...candidates(textVec, (j) => j < P, (i) => i < P)]) {
  const key = i < j ? `${i}|${j}` : `${j}|${i}`;
  if (seen.has(key)) continue;
  seen.add(key);
  pairs.push({ a: docs[i], b: docs[j], text, title: cosine(titleVec[i], titleVec[j]), company: companyRel(docs[i], docs[j]) });
}
const libPairs = []; // {a, b: library, title, method}
const libTitle = (i, l) => cosine(titleVec[i], titleVec[docs.length + lib.indexOf(l)]);
for (const [i, j, title] of candidates(titleVec, (j) => j >= docs.length, (i) => i < P, 10, 3)) libPairs.push({ a: docs[i], b: titleDocs[j], title, method: 'title' });
ph.forEach((a, i) => { for (const l of a.refs) libPairs.push({ a, b: l, title: libTitle(i, l), method: 'lc-ref' }); });

/** 'auto' | review reason | null */
function judge(p) {
  const { a, b, text, title, company } = p;
  if (b.kind === 'oa') {
    const min = company === 'same' ? T.oaSame : company === 'unknown' ? T.oaUnknown : T.crossCompany;
    const blocker = a.bundle ? 'bundle' : a.sql ? 'sql' : null;
    if (text >= min && !blocker) return 'auto';
    if (text >= (company === 'different' ? T.reviewCross : T.reviewOa)) return blocker || (company === 'different' ? 'other-company' : 'below-threshold');
    return null;
  }
  if (company === 'same' && sameRefs(a, b) && text >= T.oaSame) return 'auto';
  const blocker = a.sql || b.sql ? 'sql' : a.bundle || b.bundle ? 'bundle' : null;
  if (company === 'same' && !blocker && text >= T.phText && title >= T.phTitle) return 'auto';
  if (company !== 'different' && text >= T.reviewPh && (!(a.sql || b.sql) || title >= 0.5)) {
    return blocker || (company === 'unknown' ? 'unknown-company' : a.type !== b.type ? 'coding-vs-interview' : 'below-threshold');
  }
  if (company === 'different' && text >= T.reviewCrossPh && title >= 0.5) return 'other-company';
  return null;
}

// --sample: print pairs per text band (or all in [lo, hi)) with snippets, for reading.
if (process.argv.includes('--sample')) {
  const [kind = 'oa', rel = 'all', lo, hi] = process.argv.slice(process.argv.indexOf('--sample') + 1);
  const snip = (d) => d.text.replace(/\s+/g, ' ').slice(d.title.length, d.title.length + (lo ? 160 : 260));
  const show = (p) => console.log(`\n[${p.text?.toFixed(2) ?? '-'} text | ${p.title.toFixed(2)} title | ${p.company || p.method} | ${p.b.kind === 'library' ? '' : judge(p)}] ${p.a.id} ~ ${p.b.kind}:${p.b.id}\n  A ${p.a.companyName || ''} | ${p.a.title}${p.a.bundle ? ' [bundle]' : ''}\n   ${snip(p.a)}\n  B ${p.b.companyName || ''} | ${p.b.title}\n   ${p.b.kind === 'library' ? '' : snip(p.b)}`);
  if (kind === 'library') {
    for (const p of libPairs.filter((p) => p.title >= (+lo || 0.5)).sort((x, y) => y.title - x.title)) show(p);
  } else {
    for (const [l, h] of lo ? [[+lo, +hi]] : [[0.9, 1.01], [0.8, 0.9], [0.7, 0.8], [0.6, 0.7], [0.5, 0.6], [0.4, 0.5], [0.3, 0.4]]) {
      const inBand = pairs.filter((p) => p.b.kind === kind && p.text >= l && p.text < h && (rel === 'all' || p.company === rel)).sort((x, y) => y.text - x.text);
      console.log(`\n===== ${kind} ${rel} text in [${l}, ${h}): ${inBand.length} pairs`);
      for (const p of lo ? inBand : inBand.filter((_, i) => i % Math.max(1, Math.floor(inBand.length / 7)) === 0).slice(0, 7)) show(p);
    }
  }
  process.exit(0);
}

// ---------- decide ----------
const r3 = (x) => Math.round(x * 1000) / 1000;
const ref = (d) => ({ kind: d.kind, id: d.id, title: d.title, ...(d.problem ? { problem: d.problem } : {}) });
const best = new Map(); // PracHub id -> confident match, priority oa > library > prachub
const offer = (id, m) => {
  const cur = best.get(id);
  const rank = { oa: 0, library: 1, prachub: 2 };
  if (!cur || rank[m.dupOf.kind] < rank[cur.dupOf.kind] || (m.dupOf.kind === cur.dupOf.kind && m.score > cur.score)) best.set(id, m);
};
const review = [];
const addReview = (a, b, p, reason) => review.push({ id: a.id, title: a.title, candidate: ref(b), score: r3(p.text ?? p.title), text: p.text == null ? null : r3(p.text), titleScore: r3(p.title), company: p.company || null, companies: [a.companyName, b.companyName || null], reason });

// PracHub re-posts: union confident pairs, keep one canonical per cluster (coding > interview, complete > partial, longer, id).
const parent = new Map();
const find = (x) => (parent.get(x) === undefined || parent.get(x) === x ? x : find(parent.get(x)));
const better = (x, y) => (x.type === 'coding_question') - (y.type === 'coding_question') || !!y.partial - !!x.partial || x.bodyLen - y.bodyLen || (x.id < y.id ? 1 : -1);
const phAuto = [];
for (const p of pairs) {
  const v = judge(p);
  if (v === 'auto' && p.b.kind === 'oa') offer(p.a.id, { id: p.a.id, dupOf: ref(p.b), score: r3(p.text), method: 'text' });
  else if (v === 'auto') {
    phAuto.push(p);
    const [x, y] = [find(p.a.id), find(p.b.id)];
    if (x !== y) parent.set(x, y);
  } else if (v) {
    const [keep, drop] = p.b.kind === 'prachub' && better(p.a, p.b) > 0 ? [p.a, p.b] : [p.b, p.a];
    addReview(drop, keep, p, v);
  }
}
const byId = new Map(ph.map((d) => [d.id, d]));
const canon = new Map(); // cluster root -> canonical item
for (const p of phAuto) for (const d of [p.a, p.b]) {
  const root = find(d.id);
  if (!canon.has(root) || better(d, canon.get(root)) > 0) canon.set(root, d);
}
for (const p of phAuto) for (const d of [p.a, p.b]) {
  const c = canon.get(find(d.id));
  if (c.id !== d.id) offer(d.id, { id: d.id, dupOf: ref(c), score: r3(p.text), method: 'text+title' });
}
// LeetCode library, per item: an explicit single reference with a related title, else one unambiguous near-identical title.
const libBy = new Map();
for (const p of libPairs) (libBy.get(p.a.id) || libBy.set(p.a.id, []).get(p.a.id)).push(p);
for (const [id, ps] of libBy) {
  const a = byId.get(id);
  const refs = ps.filter((p) => p.method === 'lc-ref');
  const titles = ps.filter((p) => p.method === 'title').sort((x, y) => y.title - x.title);
  const [t1, t2] = titles;
  const why = !a.coding ? 'not-coding' : a.bundle ? 'bundle' : null;
  if (refs.length === 1 && !why && coverage(a.title, refs[0].b.title) >= T.libRefCover) offer(id, { id, dupOf: ref(refs[0].b), score: r3(refs[0].title), method: 'lc-ref' });
  else if (!refs.length && !why && t1?.title >= T.libTitle && !(t2?.title > t1.title - T.libGap)) offer(id, { id, dupOf: ref(t1.b), score: r3(t1.title), method: 'title' });
  else for (const p of [...refs, ...titles.filter((p) => p.title >= T.reviewLib)]) addReview(a, p.b, p, why || (p.method === 'lc-ref' ? 'lc-ref-weak-title' : 'below-threshold'));
}

const dupes = [...best.values()].sort((x, y) => x.id.localeCompare(y.id));
const confident = new Set(dupes.map((d) => d.id));
const reviewed = new Set();
const reviewOut = review
  .filter((r) => !confident.has(r.id))
  .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id) || x.candidate.id.localeCompare(y.candidate.id))
  .filter((r) => { const k = `${r.id}|${r.candidate.kind}|${r.candidate.id}`; return !reviewed.has(k) && reviewed.add(k); });
writeFileSync(join(PARSED, 'question-dupes.json'), JSON.stringify(dupes, null, 1) + '\n');
writeFileSync(join(PARSED, 'question-dupes-review.json'), JSON.stringify(reviewOut, null, 1) + '\n');

const count = (xs, f) => xs.reduce((o, x) => ((o[f(x)] = (o[f(x)] || 0) + 1), o), {});
console.log(`questions: ${ph.length} (${count(ph, (d) => d.type).coding_question || 0} coding, ${count(ph, (d) => d.type).interview_question || 0} interview); OA ${oa.length}; library ${lib.length}`);
console.log('confident by kind/method:', JSON.stringify(count(dupes, (d) => `${d.dupOf.kind}:${d.method}`)));
console.log('review by kind/reason:', JSON.stringify(count(reviewOut, (r) => `${r.candidate.kind}:${r.reason}`)));
