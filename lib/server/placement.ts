import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import {
  nextStep,
  placementResult,
  placementScore,
  placementTotal,
  RETAKE_DAYS,
  type PlacementItem,
  type PlacementResult,
  type PlacementStep,
} from '@/lib/placement';
import { firstParagraph } from '@/lib/speedrun';
import type { Person } from './auth';
import { inRunningContest, runningContestProblems } from './contests';
import { body, HttpError, json, limit } from './http';
import { lcRatingOf } from './lc-ratings';
import { speedrunPool } from './speedrun';
import { getStudySourceStatement } from './study-library';

// Written here only: the notes API's target pattern (lib/server/my-practice.ts) leaves placement:
// out, so a client can neither read a session's answers nor forge a result past the 30-day wait.
const SESSION = 'placement:session';
const LATEST = 'placement:latest';
const DAY = 86_400_000;
// seen: the last quiz's questions, asked again only where a group has no others.
type Session = { total: number; steps: PlacementStep[]; seen?: string[] };
type Latest = PlacementResult & { asked?: string[] };

/** The speedrun's pool, scored, without the problems of the learner's running contest or exam. */
function pool(userId: string): PlacementItem[] {
  const running = runningContestProblems(userId);
  const difficulty = new Map(
    (sqlite().prepare('SELECT number,difficulty FROM study_library').all() as { number: number; difficulty: string }[]).map(
      (row) => [row.number, row.difficulty],
    ),
  );
  return speedrunPool().flatMap((item) => {
    if (running.has(item.id)) return [];
    const rating = lcRatingOf(item.number)?.rating;
    return [{ ...item, score: placementScore(rating, difficulty.get(item.number)), rated: !!rating }];
  });
}

function read<T>(userId: string, target: string): T | null {
  const saved = sqlite()
    .prepare('SELECT body FROM user_notes WHERE user_id=? AND target=?')
    .pluck()
    .get(userId, target) as string | undefined;
  return saved ? (JSON.parse(saved) as T) : null;
}
function write(userId: string, target: string, value: unknown) {
  sqlite()
    .prepare(
      `INSERT INTO user_notes(user_id,target,body,updated_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id,target) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at`,
    )
    .run(userId, target, JSON.stringify(value), Date.now());
}

/** Draws the session's next question, or writes the result and ends the quiz once none is left. */
function advance(userId: string, session: Session) {
  const items = pool(userId);
  const next = nextStep(items, session.steps, undefined, new Set(session.seen));
  if (next) return write(userId, SESSION, { ...session, steps: [...session.steps, next] });
  if (session.steps.length) {
    const solved = new Set(
      sqlite()
        .prepare("SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'")
        .pluck()
        .all(userId) as string[],
    );
    const result = placementResult(items, session.steps, solved, Date.now());
    write(userId, LATEST, { ...result, asked: session.steps.map((s) => s.id) } satisfies Latest);
  }
  sqlite().prepare('DELETE FROM user_notes WHERE user_id=? AND target=?').run(userId, SESSION);
}

/**
 * A question whose problem joined a contest or exam that began mid-quiz is neither shown nor
 * judged: another takes its place, or the quiz ends on the answers so far. True when it swapped.
 */
function swapStale(userId: string) {
  const session = read<Session>(userId, SESSION);
  const current = session?.steps.at(-1);
  if (!session || !current || !inRunningContest(userId, current.id)) return false;
  advance(userId, { ...session, steps: session.steps.slice(0, -1) });
  return true;
}

/** The question on screen: no answer, score or reason until it is answered. */
function question({ id, number, titleZh, titleEn, choices }: PlacementStep) {
  const source = getStudySourceStatement(id);
  return {
    id,
    number,
    titleZh,
    titleEn,
    choices,
    ...(source && {
      excerptZh: firstParagraph(source.descriptionZh),
      excerptEn: firstParagraph(source.descriptionEn),
    }),
  };
}

function view(userId: string) {
  const latest = read<Latest>(userId, LATEST);
  const session = read<Session>(userId, SESSION);
  const current = session?.steps.at(-1);
  return {
    latest,
    retakeAt: latest ? latest.at + RETAKE_DAYS * DAY : null,
    session:
      session && current
        ? {
            total: session.total,
            index: session.steps.length - 1,
            // Right or wrong so far, for the progress pips.
            answered: session.steps.slice(0, -1).map((s) => s.pick === s.answer),
            group: current.group,
            question: question(current),
          }
        : null,
  };
}

const input = z.union([
  z.object({ start: z.literal(true) }).strict(),
  z.object({ id: z.string().max(100), pick: z.string().max(100) }).strict(),
]);

/**
 * GET/POST oj/speedrun/placement: the pattern-recognition placement quiz (components/placement.tsx).
 * GET: the latest result, when a retake opens, and the question in progress. POST { start } begins
 * (or resumes) a quiz; POST { id, pick } answers the question on screen and returns its verdict
 * with the next one, or with the result once every group is done.
 */
export async function handlePlacement(request: Request, p: Person): Promise<Response> {
  if (request.method === 'GET') {
    await limit(p, 'placement-read', 120);
    swapStale(p.id);
    return json(view(p.id));
  }
  if (request.method !== 'POST') throw new HttpError(404, '接口不存在');
  await limit(p, 'placement-write', 60);
  const data = input.parse(await body(request));
  // ponytail: read-modify-write without a transaction; better-sqlite3 is synchronous, so nothing interleaves.
  // A swapped question gets no verdict: the view shows the one now on screen (or the result).
  if (swapStale(p.id)) return json(view(p.id));
  const session = read<Session>(p.id, SESSION);
  if ('start' in data) {
    if (!session) {
      const latest = read<Latest>(p.id, LATEST);
      if (latest && Date.now() < latest.at + RETAKE_DAYS * DAY)
        throw new HttpError(409, '30 天内已经测过，到期后再来重测');
      const items = pool(p.id);
      const seen = new Set(latest?.asked);
      const first = nextStep(items, [], undefined, seen);
      if (!first) throw new HttpError(409, '题库里还没有可测的题');
      write(p.id, SESSION, { total: placementTotal(items), steps: [first], seen: [...seen] } satisfies Session);
    }
    return json(view(p.id));
  }
  const current = session?.steps.at(-1);
  if (!session || !current) throw new HttpError(409, '没有进行中的定位测验');
  if (data.id !== current.id) throw new HttpError(409, '这道题已经答过了，请刷新页面');
  if (!current.choices.includes(data.pick)) throw new HttpError(400, '选项无效');
  current.pick = data.pick;
  advance(p.id, session);
  return json({
    verdict: {
      id: current.id,
      pick: current.pick,
      answer: current.answer,
      right: current.pick === current.answer,
      reason: current.reason,
      reasonEn: current.reasonEn,
    },
    ...view(p.id),
  });
}
