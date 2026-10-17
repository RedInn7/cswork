import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { classicList, groupEntries } from '@/lib/classic-lists';
import { curatedByNumber, curatedEntries, curatedHint, curatedSections } from '@/lib/ling-curated';
import { parseNoteMeta } from '@/lib/note-meta';
import { noteGist, readCard, type ExportItem, type ProblemMeta } from '@/lib/notes-export';
import { reviewState, wrongBook } from '@/lib/practice-review';
import type { Person } from './auth';
import { companyHub } from './company-hub';
import { library } from './content-library';
import { runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { practiceHistory, problemMarks } from './my-practice';
import { studyLibrarySummaries } from './study-library';

// oj-api routes every method of oj/notes/export and oj/cheatsheet here; anything but GET stays 404.
// Neither is about one problem, so instead of refuseInContest both answer 403 while
// runningContestProblems(p.id) is not empty (a running contest or skill test): no pulling one's
// notes and accepted code in bulk during an exam, as the workspace closes notes in exam mode.
function refuseInExam(p: Person) {
  if (runningContestProblems(p.id).size) throw new HttpError(403, '比赛或考试进行中，笔记导出和复习单要等结束后再用');
}

const curated = (id: string) => curatedByNumber.get(Number(/^lc-(\d+)$/.exec(id)?.[1]));
/** Study-library titles of the LeetCode ids, with their Line 500 stop and route order. */
function problemMeta(ids: readonly string[]) {
  const meta = new Map<string, ProblemMeta>();
  for (const s of studyLibrarySummaries(ids.filter((id) => id.startsWith('lc-'))))
    meta.set(s.id, { title: s.titleZh, titleEn: s.titleEn, difficulty: s.difficulty, topics: s.topics });
  for (const id of ids) {
    const entry = curated(id);
    if (entry) meta.set(id, { ...meta.get(id), stop: entry.sectionSlug, order: entry.order });
  }
  return meta;
}

// Written notes, stories, cards, clips and system design drafts. JSON state stays out: pref:, recall:,
// mcq:, wb:, checklist:, project:, career:, list:, q:, post: and the sd:<chapter> quiz answers.
const KINDS = ['problem', 'sub', 'content', 'story', 'topic', 'card', 'clip', 'sd'] as const;
const kindSql = (kind: (typeof KINDS)[number]) =>
  kind === 'sd' ? "n.target LIKE 'sd:%/draft'" : `n.target LIKE '${kind}:%'`;
// ponytail: a page stops past 2 MB of bodies and code, or at 200 notes (4 MB of 20 KB bodies read at
// most); 5000 notes take 25 pages, inside the 60 an hour.
const PAGE_BYTES = 2_000_000;
const PAGE_ROWS = 200;
const exportQuery = z.object({
  cursor: z.string().max(210).default(''),
  prefix: z.enum(KINDS).optional(),
  code: z.literal('1').optional(),
});

/** The learner's exportable notes by target, a page at a time; problem notes with their latest AC (and its code). */
function exportNotes(userId: string, params: URLSearchParams) {
  const q = exportQuery.parse(Object.fromEntries(params));
  const rows = sqlite()
    .prepare(
      `SELECT n.target,n.body,n.updated_at AS updatedAt,a.lastAc,s.problem_id AS problemId FROM user_notes n
      LEFT JOIN (SELECT problem_id,MAX(created_at) AS lastAc FROM submissions
        WHERE user_id=? AND mode='judge' AND status='accepted' GROUP BY problem_id) a ON n.target='problem:'||a.problem_id
      LEFT JOIN submissions s ON n.target LIKE 'sub:%' AND s.id=substr(n.target,5) AND s.user_id=n.user_id
      WHERE n.user_id=? AND (${(q.prefix ? [q.prefix] : KINDS).map(kindSql).join(' OR ')}) AND n.target>?
      ORDER BY n.target LIMIT ${PAGE_ROWS + 1}`,
    )
    .all(userId, userId, q.cursor) as (ExportItem & { lastAc: number | null; problemId: string | null })[];
  const lastCode = sqlite().prepare(
    `SELECT language,code FROM submissions WHERE user_id=? AND problem_id=? AND mode='judge' AND status='accepted'
    ORDER BY created_at DESC,id DESC LIMIT 1`,
  );
  const items: ExportItem[] = [];
  let bytes = 0;
  for (const { lastAc, problemId, ...row } of rows.slice(0, PAGE_ROWS)) {
    const problem = row.target.startsWith('problem:') ? row.target.slice(8) : null;
    const code =
      q.code && problem && lastAc ? (lastCode.get(userId, problem) as ExportItem['code'] | undefined) : undefined;
    const size = Buffer.byteLength(row.body) + (code ? Buffer.byteLength(code.code) : 0);
    if (items.length && bytes + size > PAGE_BYTES) break;
    bytes += size;
    items.push({ ...row, ...(problem !== null && { lastAc }), ...(problemId !== null && { problemId }), ...(code && { code }) });
  }
  const meta = problemMeta(items.flatMap((i) => (i.target.startsWith('problem:') ? [i.target.slice(8)] : [])));
  for (const item of items) if (item.target.startsWith('problem:') && meta.has(item.target.slice(8))) item.meta = meta.get(item.target.slice(8));
  return { items, nextCursor: items.length < rows.length ? items.at(-1)!.target : null };
}

const ROWS = 80;
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const stopSlugs = curatedSections.map((s) => s.slug) as [string, ...string[]];
const sheetQuery = z.union([
  z.object({ company: slug }).strict(),
  z.object({ stops: z.string().transform((s) => [...new Set(s.split(','))]).pipe(z.array(z.enum(stopSlugs)).min(1).max(8)) }).strict(),
  z.object({ list: slug }).strict(),
]);

/** The scope's problem ids in its order, the titles it knows and the slugs its cards may be tagged with. */
function sheetScope(params: URLSearchParams) {
  const q = sheetQuery.parse(Object.fromEntries(params));
  if ('company' in q) {
    const hub = companyHub(library(), q.company);
    if (!hub) throw new HttpError(404, '公司不存在');
    const titles = new Map<string, ProblemMeta>();
    for (const p of hub.leetcode.slice(0, 50))
      titles.set(p.judgeProblemId ?? p.id, { title: p.titleZh, titleEn: p.titleEn, difficulty: p.difficulty });
    for (const item of hub.oa) titles.set(item.id, { title: item.title });
    return { kind: 'company', name: hub.company.name, ids: [...titles.keys()], titles, tags: [q.company] };
  }
  if ('stops' in q) {
    const ids = curatedEntries.filter((e) => q.stops.includes(e.sectionSlug)).map((e) => `lc-${e.number}`);
    return { kind: 'stops', name: null, ids, titles: problemMeta(ids), tags: q.stops };
  }
  const list = classicList(q.list);
  if (!list) throw new HttpError(404, '未知题单');
  const ids = [
    ...new Set(list.groups.flatMap(groupEntries).flatMap((e) => (e.number ? [`lc-${e.number}`] : e.judge ? [e.judge] : []))),
  ];
  return { kind: 'list', name: { zh: list.nameZh, en: list.nameEn }, ids, titles: problemMeta(ids), tags: [list.slug] };
}

/**
 * The one-page review sheet of a company's, Line 500 stops' or a classic list's problems: one row
 * per problem the learner wrote a note on, starred, queued to redo, got wrong or keeps failing
 * (leeches first, then confidence ≤ 2, redo, starred); then those stops' pattern notes and the
 * cards tagged for the scope.
 */
function reviewSheet(userId: string, params: URLSearchParams) {
  const scope = sheetScope(params);
  const db = sqlite();
  // ponytail: the first 8000 characters, as note-links reads tags; a gist past them is missed.
  const notes = new Map(
    (
      db
        .prepare(
          `SELECT substr(target,9) AS id,substr(body,1,8000) AS body FROM user_notes
          WHERE user_id=? AND target IN (SELECT 'problem:'||value FROM json_each(?))`,
        )
        .all(userId, JSON.stringify(scope.ids)) as { id: string; body: string }[]
    ).map((n) => [n.id, n.body]),
  );
  const marks = problemMarks(userId);
  const history = practiceHistory(userId);
  const wrong = new Set(wrongBook(history).map((i) => i.problemId));
  const leeches = new Set(history.filter((i) => i.acAt.length && reviewState(i).leech).map((i) => i.problemId));
  const rows = scope.ids.flatMap((id) => {
    const body = notes.get(id);
    const m = [...(marks.get(id) ?? [])].filter((k) => k === 'star' || k === 'redo');
    const { tags, confidence } = body ? parseNoteMeta(body) : { tags: [], confidence: null };
    const gist = (body && noteGist(body)) || null;
    // An inserted template left unfilled says nothing, so it counts as no note.
    if (!gist && !tags.length && !confidence && !m.length && !wrong.has(id) && !leeches.has(id)) return [];
    const t = scope.titles.get(id);
    return [
      {
        id,
        title: t?.title ?? null,
        titleEn: t?.titleEn ?? null,
        difficulty: t?.difficulty ?? null,
        marks: m,
        wrong: wrong.has(id),
        leech: leeches.has(id),
        gist,
        // The curated one-line approach, served with the problem anyway.
        hint: gist ? null : curatedHint(id),
        tags,
        confidence,
      },
    ];
  });
  const rank = (r: (typeof rows)[number]) =>
    r.leech ? 0 : r.confidence && r.confidence <= 2 ? 1 : r.marks.includes('redo') ? 2 : r.marks.includes('star') ? 3 : 4;
  rows.sort((a, b) => rank(a) - rank(b));
  // The scope's stops in its order and their pattern notes (topic:<stop>), 800 characters each, 8 at most.
  const stops = [...new Set(scope.kind === 'stops' ? scope.tags : scope.ids.flatMap((id) => curated(id)?.sectionSlug ?? []))];
  const topics = (
    db
      .prepare(
        `SELECT substr(target,7) AS stop,substr(body,1,800) AS text FROM user_notes
        WHERE user_id=? AND target IN (SELECT 'topic:'||value FROM json_each(?))`,
      )
      .all(userId, JSON.stringify(stops)) as { stop: string; text: string }[]
  )
    .sort((a, b) => stops.indexOf(a.stop) - stops.indexOf(b.stop))
    .slice(0, 8);
  // Cards tagged with the company, the list or one of the stops, or made from one of the scope's problems.
  const tags = new Set([...scope.tags, ...stops]);
  const ids = new Set(scope.ids);
  const cut = (text: string) => (text.length > 240 ? `${text.slice(0, 239)}…` : text);
  const cards = (
    db
      .prepare("SELECT target,body FROM user_notes WHERE user_id=? AND target LIKE 'card:%' ORDER BY target LIMIT 500")
      .all(userId) as { target: string; body: string }[]
  )
    .flatMap(({ target, body }) => {
      const card = readCard(body);
      const from = card?.src && /[?&]problem=([\w-]+)/.exec(card.src.href)?.[1];
      return card && (card.tags.some((tag) => tags.has(tag)) || (from && ids.has(from)))
        ? [{ id: target.slice(5), front: cut(card.front), back: cut(card.back) }]
        : [];
    })
    .slice(0, 30);
  return { kind: scope.kind, name: scope.name, stops, total: rows.length, rows: rows.slice(0, ROWS), topics, cards };
}
export type ReviewSheet = ReturnType<typeof reviewSheet>;

/** GET oj/notes/export?cursor=&prefix=&code=1, private to the learner: limit(p,'notes-export',60,3600). */
export async function handleNoteExport(request: Request, p: Person): Promise<Response> {
  if (request.method !== 'GET') throw new HttpError(404, '判题接口不存在');
  await limit(p, 'notes-export', 60, 3600);
  refuseInExam(p);
  return json(exportNotes(p.id, new URL(request.url).searchParams));
}

/** GET oj/cheatsheet?company=|stops=|list=, private to the learner: limit(p,'cheatsheet-read',30). */
export async function handleCheatsheet(request: Request, p: Person): Promise<Response> {
  if (request.method !== 'GET') throw new HttpError(404, '判题接口不存在');
  await limit(p, 'cheatsheet-read', 30);
  refuseInExam(p);
  return json(reviewSheet(p.id, new URL(request.url).searchParams));
}
