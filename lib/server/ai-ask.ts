import type Database from 'better-sqlite3';
import { z } from 'zod';
import { askTerms } from '@/lib/ask-terms';
import { hiddenCompanySlugs } from '@/lib/oa-company-brands';
import type { Person } from './auth';
import { aiEnabled, runAi, SYSTEM, textReply } from './ai-tutor';
import { library } from './content-library';
import { setting } from './env';
import { HttpError, json, limit } from './http';
import { readJson } from './my-practice';
import { publicLibraryPath } from './public-library';

/**
 * "Ask AI" in the command palette (components/command-palette.tsx): a question answered from the
 * site's own library pages. The server picks the sources (at most SOURCES public pages matching the
 * question's words), the model answers only from them and cites them as [n]; the reply lists the
 * pages it cited. Quota, budget, model call and reply tidying are the AI tutor's (ai-tutor.ts).
 */
export const SOURCES = 6;
const EXCERPT_CHARS = 900;
const CONTEXT_CHARS = 1500;
// Guides are thin programmatic pages (title and summary indexed only); the rest are written pages.
const TYPES = ['algorithm', 'concept', 'article', 'cheatsheet', 'coding_question', 'interview_question', 'experience'];
const PUBLIC = `i.listed=1 AND i.partial=0 AND i.dup_of IS NULL AND i.type IN (${TYPES.map((t) => `'${t}'`).join(',')})`;
type Row = { rowid: number; type: string; slug: string; title: string; title_zh: string | null; body: string; extra: string; company_slug: string | null };
export type AskSource = { n: number; type: string; slug: string; title: string; url: string; excerpt: string };

/** Markdown down to readable text: no images, link targets, tags or emphasis marks. */
const plain = (text: string) =>
  text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/[*_`~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
/** The stretch of the page around its first matching term, so the model reads the relevant part. */
function excerpt(body: string, terms: string[]) {
  const text = plain(body);
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0), Infinity);
  const start = Number.isFinite(at) ? Math.max(0, at - 200) : 0;
  return (start ? '…' : '') + text.slice(start, start + EXCERPT_CHARS) + (start + EXCERPT_CHARS < text.length ? '…' : '');
}
/** Our prompt's own tags inside copied text would let a page close its source early. */
const untagged = (text: string) => text.replace(/<\/?\s*(?:sources?|question|selected_text)\b[^>]*>/gi, '');

/**
 * The public library pages that best match the question (and the selected text), best first.
 * Latin words go through the full-text index (OR-ed, ranked); Chinese has no word index, so its
 * bigrams are matched against titles and summaries by substring and ranked by how many hit.
 */
export function askSources(
  db: Database.Database,
  question: string,
  context = '',
  locale: 'zh' | 'en' = 'en',
  hidden: ReadonlySet<string> = hiddenCompanySlugs(setting('HIDDEN_COMPANIES')),
): AskSource[] {
  const { words, grams } = askTerms(`${question} ${context.slice(0, 300)}`);
  const columns = 'i.rowid,i.type,i.slug,i.title,i.title_zh,i.body,i.extra,i.company_slug';
  const found = new Map<number, Row>();
  if (words.length)
    for (const r of db
      .prepare(
        `SELECT ${columns} FROM (SELECT rowid AS id, rank AS r FROM items_fts WHERE items_fts MATCH ? ORDER BY rank LIMIT 60) f
         JOIN items i ON i.rowid=f.id WHERE ${PUBLIC} ORDER BY f.r LIMIT 30`,
      )
      // Short words (DP, OA) match exactly, as in content-library's ftsQuery.
      .all(words.map((w) => (w.length >= 3 ? `"${w}"*` : `"${w}"`)).join(' OR ')) as Row[])
      found.set(r.rowid, r);
  if (grams.length) {
    const like = (g: string) => `%${g}%`;
    // A NULL column makes a miss NULL, and NULL would void the whole sum.
    const hit = `COALESCE(i.title LIKE ? OR i.title_zh LIKE ? OR i.summary LIKE ? OR i.summary_zh LIKE ?, 0)`;
    const score = grams.map(() => hit).join(' + ');
    // ponytail: substring bigrams over ~10k titles per question; FTS5 with a CJK tokenizer when this shows in profiles.
    for (const r of db
      .prepare(
        `SELECT ${columns},${score} AS s FROM items i WHERE ${PUBLIC} AND s >= ? ORDER BY s DESC, i.rowid LIMIT 30`,
      )
      .all(...grams.flatMap((g) => [like(g), like(g), like(g), like(g)]), Math.min(2, grams.length)) as Row[])
      found.set(r.rowid, r);
  }
  const terms = [...words, ...grams];
  return [...found.values()]
    .filter((r) => !r.company_slug || !hidden.has(r.company_slug.toLowerCase()))
    .slice(0, SOURCES)
    .map((r, index) => {
      let body = r.body;
      if (locale === 'zh' && r.type === 'algorithm') {
        try {
          body = (JSON.parse(r.extra) as { bodyZh?: string }).bodyZh || body;
        } catch {
          /* The English page stays readable. */
        }
      }
      const title = (locale === 'zh' && r.title_zh) || r.title;
      return { n: index + 1, type: r.type, slug: r.slug, title, url: publicLibraryPath(r.type, r.slug), excerpt: untagged(excerpt(body, terms)) };
    });
}

/** The reply without citations of sources it was not given, and the sources it did cite. */
export function citedAnswer(text: string, sources: readonly AskSource[]) {
  const shown = new Set<number>();
  // [1], and the grouped forms models write: [1, 2], [1，2], [1-3].
  const clean = text.replace(/\[(\d{1,2}(?:\s*[,，、\-–]\s*\d{1,2})*)\]/g, (_mark, list: string) => {
    const kept = new Set<number>();
    for (const part of list.split(/\s*[,，、]\s*/)) {
      const [a, b = a] = part.split(/\s*[-–]\s*/).map(Number);
      for (let k = Math.max(1, a); k <= Math.min(b, sources.length); k++) kept.add(k);
    }
    for (const k of kept) shown.add(k);
    return kept.size ? `[${[...kept].join(', ')}]` : '';
  });
  return { text: clean, sources: sources.filter((s) => shown.has(s.n)).map(({ excerpt: _excerpt, ...s }) => s) };
}

const input = z
  .object({
    question: z.string().trim().min(2).max(500),
    locale: z.enum(['zh', 'en']).default('en'),
    // Text the learner selected on a lecture or question page.
    context: z.string().max(CONTEXT_CHARS * 2).optional(),
  })
  .strict();

/** POST oj/ai/ask: an answer from the site's pages with its sources, or `text: null` when none match. */
export async function handleAiAsk(request: Request, p: Person) {
  if (!aiEnabled() || request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'ai-tutor', 6);
  const data = input.parse(await readJson(request, 16_000));
  const context = untagged(data.context?.trim().slice(0, CONTEXT_CHARS) ?? '');
  const db = library();
  const sources = db ? askSources(db, data.question, context, data.locale) : [];
  // Nothing on the site to answer from: no model call, no quota spent.
  if (!sources.length) return json({ text: null, sources: [] });
  const user = `<sources>
${sources.map((s) => `<source n="${s.n}" type="${s.type}" title="${s.title.replace(/"/g, "'")}">\n${s.excerpt}\n</source>`).join('\n')}
</sources>${context ? `\n<selected_text>\n${context}\n</selected_text>` : ''}
<question>
${untagged(data.question)}
</question>

Answer the question from the sources and cite them as [n]. Reply in ${data.locale === 'en' ? 'English' : 'Simplified Chinese'}.`;
  const reply = await runAi(request, p, 'ask', user, SYSTEM.ask, textReply('ask'));
  return json({ ...citedAnswer(reply.text, sources), remaining: reply.remaining, limit: reply.limit });
}
