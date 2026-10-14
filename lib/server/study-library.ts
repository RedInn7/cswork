import { sqlite } from '@/db/sqlite';
import { companyTagIndex, type CompanyTag } from '@/lib/company-tags';
import hintFile from '@/lib/content/ling-hints.json';
import { hiddenCompanies } from './env';
import { HttpError, rows } from './http';
import { oaLibrary } from './oa-library';
import { oaReadyProblems } from './oa-judge';
import { oaDifficulty, oaTopic } from './oa-topics';
import { ensurePracticeRound, practiceRoundState } from './practice-rounds';
import { studyProgress } from './practice-progress';
import { problemMarks } from './my-practice';
import { lcRatingOf, RATINGS_SQL_JSON } from './lc-ratings';
import { acceptanceIndex } from './problem-stats';
import { readList } from './learner-cloud';
import { median, pickAtLevel, solveChance, START_LEVEL } from '@/lib/lc-rating';
import {
  curatedByNumber,
  curatedEntries,
  curatedSections,
  LING_CURATED_ID,
  LING_CURATED_TITLE,
  type CuratedEntry,
} from '@/lib/ling-curated';
import {
  classicList,
  groupEntries,
  type ClassicEntry,
  type ClassicList,
} from '@/lib/classic-lists';
import { STOP_NAMES } from '@/lib/route-stops';

const CURATED_STAGES: CuratedEntry['stage'][] = ['基础', '核心', '进阶'];
const STOP_INDEX = new Map(curatedSections.map((section, index) => [section.slug, index]));

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
    /** Contest rating (zerotrac), null for problems never in a rated contest. */
    rating: lcRatingOf(row.number)?.rating ?? null,
  };
}
const DIFFICULTY_RANK: Record<string, number> = { 简单: 1, easy: 1, 中等: 2, medium: 2, 困难: 3, hard: 3 };
/** ratingMin / ratingMax: whole numbers 0–4000; anything else is no bound. */
function ratingBound(params: URLSearchParams, key: string) {
  const n = Number(params.get(key) || NaN);
  return Number.isInteger(n) && n >= 0 && n <= 4000 ? n : null;
}
/**
 * solved=YYYY or YYYY-MM as [from, to) in ms, in the viewer's zone: tz is minutes as
 * Date#getTimezoneOffset gives them (default Beijing, -480).
 */
export function solvedPeriod(value: string, tz: string | null) {
  const m = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/.exec(value);
  if (!m) throw new HttpError(400, '无效的日期');
  const offset = tz && /^-?\d{1,3}$/.test(tz) && Math.abs(Number(tz)) <= 840 ? Number(tz) : -480;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) - 1 : 0;
  const end = m[2] ? Date.UTC(year, month + 1, 1) : Date.UTC(year + 1, 0, 1);
  return [Date.UTC(year, month, 1) + offset * 60000, end + offset * 60000] as const;
}
/** Problems the user got accepted (formal submissions, any round) inside the period. */
function solvedBetween(userId: string, [from, to]: readonly [number, number]) {
  return new Set(
    sqlite()
      .prepare(
        "SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND created_at>=? AND created_at<?",
      )
      .pluck()
      .all(userId, from, to) as string[],
  );
}
/** The list API: a classic list by its slug, otherwise Line 500 or the whole bank. */
export function listLibrary(params: URLSearchParams, userId?: string) {
  if (params.get('view') === 'contests') {
    if (!userId) throw new HttpError(401, '请先登录');
    return listContests(params, userId);
  }
  const classic = classicList(params.get('collection'));
  return classic
    ? listClassicLibrary(classic, userId)
    : listStudyLibrary(params, userId);
}

/** These problems' summaries in the given order (company pages); unknown ids are skipped. */
export function studyLibrarySummaries(ids: readonly string[]) {
  if (!ids.length) return [];
  const rows = sqlite()
    .prepare(
      `SELECT ${columns} FROM study_library l WHERE l.id IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(ids)) as LibraryRow[];
  const byId = new Map(rows.map((row) => [row.id, summary(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
export function listStudyLibrary(params: URLSearchParams, userId?: string) {
  const collection = params.get('collection');
  if (!collection || collection === LING_CURATED_ID)
    return listCuratedLibrary(params, userId);
  if (collection !== 'all') throw new HttpError(400, '未知题单');
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
  const ratingMin = ratingBound(params, 'ratingMin');
  const ratingMax = ratingBound(params, 'ratingMax');
  if (ratingMin !== null) {
    where.push('r.rating>=?');
    values.push(ratingMin);
  }
  if (ratingMax !== null) {
    where.push('r.rating<=?');
    values.push(ratingMax);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  // A materialized CTE gets an automatic index, so the join is not a scan per row.
  const rated = `WITH r AS MATERIALIZED (SELECT CAST(key AS INTEGER) AS number,value AS rating FROM json_each(?))`;
  const from = `study_library l LEFT JOIN r ON r.number=l.number`;
  const dir = params.get('dir') === 'desc' ? 'DESC' : 'ASC';
  const sort = params.get('sort');
  // Unrated (or unknown difficulty) rows last either way; ties in number order.
  const order =
    sort === 'rating'
      ? `r.rating IS NULL,r.rating ${dir},l.number`
      : sort === 'difficulty'
        ? `level IS NULL,level ${dir},l.number`
        : `l.number ${sort === 'number' ? dir : 'ASC'}`;
  const level = `CASE lower(l.difficulty) ${Object.entries(DIFFICULTY_RANK)
    .map(([name, n]) => `WHEN '${name}' THEN ${n}`)
    .join(' ')} END AS level`;
  const total = (
    db
      .prepare(`${rated} SELECT COUNT(*) AS n FROM ${from}${clause}`)
      .get(RATINGS_SQL_JSON, ...values) as { n: number }
  ).n;
  const items = (
    db
      .prepare(
        `${rated} SELECT ${columns},${level} FROM ${from}${clause} ORDER BY ${order} LIMIT 30 OFFSET ?`,
      )
      .all(RATINGS_SQL_JSON, ...values, (page - 1) * 30) as LibraryRow[]
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
  const ratingMin = ratingBound(params, 'ratingMin');
  const ratingMax = ratingBound(params, 'ratingMax');
  // list=<id>: the reader's own list or anyone's public one; others read as missing.
  const listId = params.get('list');
  const listed = listId ? readList(listId, userId ?? null) : null;
  if (listId && !listed) throw new HttpError(404, '题单不存在');
  const inList = listed && new Set(listed.items.map((entry) => entry.problemId));
  // solved=YYYY[-MM]: accepted in that period; nothing for guests.
  const solvedParam = params.get('solved');
  const solvedIn = solvedParam
    ? userId
      ? solvedBetween(userId, solvedPeriod(solvedParam, params.get('tz')))
      : new Set<string>()
    : null;
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
      (ratingMin === null || (item.rating !== null && item.rating >= ratingMin)) &&
      (ratingMax === null || (item.rating !== null && item.rating <= ratingMax)) &&
      (!inList || inList.has(item.id) || (!!item.judgeProblemId && inList.has(item.judgeProblemId))) &&
      (!solvedIn || solvedIn.has(item.judgeProblemId ?? item.id)) &&
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
  // sort=frequency: the chosen company's most reported problems first. The sort is
  // stable, so equal counts keep the line's order.
  const sort = params.get('sort') || '';
  if (company && sort === 'frequency') {
    const reports = (item: (typeof all)[number]) =>
      item.companies.find((c) => c.slug === company)?.count ?? 0;
    filtered.sort((a, b) => reports(b) - reports(a));
  }
  // number / difficulty / rating / acceptance, either way (dir=asc|desc); problems without
  // a value (unrated, too few people for a share) stay last, in line order.
  const shares = sort === 'acceptance' ? acceptanceIndex() : null;
  const sortKey: ((item: (typeof all)[number]) => number | null) | null =
    sort === 'number'
      ? (item) => item.number
      : sort === 'difficulty'
        ? (item) => DIFFICULTY_RANK[item.difficulty.toLowerCase()] ?? null
        : sort === 'rating'
          ? (item) => item.rating
          : shares
            ? (item) => shares.get(item.judgeProblemId ?? item.id) ?? null
            : null;
  if (sortKey) {
    const sign = params.get('dir') === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const x = sortKey(a);
      const y = sortKey(b);
      return x === null || y === null ? Number(x === null) - Number(y === null) : sign * (x - y);
    });
  }
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
  // random=1, "Pick one": an unsolved problem judgeable here, under the filters.
  const pool =
    params.get('random') === '1'
      ? filtered.filter((item) => item.caseStatus === 'verified' && item.judgeProblemId && !item.solved)
      : [];
  return {
    ...(params.get('random') === '1' && {
      random: pool.length ? pool[Math.floor(Math.random() * pool.length)].judgeProblemId : null,
    }),
    items: filtered.slice((page - 1) * 30, page * 30).map((item) => ({
      ...item,
      // Shown on the rows while sorting by it: an aggregate above problem-stats' floor.
      ...(shares?.has(item.judgeProblemId ?? item.id) && {
        acceptance: Math.round(100 * shares.get(item.judgeProblemId ?? item.id)!),
      }),
      // Two marks per row; the filtered company leads so a row shows why it matched.
      companies: [...item.companies]
        .sort((a, b) => Number(b.slug === company) - Number(a.slug === company))
        .slice(0, 2)
        .map(({ slug, name, count, last }) => ({ slug, name, count, last })),
    })),
    total: filtered.length,
    page,
    pageSize: 30,
    topics: [],
    companies: [...companyCounts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'en'),
    ),
    sequence,
    // The study plan (lib/study-plan.ts) counts what is left of the sequence:
    // [problem id, difficulty, stop index, stage index, rating] per unsolved entry, in
    // line order. Stage and rating pick what a short plan keeps.
    planTodo: all.flatMap((item) =>
      item.caseStatus === 'verified' && item.judgeProblemId && !item.solved
        ? [
            [
              item.judgeProblemId,
              item.difficulty,
              STOP_INDEX.get(item.selection.sectionSlug) ?? 0,
              CURATED_STAGES.indexOf(item.selection.stage),
              item.rating === null ? null : Math.round(item.rating),
            ] as const,
          ]
        : [],
    ),
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
        // Topic frequency: companies whose reports map onto this stop, and the reports.
        // ponytail: counted per request from the tags, so hidden companies stay out.
        const asked = items.flatMap((item) => item.companies);
        return {
          ...section,
          total: items.length,
          solved: items.filter((item) => item.solved).length,
          companies: new Set(asked.map((c) => c.slug)).size,
          reports: asked.reduce((sum, c) => sum + c.count, 0),
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
/** Library rows of every problem in a rated contest. */
const ratedRows = () =>
  sqlite()
    .prepare(
      `SELECT ${columns} FROM study_library l WHERE l.number IN (SELECT CAST(key AS INTEGER) FROM json_each(?))`,
    )
    .all(RATINGS_SQL_JSON) as LibraryRow[];
/** Judgeable problems with a contest rating: the weekly contest's pool (lib/server/contests.ts). */
export const ratedJudgeable = () =>
  ratedRows().flatMap((row) =>
    row.ready && row.judge_problem_id
      ? [{ id: row.judge_problem_id, rating: lcRatingOf(row.number)!.rating }]
      : [],
  );

/**
 * view=contests: the bank by weekly / biweekly contest, newest first (a contest's highest
 * problem number stands in for its date), 20 contests a page, with this round's progress.
 */
export function listContests(params: URLSearchParams, userId: string) {
  const progress = studyProgress(userId, practiceRoundState(userId).activeRoundId);
  const cell = (row: LibraryRow) => {
    const { rating, q } = lcRatingOf(row.number)!;
    const state = progress.get(row.id);
    return {
      ...summary(row),
      rating,
      q,
      solved: !!state?.solved,
      progressStatus: (state?.solved ? 'solved' : state?.attempted ? 'attempted' : 'not_started') as
        | 'solved'
        | 'attempted'
        | 'not_started',
    };
  };
  const contests = new Map<string, { code: string; newest: number; problems: ReturnType<typeof cell>[] }>();
  for (const row of ratedRows()) {
    const code = lcRatingOf(row.number)!.contest;
    const entry = contests.get(code) ?? { code, newest: 0, problems: [] };
    entry.problems.push(cell(row));
    entry.newest = Math.max(entry.newest, row.number);
    contests.set(code, entry);
  }
  const sorted = [...contests.values()].sort((a, b) => b.newest - a.newest);
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.get('page') || '1', 10) || 1));
  return {
    contests: sorted.slice((page - 1) * 20, page * 20).map(({ code, problems }) => ({
      code,
      problems: problems.sort((a, b) => a.q - b.q),
    })),
    total: sorted.length,
    page,
    pageSize: 20,
  };
}

/**
 * "Problems at your level": the level is the median rating of the user's latest 30 rated
 * ACs here (START_LEVEL before any), and each tier offers 3 unsolved judgeable problems
 * with the Elo chance of solving them. ponytail: imported LeetCode history does not set the
 * level; it only marks problems solved.
 */
export function levelPicks(userId: string) {
  const accepted = sqlite()
    .prepare(
      "SELECT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND problem_id LIKE 'lc-%' GROUP BY problem_id ORDER BY MAX(created_at) DESC",
    )
    .pluck()
    .all(userId) as string[];
  const ratings = accepted.flatMap((id) => {
    const rating = lcRatingOf(Number(id.slice(3)))?.rating;
    return rating ? [rating] : [];
  });
  const recent = ratings.slice(0, 30);
  const level = median(recent) ?? START_LEVEL;
  const done = new Set(accepted);
  const progress = studyProgress(userId, practiceRoundState(userId).activeRoundId);
  const candidates = ratedRows().flatMap((row) =>
    row.ready && row.judge_problem_id && !done.has(row.judge_problem_id) && !progress.get(row.id)?.solved
      ? [
          {
            id: row.judge_problem_id,
            number: row.number,
            titleZh: row.title_zh,
            titleEn: row.title_en,
            difficulty: row.difficulty,
            rating: lcRatingOf(row.number)!.rating,
          },
        ]
      : [],
  );
  return {
    level,
    samples: recent.length,
    tiers: pickAtLevel(candidates, level).map((tier) => ({
      ...tier,
      items: tier.items.map((item) => ({ ...item, chance: Math.round(100 * solveChance(item.rating, level)) })),
    })),
  };
}
const stopCodes = new Map(
  curatedSections.map((section, index) => [
    section.slug,
    String(index + 1).padStart(2, '0'),
  ]),
);

/**
 * A classic list in its own groups and order. Problems not judgeable here are
 * external: listed with a LeetCode link, left out of progress and the sequence.
 * A book list's problem without a LeetCode twin is external too (number null).
 */
export function listClassicLibrary(list: ClassicList, userId?: string) {
  const entries = list.groups.map(groupEntries);
  const rows = new Map(
    (
      sqlite()
        .prepare(
          `SELECT ${columns} FROM study_library l
    WHERE l.number IN (SELECT value FROM json_each(?))`,
        )
        .all(
          JSON.stringify(entries.flat().flatMap((entry) => entry.number ?? [])),
        ) as LibraryRow[]
    ).map((row) => [row.number, summary(row)]),
  );
  // Progress in the active round, as on Line 500.
  const progress = userId
    ? studyProgress(userId, practiceRoundState(userId).activeRoundId)
    : new Map();
  const item = ({ number, ref, refSlug }: ClassicEntry) => {
    const row = number === null ? undefined : rows.get(number);
    // summary() only exposes the judge id of a problem that is judgeable now.
    const judgeProblemId = row?.judgeProblemId ?? null;
    const state = judgeProblemId ? progress.get(row!.id) : undefined;
    const selection = number === null ? undefined : curatedByNumber.get(number);
    const [stopZh, stopEn] =
      selection && Object.hasOwn(STOP_NAMES, selection.sectionSlug)
        ? STOP_NAMES[selection.sectionSlug]
        : [selection?.sectionTitle ?? '', selection?.sectionTitleEn ?? ''];
    return {
      number,
      /** The book's own number and leetcode.cn page; null on LeetCode lists. */
      ref,
      refSlug,
      slug: row?.slug ?? '',
      titleZh: row?.titleZh ?? '',
      titleEn: row?.titleEn ?? '',
      difficulty: row?.difficulty ?? '',
      judgeProblemId,
      external: !judgeProblemId,
      // Its Line 500 stop, judgeable here or not.
      stop: selection
        ? {
            slug: selection.sectionSlug,
            code: stopCodes.get(selection.sectionSlug) ?? '',
            nameZh: stopZh,
            nameEn: stopEn,
          }
        : null,
      solved: !!state?.solved,
      progressStatus: (state?.solved
        ? 'solved'
        : state?.attempted
          ? 'attempted'
          : 'not_started') as 'solved' | 'attempted' | 'not_started',
      judging: !!state?.pending,
    };
  };
  const groups = list.groups.map((group, index) => {
    const items = entries[index].map(item);
    const judgeable = items.filter((entry) => !entry.external);
    return {
      nameZh: group.nameZh,
      nameEn: group.nameEn,
      total: items.length,
      ready: judgeable.length,
      solved: judgeable.filter((entry) => entry.solved).length,
      items,
    };
  });
  // A number listed in two groups counts once; every book problem counts.
  const unique = [
    ...new Map(
      groups.flatMap((group) => group.items).map((entry) => [entry.ref ?? entry.number, entry]),
    ).values(),
  ];
  const judgeable = unique.filter((entry) => !entry.external);
  return {
    collection: {
      id: list.slug,
      nameZh: list.nameZh,
      nameEn: list.nameEn,
      source: list.source,
      total: unique.length,
      /** Problems with a LeetCode twin (all of them on a LeetCode list). */
      mapped: unique.filter((entry) => entry.number !== null).length,
      ready: judgeable.length,
      solved: judgeable.filter((entry) => entry.solved).length,
    },
    groups,
    // Two book problems can share one twin: it is solved once.
    sequence: [...new Set(judgeable.map((entry) => entry.judgeProblemId!))],
    nextProblemId:
      judgeable.find((entry) => !entry.solved)?.judgeProblemId ?? null,
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

// Server-only: the three Line 500 hints never enter a client bundle.
const lingHintFile = hintFile as Record<string, { zh: string[]; en: string[] }>;
/** The three progressive hints of a Line 500 problem: observation, invariant, steps. */
export const lingHints = (problemId: string) =>
  Object.hasOwn(lingHintFile, problemId) ? lingHintFile[problemId] : null;

export type SimilarProblem = {
  id: string;
  title: string;
  titleEn?: string;
  difficulty: string;
  solved: boolean;
};

/**
 * Line 500 numbers like `number`: the 4 judgeable ones nearest it in the same stop by
 * curated order (shown in that order), then up to 2 more asked by the same companies,
 * most companies in common first.
 */
export function pickSimilarLc(
  number: number,
  judgeable: readonly number[],
  companiesOf: (number: number) => readonly string[],
) {
  const self = curatedByNumber.get(number);
  const order = (n: number) => curatedByNumber.get(n)?.order ?? Infinity;
  const others = judgeable.filter((n) => n !== number && curatedByNumber.has(n));
  const near = self
    ? others
        .filter((n) => curatedByNumber.get(n)!.sectionSlug === self.sectionSlug)
        .sort(
          (a, b) =>
            Math.abs(order(a) - self.order) - Math.abs(order(b) - self.order) ||
            order(a) - order(b),
        )
        .slice(0, 4)
        .sort((a, b) => order(a) - order(b))
    : [];
  const mine = new Set(companiesOf(number));
  const shared = (n: number) => companiesOf(n).filter((c) => mine.has(c)).length;
  const asked = others
    .filter((n) => !near.includes(n) && shared(n) > 0)
    .sort((a, b) => shared(b) - shared(a) || order(a) - order(b))
    .slice(0, 2);
  return [...near, ...asked];
}

/**
 * Same-company OA problems like `id` (`company` is the judgeable ones in catalog order):
 * those sharing a topic, most shared first, then the ones after it in catalog order.
 */
export function pickSimilarOa(
  id: string,
  company: readonly string[],
  topicsOf: (id: string) => readonly string[],
  max = 6,
) {
  const at = company.indexOf(id);
  const after = [...company.slice(at + 1), ...company.slice(0, Math.max(at, 0))];
  const mine = new Set(topicsOf(id));
  const shared = (x: string) => topicsOf(x).filter((t) => mine.has(t)).length;
  const overlap = after.filter((x) => shared(x) > 0).sort((a, b) => shared(b) - shared(a));
  return [...new Set([...overlap, ...after])].slice(0, max);
}

/** "Similar problems" under a statement: judgeable ones only, each marked solved for the user. */
export async function similarProblems(
  problemId: string,
  userId: string | undefined,
  tags: ReadonlyMap<string, CompanyTag[]> = companyTagIndex(hiddenCompanies()),
): Promise<SimilarProblem[]> {
  if (problemId.startsWith('oa-')) {
    const found = oaLibrary().problem(problemId);
    if (!found) return [];
    const ready = await oaReadyProblems();
    const items = (oaLibrary().company(found.company.slug, new Set(ready.keys()))?.items ?? [])
      .filter((item) => item.judgeStatus === 'ready');
    const byId = new Map(items.map((item) => [item.id, item]));
    const picked = pickSimilarOa(
      problemId,
      items.map((item) => item.id),
      (id) => oaTopic(id)?.t ?? [],
    );
    const solved = new Set(
      userId
        ? (
            await rows<{ problem_id: string }>(
              `SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND problem_id IN (SELECT value FROM json_each(?))`,
              userId,
              JSON.stringify(picked),
            )
          ).map((r) => r.problem_id)
        : [],
    );
    return picked.map((id) => ({
      id,
      title: byId.get(id)!.title,
      difficulty: oaDifficulty(id, ready.get(id)?.difficulty).difficulty ?? '中等',
      solved: solved.has(id),
    }));
  }
  const number = Number(/^lc-(\d+)$/.exec(problemId)?.[1]);
  if (!number) return [];
  // ponytail: reads the 500 Line 500 rows per call, like the list; narrow to candidates if it shows in profiles.
  const judgeable = new Map(
    (
      sqlite()
        .prepare(
          `SELECT ${columns} FROM study_library l WHERE l.number IN (SELECT value FROM json_each(?))`,
        )
        .all(JSON.stringify(curatedEntries.map((entry) => entry.number))) as LibraryRow[]
    )
      .filter((row) => row.ready && row.judge_problem_id)
      .map((row) => [row.number, row]),
  );
  const picked = pickSimilarLc(number, [...judgeable.keys()], (n) =>
    (tags.get(`lc-${n}`) ?? []).map((c) => c.slug),
  );
  // Solved as on the Line 500 list: this practice round, imported LeetCode records included.
  const progress = userId
    ? studyProgress(userId, ensurePracticeRound(userId))
    : new Map();
  return picked.map((n) => {
    const row = judgeable.get(n)!;
    return {
      id: row.judge_problem_id!,
      title: row.title_zh,
      titleEn: row.title_en,
      // Imported rows may say Easy/Medium/Hard; the workspace speaks 简单/中等/困难.
      difficulty:
        ({ easy: '简单', medium: '中等', hard: '困难' } as Record<string, string>)[
          row.difficulty.toLowerCase()
        ] ?? row.difficulty,
      solved: !!progress.get(row.id)?.solved,
    };
  });
}
