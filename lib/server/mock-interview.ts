import type Database from 'better-sqlite3';
import {
  KINDS,
  ROUNDS,
  companyCounts,
  companyGroup,
  drawSet,
  isRoleplay,
  leadershipPrinciples,
  newSeed,
  resolveTemplate,
  splitBody,
  type PoolItem,
} from '@/lib/mock-interview';
import { lcIdBySource } from '@/lib/company-tags';
import { hiddenCompanies } from './env';
import { HttpError } from './http';
import { SCENARIOS, roleplayQuestion } from './roleplay-scenarios';
import { sdChapter, sdChapters } from './system-design-course';

/**
 * Mock interview sets over the content library (GET /api/content/mock and mock-companies).
 * The pool is every complete question (never a partial one or a hidden company's), plus unlisted
 * duplicates of problems we can judge: those are real company questions with an online editor.
 */
export type PoolRow = PoolItem & {
  type: string;
  slug: string;
  title: string;
  companyName: string | null;
  difficulty: string | null;
  /** Listed items have their own public page. */
  listed: boolean;
  /** A judge problem id (lc-…/oa-…) when the question maps to one. */
  problem: string | null;
};

// Rebuilt libraries open as a new handle, so the cache follows the handle.
const pools = new WeakMap<Database.Database, PoolRow[]>();
export function mockPool(db: Database.Database): PoolRow[] {
  let pool = pools.get(db);
  if (!pool) {
    const hidden = [...hiddenCompanies()];
    const rows = db
      .prepare(
        `SELECT id, type, slug, title, company_slug AS company, company_name AS companyName, role, category, round,
           difficulty, listed, json_extract(dup_of, '$.problem') AS problem
         FROM items
         WHERE type IN ('coding_question', 'interview_question') AND partial = 0 AND category IS NOT NULL
           AND (listed = 1 OR json_extract(dup_of, '$.problem') IS NOT NULL)
           ${hidden.length ? `AND LOWER(COALESCE(company_slug, '')) NOT IN (${hidden.map(() => '?').join(',')})` : ''}
         ORDER BY id`,
      )
      .all(...hidden) as (Omit<PoolRow, 'listed'> & { listed: number })[];
    pool = rows
      .filter((r) => !r.problem || !hidden.some((slug) => r.problem!.startsWith(`oa-${slug}-`)))
      .map((r) => ({ ...r, listed: !!r.listed, problem: r.problem ?? (r.type === 'coding_question' ? lcIdBySource.get(r.slug) : undefined) ?? null }));
    pools.set(db, pool);
  }
  return pool;
}

/** The LLD template's questions: system design course chapters (and every LLD case), asked only by the AI interviewer. */
export const LLD_CHAPTERS = ['lld-parking-lot', 'lld-lru-cache-ttl', 'lld-elevator', 'bounded-blocking-queue', 'rate-limited-executor', ...sdChapters.map((c) => c.slug).filter((slug) => slug.startsWith('lld-case-'))];
/** How much of an LLD chapter the AI interviewer reads as the reference (diagrams stripped); every chapter fits. */
export const LLD_REFERENCE_CHARS = 9_000;
/**
 * An LLD question by id (`sd-<chapter>`), or null. The statement is generic; the chapter is the
 * reference answer and the course's OOD playbook the rubric, both for the AI interviewer only.
 */
export function lldQuestion(id: string) {
  const slug = id.startsWith('sd-') ? id.slice(3) : '';
  const chapter = LLD_CHAPTERS.includes(slug) ? sdChapter(slug) : undefined;
  if (!chapter) return null;
  // "LLD Case 1: Parking Lot" → "Parking Lot".
  const title = chapter.titleEn.replace(/^[^:]*:\s*/, ''),
    titleZh = chapter.titleZh.replace(/^[^：]*：/, '');
  return {
    id,
    slug,
    title,
    question: `**${title}**（${titleZh}）\n\nDesign ${title} as in a low-level (object-oriented) design interview: clarify the requirements, model the classes and how they relate, define the interfaces, write the core code, then discuss how the design extends.`,
    rubric: sdChapter('ood-interview-approach')?.bodyEn ?? '',
    // The class diagram repeats the class table; drop it so the deep-dive sections fit the cap.
    solution: chapter.bodyEn.replace(/^```mermaid\n[\s\S]*?^```\n?/gm, ''),
  };
}
const lldPool = (): PoolRow[] =>
  LLD_CHAPTERS.flatMap((slug) => {
    const q = lldQuestion(`sd-${slug}`);
    return q
      ? [{ id: q.id, type: 'course_chapter', slug, title: q.title, company: null, companyName: null, role: null,
          category: KINDS.lld.categories[0], round: null, difficulty: null, listed: false, problem: null }]
      : [];
  });

const roleplayPool = (): PoolRow[] =>
  SCENARIOS.map((s) => ({
    id: `rp-${s.id}`, type: 'roleplay', slug: s.id, title: roleplayQuestion(`rp-${s.id}`)!.title, company: null,
    companyName: null, role: null, category: KINDS[s.kind].categories[0], round: null, difficulty: null, listed: false,
    problem: null,
  }));

const counts = new WeakMap<Database.Database, ReturnType<typeof companyCounts>>();
export function mockCompanies(db: Database.Database) {
  if (!counts.has(db)) counts.set(db, companyCounts(mockPool(db)));
  return counts.get(db)!;
}

const list = (value: string | null, separator: string, max: number) =>
  (value || '').split(separator).filter(Boolean).slice(0, max);

export function mockSet(db: Database.Database, params: URLSearchParams) {
  const template = resolveTemplate(params.get('template'), params.get('mix'), params.get('min'));
  if (!template) throw new HttpError(400, '未知的面试模板');
  const seed = params.get('seed') || newSeed();
  if (!/^[a-z0-9]{1,24}$/i.test(seed)) throw new HttpError(400, '抽题编号无效');
  const company = /^[a-z0-9-]{1,80}$/.test(params.get('company') || '') ? params.get('company') : null;
  const round = params.get('round');
  // AI-only questions join the pool only for their own templates.
  const lld = template.slots.some((s) => s.kind === 'lld');
  const roleplay = template.slots.some((s) => isRoleplay(s.kind));
  const drawn = drawSet([...mockPool(db), ...(lld ? lldPool() : []), ...(roleplay ? roleplayPool() : [])], template, {
    seed,
    company,
    role: params.get('role'),
    round: round && Object.hasOwn(ROUNDS, round) ? round : null,
    rerolls: list(params.get('rr'), '.', 300).map(Number),
    exclude: list(params.get('exclude'), ',', 100),
  });
  const ids = drawn.slots.flatMap((s) => (s.item ? [s.item.id] : []));
  const bodies = new Map(
    (
      db
        .prepare(`SELECT id, body, extra FROM items WHERE id IN (${ids.map(() => '?').join(',') || "''"})`)
        .all(...ids) as { id: string; body: string; extra: string }[]
    ).map((r) => [r.id, r]),
  );
  const amazon = companyGroup('amazon');
  // The candidate's view asks for the questions alone: no answers in its responses either.
  const questionOnly = params.get('parts') === 'question';
  return {
    seed,
    rerolls: drawn.rerolls,
    template: { id: template.id, name: template.name, role: template.role, round: template.round },
    slots: drawn.slots.map(({ item, ...slot }) => {
      if (!item) return { ...slot, item: null };
      const row = bodies.get(item.id);
      const parts = splitBody(row?.body ?? '');
      // An LLD question's reference and a role-play's limits never leave the server (lib/server/ai-interviewer.ts reads them).
      const course = item.type === 'course_chapter';
      const play = item.type === 'roleplay' ? roleplayQuestion(item.id) : null;
      if (course) parts.question = lldQuestion(item.id)?.question ?? '';
      if (play) parts.question = play.question;
      if (questionOnly || course || play) Object.assign(parts, { hints: '', followUps: '', rubric: '', solution: '' });
      return {
        ...slot,
        item: {
          id: item.id,
          type: item.type,
          slug: item.slug,
          title: item.title,
          company: item.company ? { slug: item.company, name: item.companyName ?? item.company } : null,
          role: item.role,
          round: item.round,
          category: item.category,
          difficulty: item.difficulty,
          listed: item.listed,
          problem: item.problem,
          math: !!(JSON.parse(row?.extra || '{}') as { math?: boolean }).math,
          ...(play ? { titleZh: play.titleZh, questionZh: play.questionZh } : {}),
          principles:
            item.company && amazon.includes(item.company) ? leadershipPrinciples(`${item.title}\n${parts.question}`).slice(0, 3) : [],
          ...parts,
        },
      };
    }),
  };
}

/** Companies with enough questions for their own landing page. */
export const landingCompanies = (db: Database.Database) => mockCompanies(db).filter((c) => c.n >= 5);
