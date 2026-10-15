import { randomBytes, randomInt } from 'node:crypto';
import { sqlite } from '@/db/sqlite';
import sqlTrack from '@/lib/content/sql-track.json';
import { curatedByNumber } from '@/lib/ling-curated';
import { drawMock, seededRandom, slotOf, summarizeAttempts, type PoolItem } from '@/lib/mock-oa';
import { SKILL_COOLDOWN_DAYS, SKILL_TESTS, skillScore, skillTest, type SkillTest } from '@/lib/skill-tests';
import type { Person } from './auth';
import { learnProblems } from './beginner-courses';
import { externalCertificates, issueCertificate } from './certificates';
import { requireVerified } from './contests';
import { HttpError, json, limit, requirePerson } from './http';
import { lcRating } from './lc-ratings';
import { catalogue } from './mock-oa';

/**
 * Skill certification exams (/certify). The server draws the questions and owns the clock; the
 * workspace runs the exam as a mock OA session (components/skill-test.tsx). While one runs, its
 * problems count as a running contest (contests.ts runningContestProblems), so editorials, hints,
 * community posts and the AI tutor are refused. Finishing, or the deadline, scores the learner's
 * judge submissions inside the window like the mock OA report; a pass issues skill:<test>.
 */
const DAY = 86400000;
const COOLDOWN = SKILL_COOLDOWN_DAYS * DAY;
// ponytail: a verdict still judging this long after the end stops holding the score back.
const JUDGE_GRACE = 10 * 60000;

type Row = {
  id: string;
  user_id: string;
  test: string;
  ids_json: string;
  language: string | null;
  started_at: number;
  deadline: number;
  finished_at: number | null;
  score: number | null;
  max: number | null;
  passed: number | null;
};

/** The pools, swappable in tests: judgeable Line 500 problems with a contest rating, and the published SQL track. */
export const skillSources = {
  async line500() {
    return [...(await catalogue()).lc.values()].flatMap((item) => {
      const rating = curatedByNumber.has(Number(item.id.slice(3))) ? lcRating(item.id) : null;
      return rating === null ? [] : [{ ...item, rating }];
    });
  },
  sql(): PoolItem[] {
    const published = new Set(
      sqlite()
        .prepare("SELECT id FROM oj_problems WHERE published=1 AND current_version_id IS NOT NULL AND id LIKE 'sql-%'")
        .pluck()
        .all() as string[],
    );
    return sqlTrack.problems
      .filter((p) => published.has(p.id))
      .map((p) => ({ id: p.id, difficulty: slotOf(p.difficulty), loose: false }));
  },
};

async function pool(test: SkillTest): Promise<PoolItem[]> {
  if (!test.band) return skillSources.sql();
  const [min, max] = test.band;
  return (await skillSources.line500()).filter(
    (item) => item.rating >= min && item.rating < max && !learnProblems.has(item.id),
  );
}

const view = (r: Row) => ({
  id: r.id,
  test: r.test,
  ids: JSON.parse(r.ids_json) as string[],
  language: r.language,
  startedAt: r.started_at,
  deadline: r.deadline,
  finishedAt: r.finished_at,
  score: r.score,
  max: r.max,
  passed: r.passed === null ? null : !!r.passed,
});

/** Scores an ended attempt from its window's submissions, once none is still judging (or the grace is over). */
function settle(r: Row, now: number): Row {
  const end = r.finished_at ?? r.deadline;
  if (r.score !== null || now < end) return r;
  const db = sqlite();
  const found = db
    .prepare(
      `SELECT problem_id,status,passed,total,created_at FROM submissions
      WHERE user_id=? AND mode='judge' AND created_at BETWEEN ? AND ? AND (? IS NULL OR language=?)
        AND problem_id IN (SELECT value FROM json_each(?)) ORDER BY created_at`,
    )
    .all(r.user_id, r.started_at, end, r.language, r.language, r.ids_json) as {
    problem_id: string;
    status: string;
    passed: number;
    total: number;
    created_at: number;
  }[];
  const items = (JSON.parse(r.ids_json) as string[]).map((id) =>
    summarizeAttempts(
      found.filter((s) => s.problem_id === id),
      r.started_at,
    ),
  );
  if (items.some((i) => i.pending) && now < end + JUDGE_GRACE) return { ...r, finished_at: end };
  const { score, max, passed } = skillScore(items.map((i) => i.best));
  db.transaction(() => {
    const { changes } = db
      .prepare('UPDATE skill_attempts SET finished_at=?,score=?,max=?,passed=? WHERE id=? AND score IS NULL')
      .run(end, score, max, +passed, r.id);
    if (changes && passed) issueCertificate(r.user_id, `skill:${r.test}`, now);
  })();
  return { ...r, finished_at: end, score, max, passed: +passed };
}

/** The catalogue state for this learner: attempts (ended ones scored), the running one, cooldowns, certificates. */
export function skillOverview(p: Person, now = Date.now()) {
  const rows = (
    sqlite().prepare('SELECT * FROM skill_attempts WHERE user_id=? ORDER BY started_at DESC').all(p.id) as Row[]
  ).map((r) => settle(r, now));
  const running = rows.find((r) => r.finished_at === null && now < r.deadline);
  return {
    now,
    running: running ? view(running) : null,
    attempts: rows.slice(0, 50).map(view),
    // When each test opens again (null: never taken).
    nextAt: Object.fromEntries(
      SKILL_TESTS.map((t) => {
        const last = rows.find((r) => r.test === t.id);
        return [t.id, last ? last.started_at + COOLDOWN : null];
      }),
    ),
    certificates: externalCertificates(p.id),
  };
}

export async function startSkillTest(p: Person, test: SkillTest, now = Date.now()) {
  requireVerified(p);
  const db = sqlite();
  const check = () => {
    if (db.prepare('SELECT 1 FROM skill_attempts WHERE user_id=? AND finished_at IS NULL AND deadline>?').get(p.id, now))
      throw new HttpError(409, '你还有一场认证考试没有结束');
    const last = db
      .prepare('SELECT MAX(started_at) FROM skill_attempts WHERE user_id=? AND test=?')
      .pluck()
      .get(p.id, test.id) as number | null;
    if (last !== null && now < last + COOLDOWN) throw new HttpError(429, '同一项认证 7 天内只能考一次');
  };
  check();
  // Never a problem already accepted: its old code would just be submitted again.
  const solved = new Set(
    db
      .prepare("SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'")
      .pluck()
      .all(p.id) as string[],
  );
  const seen = new Set(
    (db.prepare('SELECT ids_json FROM skill_attempts WHERE user_id=? AND test=?').pluck().all(p.id, test.id) as string[]).flatMap(
      (ids) => JSON.parse(ids) as string[],
    ),
  );
  const ids = drawMock({
    pool: (await pool(test)).filter((item) => !solved.has(item.id)),
    slots: test.slots,
    exclude: seen,
    random: seededRandom(randomInt(2 ** 31)),
  });
  if (!ids) throw new HttpError(409, '题库里你还没做过的题不够，暂时无法开考');
  const id = randomBytes(9).toString('base64url');
  return db.transaction(() => {
    // Another tab may have started one while the pool loaded.
    check();
    db.prepare(
      `INSERT INTO skill_attempts(id,user_id,test,ids_json,language,started_at,deadline,created_at)
      VALUES(?,?,?,?,?,?,?,?)`,
    ).run(id, p.id, test.id, JSON.stringify(ids), test.language, now, now + test.minutes * 60000, now);
    return view(db.prepare('SELECT * FROM skill_attempts WHERE id=?').get(id) as Row);
  })();
}

/** Hands in the learner's open attempt of this test (at most at its deadline) and scores it when it can. */
export function finishSkillTest(p: Person, test: SkillTest, now = Date.now()) {
  const db = sqlite();
  const row = db
    .prepare('SELECT * FROM skill_attempts WHERE user_id=? AND test=? AND score IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(p.id, test.id) as Row | undefined;
  if (!row) throw new HttpError(404, '没有进行中的认证考试');
  if (row.finished_at === null) {
    row.finished_at = Math.min(now, row.deadline);
    db.prepare('UPDATE skill_attempts SET finished_at=? WHERE id=? AND finished_at IS NULL').run(row.finished_at, row.id);
  }
  return view(settle(row, now));
}

/** /api/oj/skills: GET the overview; POST <test>/start and <test>/finish. All need an account. */
export async function handleSkillTests(request: Request, p: Person | null, path: string[]) {
  const [id, action, ...extra] = path;
  requirePerson(p);
  if (request.method === 'GET' && !id) {
    await limit(p, 'skill-read', 120);
    return json(skillOverview(p));
  }
  const test = skillTest(id);
  if (request.method === 'POST' && test && !extra.length) {
    if (action === 'start') {
      await limit(p, 'skill-start', 10);
      return json({ attempt: await startSkillTest(p, test), now: Date.now() });
    }
    if (action === 'finish') {
      await limit(p, 'skill-finish', 30);
      return json({ attempt: finishSkillTest(p, test), now: Date.now() });
    }
  }
  throw new HttpError(404, '认证考试接口不存在');
}
