import type { Person } from './auth';
import { sqlite } from '@/db/sqlite';
import { visibleCourseSql } from './course-visibility';
import { HttpError } from './http';
import { oaLibrary } from './oa-library';

/**
 * Public judge status board (like vjudge.net/status): formal submissions only, metadata
 * only. Source code, case results, emails and user ids never leave this module, and
 * other people's names are masked (Google sign-in names are often real names).
 */
const PAGE = 30;
// Unindexed filters (result, language) scan at most this many submissions per
// request; an empty window still returns a cursor so the client can keep going.
const WINDOW = 20000;
const PENDING = `('queued','compiling','running')`;
const RESULTS = new Set([
  'accepted', 'wrong_answer', 'time_limit', 'memory_limit', 'output_limit',
  'runtime_error', 'compile_error', 'system_error', 'cancelled', 'pending',
]);
const LANGUAGES = new Set(['cpp', 'python', 'java', 'go']);
const libraryProblem = `s.problem_id IN (SELECT judge_problem_id FROM study_library WHERE judge_problem_id IS NOT NULL)`;

/** OA and library problems are public; course exercises follow course visibility. */
const visible = (viewer: Person | null) =>
  `(s.problem_id LIKE 'oa-%' OR ${libraryProblem} OR (1=1${visibleCourseSql(viewer, 'p.course_id')}))`;

/** "张**", "Al***": enough to tell rows apart without publishing a real name. */
const graphemes = new Intl.Segmenter('zh', { granularity: 'grapheme' });
export function maskName(name: string | null) {
  const text = (name || '').trim();
  const chars = Array.from(graphemes.segment(text), (g) => g.segment);
  if (!chars.length || text === '学员') return '学员';
  if (/[㐀-鿿]/.test(chars[0])) return chars[0] + '*'.repeat(Math.min(2, Math.max(1, chars.length - 1)));
  return chars.slice(0, 2).join('') + '***';
}

let companies: Map<string, string> | undefined;
function oaCompany(problemId: string) {
  companies ??= new Map(
    oaLibrary().list(new URLSearchParams()).companies.map((c) => [c.slug, c.name]),
  );
  const slug = problemId.replace(/^oa-/, '').replace(/-\d+$/, '');
  return { slug, name: companies.get(slug) || slug };
}

type Row = {
  seq: number;
  id: string;
  user_id: string;
  problem_id: string;
  language: string;
  status: string;
  passed: number;
  total: number;
  runtime: number | null;
  memory: number | null;
  code_bytes: number;
  created_at: number;
  user_name: string | null;
  library: number;
};

export function judgeFeed(viewer: Person | null, params: URLSearchParams) {
  const db = sqlite();
  const where = ["s.mode='judge'", visible(viewer)],
    args: (string | number)[] = [];
  const cursor = Number(params.get('cursor'));
  const hasCursor = Number.isSafeInteger(cursor) && cursor > 0;
  if (hasCursor) {
    where.push('s.rowid < ?');
    args.push(cursor);
  }
  const problem = params.get('problem');
  if (problem) {
    where.push('s.problem_id = ?');
    args.push(problem.slice(0, 80));
  }
  // "Someone's submissions" is addressed by one of their visible submissions, so
  // neither names nor user ids appear in URLs.
  let userId: string | undefined, userLabel: string | undefined;
  const userOf = Number(params.get('userOf'));
  if (params.has('userOf')) {
    const owner = Number.isSafeInteger(userOf)
      ? (db
          .prepare(
            `SELECT s.user_id,u.name FROM submissions s JOIN oj_problems p ON p.id=s.problem_id
             LEFT JOIN user u ON u.id=s.user_id WHERE s.rowid=? AND s.mode='judge' AND ${visible(viewer)}`,
          )
          .get(userOf) as { user_id: string; name: string | null } | undefined)
      : undefined;
    if (!owner) throw new HttpError(404, '没有找到这位用户的提交');
    userId = owner.user_id;
    userLabel = viewer?.id === userId ? owner.name || '我' : maskName(owner.name);
  }
  if (params.get('mine') === '1') {
    if (!viewer) throw new HttpError(401, '请先登录');
    userId = viewer.id;
  }
  if (userId) {
    where.push('s.user_id = ?');
    args.push(userId);
  }
  const result = params.get('result');
  if (result) {
    if (!RESULTS.has(result)) throw new HttpError(400, '未知的评测结果');
    if (result === 'pending') where.push(`s.status IN ${PENDING}`);
    else {
      // Unary + keeps the planner off the status index: walking rowid backwards
      // stops at a page, while the index would fetch and sort every such row.
      where.push('+s.status = ?');
      args.push(result);
    }
  }
  const language = params.get('language');
  if (language) {
    if (!LANGUAGES.has(language)) throw new HttpError(400, '未知的语言');
    where.push('s.language = ?');
    args.push(language);
  }
  // problem_id and user_id are indexed and the pending queue is tiny; anything else
  // that filters rows is bounded to a window of the newest submissions.
  let floor: number | null = null;
  if ((result && result !== 'pending') || language) {
    if (!problem && !userId) {
      const top = hasCursor
        ? cursor
        : ((db.prepare('SELECT MAX(rowid) AS n FROM submissions').get() as { n: number | null }).n ?? 0) + 1;
      floor = Math.max(1, top - WINDOW);
      where.push('s.rowid >= ?');
      args.push(floor);
    }
  }
  const found = db
    .prepare(
      `SELECT s.rowid AS seq,s.id,s.user_id,s.problem_id,s.language,s.status,s.passed,s.total,
        s.runtime,s.memory,octet_length(s.code) AS code_bytes,s.created_at,u.name AS user_name,
        ${libraryProblem} AS library
      FROM submissions s JOIN oj_problems p ON p.id=s.problem_id LEFT JOIN user u ON u.id=s.user_id
      WHERE ${where.join(' AND ')} ORDER BY s.rowid DESC LIMIT ${PAGE + 1}`,
    )
    .all(...args) as Row[];
  const items = found.slice(0, PAGE).map((r) => {
    const mine = !!viewer && r.user_id === viewer.id;
    return {
      seq: r.seq,
      run: r.id.slice(0, 8),
      problemId: r.problem_id,
      source: r.problem_id.startsWith('oa-')
        ? { kind: 'oa' as const, company: oaCompany(r.problem_id) }
        : { kind: r.library ? ('library' as const) : ('course' as const) },
      user: mine ? r.user_name?.trim() || '我' : maskName(r.user_name),
      mine,
      language: r.language,
      status: r.status,
      passed: r.passed,
      total: r.total,
      runtimeMs: r.runtime == null ? null : Math.round(r.runtime * 1000),
      memoryKb: r.memory,
      codeBytes: r.code_bytes,
      createdAt: r.created_at,
    };
  });
  return {
    items,
    next:
      found.length > PAGE
        ? items[items.length - 1].seq
        : floor !== null && floor > 1
          ? floor
          : null,
    userLabel,
    stats: hasCursor ? undefined : feedStats(viewer),
  };
}

/** Cheap, bounded numbers for the page header, limited to what the viewer may see. */
function feedStats(viewer: Person | null) {
  const db = sqlite();
  const judging = db
    .prepare(
      `SELECT COUNT(*) AS n FROM submissions s JOIN oj_problems p ON p.id=s.problem_id
       WHERE s.status IN ${PENDING} AND ${visible(viewer)}`,
    )
    .get() as { n: number };
  const recent = db
    .prepare(
      `SELECT COUNT(*) AS n,COALESCE(SUM(status='accepted'),0) AS ac FROM
        (SELECT s.status FROM submissions s JOIN oj_problems p ON p.id=s.problem_id
         WHERE s.mode='judge' AND +s.status NOT IN ('queued','compiling','running','cancelled')
           AND ${visible(viewer)} ORDER BY s.rowid DESC LIMIT 200)`,
    )
    .get() as { n: number; ac: number };
  const runtime = db
    .prepare("SELECT healthy,details FROM oj_runtime WHERE id='worker'")
    .get() as { healthy: number; details: string } | undefined;
  let concurrency: number | null = null;
  try {
    concurrency = JSON.parse(runtime?.details || '{}').submissionConcurrency ?? null;
  } catch {
    concurrency = null;
  }
  return {
    judging: judging.n,
    recent: recent.n,
    recentAccepted: recent.ac,
    concurrency: runtime?.healthy ? concurrency : null,
  };
}
