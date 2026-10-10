import type { Person } from './auth';
import { sqlite } from '@/db/sqlite';
import { canSeeCourse } from './course-visibility';
import { HttpError } from './http';
import { oaLibrary } from './oa-library';

/**
 * Public judge status board (like vjudge.net/status): formal submissions only, metadata
 * only. Source code, case results, emails and user ids never leave this module; the
 * owner reads details through the owner-checked submission endpoints as before.
 */
const PAGE = 30;
const PENDING = ['queued', 'compiling', 'running'];
const RESULTS = new Set([
  'accepted', 'wrong_answer', 'time_limit', 'memory_limit', 'output_limit',
  'runtime_error', 'compile_error', 'system_error', 'cancelled', 'pending',
]);
const LANGUAGES = new Set(['cpp', 'python', 'java', 'go']);
const libraryProblem = `s.problem_id IN (SELECT judge_problem_id FROM study_library WHERE judge_problem_id IS NOT NULL)`;

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
  const where = ["s.mode='judge'"],
    args: (string | number)[] = [];
  // Course exercises follow course visibility (owner-only mode hides them from everyone
  // else); OA and library problems are public.
  const hidden = (db.prepare('SELECT id FROM courses').all() as { id: string }[])
    .map((c) => c.id)
    .filter((id) => !canSeeCourse(viewer, id));
  if (hidden.length) {
    where.push(
      `(s.problem_id LIKE 'oa-%' OR ${libraryProblem} OR p.course_id NOT IN (${hidden.map(() => '?').join(',')}))`,
    );
    args.push(...hidden);
  }
  const cursor = Number(params.get('cursor'));
  if (Number.isSafeInteger(cursor) && cursor > 0) {
    where.push('s.rowid < ?');
    args.push(cursor);
  }
  const problem = params.get('problem');
  if (problem) {
    where.push('s.problem_id = ?');
    args.push(problem.slice(0, 80));
  }
  const result = params.get('result');
  if (result) {
    if (!RESULTS.has(result)) throw new HttpError(400, '未知的评测结果');
    if (result === 'pending') where.push(`s.status IN ('${PENDING.join("','")}')`);
    else {
      where.push('s.status = ?');
      args.push(result);
    }
  }
  const language = params.get('language');
  if (language) {
    if (!LANGUAGES.has(language)) throw new HttpError(400, '未知的语言');
    where.push('s.language = ?');
    args.push(language);
  }
  const name = params.get('user')?.trim();
  if (name) {
    where.push('u.name = ?');
    args.push(name.slice(0, 80));
  }
  if (params.get('mine') === '1') {
    if (!viewer) throw new HttpError(401, '请先登录');
    where.push('s.user_id = ?');
    args.push(viewer.id);
  }
  // rowid follows insertion order, so the newest-first scan needs no extra index.
  const found = db
    .prepare(
      `SELECT s.rowid AS seq,s.id,s.user_id,s.problem_id,s.language,s.status,s.passed,s.total,
        s.runtime,s.memory,length(CAST(s.code AS BLOB)) AS code_bytes,s.created_at,u.name AS user_name,
        ${libraryProblem} AS library
      FROM submissions s JOIN oj_problems p ON p.id=s.problem_id LEFT JOIN user u ON u.id=s.user_id
      WHERE ${where.join(' AND ')} ORDER BY s.rowid DESC LIMIT ${PAGE + 1}`,
    )
    .all(...args) as Row[];
  const items = found.slice(0, PAGE).map((r) => ({
    seq: r.seq,
    run: r.id.slice(0, 8),
    problemId: r.problem_id,
    source: r.problem_id.startsWith('oa-')
      ? { kind: 'oa' as const, company: oaCompany(r.problem_id) }
      : { kind: r.library ? ('library' as const) : ('course' as const) },
    user: r.user_name?.trim() || '学员',
    mine: !!viewer && r.user_id === viewer.id,
    language: r.language,
    status: r.status,
    passed: r.passed,
    total: r.total,
    runtimeMs: r.runtime == null ? null : Math.round(r.runtime * 1000),
    memoryKb: r.memory,
    codeBytes: r.code_bytes,
    createdAt: r.created_at,
  }));
  return {
    items,
    next: found.length > PAGE ? items[items.length - 1].seq : null,
    stats: cursor ? undefined : feedStats(),
  };
}

/** Cheap, bounded numbers for the page header (index scans and a 200-row window). */
function feedStats() {
  const db = sqlite();
  const judging = db
    .prepare(`SELECT COUNT(*) AS n FROM submissions WHERE status IN ('${PENDING.join("','")}')`)
    .get() as { n: number };
  const recent = db
    .prepare(
      `SELECT COUNT(*) AS n,COALESCE(SUM(status='accepted'),0) AS ac FROM
        (SELECT status FROM submissions WHERE mode='judge' AND status NOT IN ('${PENDING.join("','")}','cancelled') ORDER BY rowid DESC LIMIT 200)`,
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
