import type Database from 'better-sqlite3';
import {
  ROUNDS,
  companyCounts,
  companyGroup,
  drawSet,
  leadershipPrinciples,
  newSeed,
  resolveTemplate,
  splitBody,
  type PoolItem,
} from '@/lib/mock-interview';
import { lcIdBySource } from '@/lib/company-tags';
import { hiddenCompanies } from './env';
import { HttpError } from './http';

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
  const drawn = drawSet(mockPool(db), template, {
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
      if (questionOnly) Object.assign(parts, { hints: '', followUps: '', rubric: '', solution: '' });
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
