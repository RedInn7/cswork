import { sqlite } from '@/db/sqlite';
import { companyTagIndex } from '@/lib/company-tags';
import { hiddenCompanies } from './env';
import { HttpError } from './http';
import { practiceRoundState } from './practice-rounds';
import { studyProgress } from './practice-progress';
import { problemMarks } from './my-practice';
import {
  curatedByNumber,
  curatedEntries,
  curatedSections,
  LING_CURATED_ID,
  LING_CURATED_TITLE,
  type CuratedEntry,
} from '@/lib/ling-curated';

const CURATED_STAGES: CuratedEntry['stage'][] = ['基础', '核心', '进阶'];

type LibraryRow = {
  id: string;
  number: number;
  slug: string;
  title_zh: string;
  title_en: string;
  difficulty: string;
  topics_json: string;
  case_count: number;
  expected_count: number;
  judge_problem_id: string | null;
  ready: number;
};
const columns = `l.id,l.number,l.slug,l.title_zh,l.title_en,l.difficulty,l.topics_json,
  l.case_count,l.expected_count,l.judge_problem_id,
  CASE WHEN EXISTS(
    SELECT 1 FROM oj_problems p WHERE p.id=l.judge_problem_id AND p.published=1
      AND l.verified_hash=l.content_hash || ':' || p.current_version_id
  ) THEN 1 ELSE 0 END AS ready`;
function summary(row: LibraryRow) {
  return {
    id: row.id,
    number: row.number,
    slug: row.slug,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    difficulty: row.difficulty,
    topics: JSON.parse(row.topics_json) as string[],
    caseStatus: row.ready
      ? 'verified'
      : row.case_count
        ? 'unverified'
        : 'missing',
    caseCount: row.case_count,
    judgeProblemId: row.ready ? row.judge_problem_id : null,
  };
}
export function listStudyLibrary(params: URLSearchParams, userId?: string) {
  const collection = params.get('collection');
  if (!collection || collection === LING_CURATED_ID)
    return listCuratedLibrary(params, userId);
  if (collection && collection !== 'all') throw new HttpError(400, '未知题单');
  const db = sqlite();
  const q = (params.get('q') || '').trim().slice(0, 180);
  const topic = (params.get('topic') || '').slice(0, 100);
  const difficulty = (params.get('difficulty') || '').slice(0, 10);
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1),
  );
  const where: string[] = [];
  const values: (string | number)[] = [];
  if (q) {
    // Escape LIKE metacharacters: search is literal, not a user-supplied SQL pattern.
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    where.push(
      `(l.title_zh LIKE ? ESCAPE '\\' OR l.title_en LIKE ? ESCAPE '\\' OR l.slug LIKE ? ESCAPE '\\' OR CAST(l.number AS TEXT)=?)`,
    );
    values.push(like, like, like, q);
  }
  if (topic) {
    where.push('EXISTS(SELECT 1 FROM json_each(l.topics_json) WHERE value=?)');
    values.push(topic);
  }
  if (difficulty) {
    where.push('l.difficulty=?');
    values.push(difficulty);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS n FROM study_library l${clause}`)
      .get(...values) as { n: number }
  ).n;
  const items = (
    db
      .prepare(
        `SELECT ${columns} FROM study_library l${clause} ORDER BY l.number LIMIT 30 OFFSET ?`,
      )
      .all(...values, (page - 1) * 30) as LibraryRow[]
  ).map(summary);
  const topics = (
    db
      .prepare(
        'SELECT DISTINCT value AS name FROM study_library, json_each(topics_json) ORDER BY value',
      )
      .all() as { name: string }[]
  ).map((t) => t.name);
  return { items, total, page, pageSize: 30, topics };
}

function listCuratedLibrary(params: URLSearchParams, userId?: string) {
  const db = sqlite();
  const numbers = JSON.stringify(curatedEntries.map((entry) => entry.number));
  const rows = db
    .prepare(
      `SELECT ${columns} FROM study_library l
    WHERE l.number IN (SELECT value FROM json_each(?))`,
    )
    .all(numbers) as LibraryRow[];
  const roundState = userId
    ? practiceRoundState(userId)
    : { rounds: [], activeRoundId: null, currentRound: null };
  // A later failed submission never erases an earlier acceptance in this round.
  // Runs, other users and other rounds do not contribute to practice progress.
  const progress = userId
    ? studyProgress(userId, roundState.activeRoundId)
    : new Map();
  const tags = companyTagIndex(hiddenCompanies());
  const marks = userId ? problemMarks(userId) : new Map<string, Set<string>>();
  const all = rows
    .map((row) => ({
      ...summary(row),
      selection: curatedByNumber.get(row.number)!,
      companies: tags.get(row.id) ?? [],
      starred: !!marks.get(row.judge_problem_id ?? row.id)?.has('star'),
      redo: !!marks.get(row.judge_problem_id ?? row.id)?.has('redo'),
      solved: !!progress.get(row.id)?.solved,
      solvedLocally: !!progress.get(row.id)?.solvedLocally,
      importedSources: progress.get(row.id)?.importedSources ?? [],
      progressStatus: progress.get(row.id)?.solved
        ? 'solved'
        : progress.get(row.id)?.attempted
          ? 'attempted'
          : 'not_started',
      judging: !!progress.get(row.id)?.pending,
    }))
    .sort((a, b) => a.selection.order - b.selection.order);
  const q = (params.get('q') || '').trim().slice(0, 180).toLocaleLowerCase();
  const section = params.get('section') || '';
  const difficulty = params.get('difficulty') || '';
  const stage = params.get('stage') || '';
  const status = params.get('status') || '';
  const company = (params.get('company') || '').slice(0, 80);
  const filtered = all.filter(
    (item) =>
      (!q ||
        [item.titleZh, item.titleEn, item.slug].some((value) =>
          value.toLocaleLowerCase().includes(q),
        ) ||
        String(item.number) === q) &&
      (!section || item.selection.sectionSlug === section) &&
      (!difficulty || item.difficulty === difficulty) &&
      (!stage || item.selection.stage === stage) &&
      (!company || item.companies.some((c) => c.slug === company)) &&
      (!status ||
        (status === 'solved'
          ? item.solved
          : status === 'todo'
            ? !item.solved
            : status === 'attempted' || status === 'not_started'
              ? item.progressStatus === status
              : status === 'ready'
                ? item.caseStatus === 'verified'
                : status === 'starred' || status === 'redo'
                  ? item[status]
                  : false)),
  );
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1),
  );
  // Curated order of problems judgeable here, so "continue" and prev/next span every page.
  const sequence = all.flatMap((item) =>
    item.caseStatus === 'verified' && item.judgeProblemId
      ? [item.judgeProblemId]
      : [],
  );
  // The first unsolved sequence entry. Guests have solved nothing, so they get
  // the first judgeable problem, or the first curated one if none is judgeable.
  const nextItem =
    all.find(
      (item) =>
        item.caseStatus === 'verified' && item.judgeProblemId && !item.solved,
    ) ?? (userId ? undefined : all[0]);
  const companyCounts = new Map<string, { slug: string; name: string; count: number }>();
  for (const item of all)
    for (const { slug, name } of item.companies) {
      const entry = companyCounts.get(slug) ?? { slug, name, count: 0 };
      entry.count++;
      companyCounts.set(slug, entry);
    }
  return {
    items: filtered.slice((page - 1) * 30, page * 30).map((item) => ({
      ...item,
      // Two marks per row; the filtered company leads so a row shows why it matched.
      companies: [...item.companies]
        .sort((a, b) => Number(b.slug === company) - Number(a.slug === company))
        .slice(0, 2)
        .map(({ slug, name }) => ({ slug, name })),
    })),
    total: filtered.length,
    page,
    pageSize: 30,
    topics: [],
    companies: [...companyCounts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'),
    ),
    sequence,
    nextProblemId: userId ? (nextItem?.judgeProblemId ?? null) : null,
    // Returned to everyone: for members it is the problem nextProblemId points to.
    next: nextItem
      ? {
          judgeProblemId: nextItem.judgeProblemId,
          number: nextItem.number,
          titleZh: nextItem.titleZh,
          titleEn: nextItem.titleEn,
          difficulty: nextItem.difficulty,
          sectionSlug: nextItem.selection.sectionSlug,
          stage: nextItem.selection.stage,
        }
      : null,
    ...roundState,
    collection: {
      id: LING_CURATED_ID,
      title: LING_CURATED_TITLE,
      total: curatedEntries.length,
      available: all.length,
      ready: all.filter((item) => item.caseStatus === 'verified').length,
      solved: all.filter((item) => item.solved).length,
      sections: curatedSections.map((section) => {
        const items = all.filter(
          (item) => item.selection.sectionSlug === section.slug,
        );
        return {
          ...section,
          total: items.length,
          solved: items.filter((item) => item.solved).length,
          stages: Object.fromEntries(
            CURATED_STAGES.map((stage) => {
              const staged = items.filter(
                (item) => item.selection.stage === stage,
              );
              return [
                stage,
                {
                  total: staged.length,
                  solved: staged.filter((item) => item.solved).length,
                },
              ];
            }),
          ) as Record<CuratedEntry['stage'], { total: number; solved: number }>,
        };
      }),
    },
  };
}
function publicSourceUrl(value: string | null) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['leetcode.cn', 'leetcode.com'].includes(url.hostname) &&
      !url.username &&
      !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}

/** Display-only source text; never merge it into the immutable judge spec. */
export function getStudySourceStatement(judgeProblemId: string) {
  const row = sqlite()
    .prepare(
      `SELECT
         json_extract(payload_json,'$.descriptionZh') AS descriptionZh,
         json_extract(payload_json,'$.descriptionEn') AS descriptionEn,
         json_extract(payload_json,'$.sourceUrl') AS sourceUrl,
         json_extract(payload_json,'$.sourceEnUrl') AS sourceEnUrl,
         json_extract(payload_json,'$.attribution') AS attribution
       FROM study_library WHERE judge_problem_id=? LIMIT 1`,
    )
    .get(judgeProblemId) as
    | {
        descriptionZh: string | null;
        descriptionEn: string | null;
        sourceUrl: string | null;
        sourceEnUrl: string | null;
        attribution: string | null;
      }
    | undefined;
  if (!row || (!row.descriptionZh && !row.descriptionEn)) return null;
  // Only these public fields leave the source payload. Reference solutions,
  // local file paths, candidate cases and answers must remain server-side.
  return {
    descriptionZh: row.descriptionZh || '',
    descriptionEn: row.descriptionEn || '',
    sourceUrl: publicSourceUrl(row.sourceUrl),
    sourceEnUrl: publicSourceUrl(row.sourceEnUrl),
    attribution: row.attribution || '',
  };
}

export function getStudyLibrary(id: string) {
  if (!/^lc-\d{1,6}$/.test(id)) throw new HttpError(404, '题目不存在');
  const row = sqlite()
    .prepare(
      `SELECT ${columns},l.payload_json FROM study_library l WHERE l.id=?`,
    )
    .get(id) as (LibraryRow & { payload_json: string }) | undefined;
  if (!row) throw new HttpError(404, '题目不存在');
  const payload = JSON.parse(row.payload_json);
  // Never serialize the source reference solutions, local paths, candidate inputs or answers.
  return {
    ...summary(row),
    selection: curatedByNumber.get(row.number) || null,
    descriptionZh: payload.descriptionZh,
    descriptionEn: payload.descriptionEn,
    sourceUrl: payload.sourceUrl,
    sourceEnUrl: payload.sourceEnUrl,
    attribution: payload.attribution,
    signature: payload.signature,
    caseSummary: {
      total: row.case_count,
      withExpected: row.expected_count,
    },
  };
}
