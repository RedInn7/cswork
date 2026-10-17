import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { practiceStats, WEEKS } from '@/lib/practice-stats';
import { coveredNoons, dailyQuests, QUESTS, STUDY_KINDS, xpOf, type DayCounts } from '@/lib/study-goal';
import type { Person } from './auth';
import { runningContestProblems } from './contests';
import { HttpError, json, limit } from './http';
import { localDate, wall } from './local-day';
import { purchasedFreezes } from './points';
import { studyDays } from './study-days';

const DAY = 86400000;
const tzSchema = z.coerce.number().int().min(-900).max(900);

/**
 * GET oj/study-goal?tz=<Date#getTimezoneOffset> (GET only; oj-api routes every method here): the
 * top bar's streak, today's XP against the learner's goal, the last 7 days, the calendar's covered
 * days and today's 3 quests (components/daily-goal.tsx). Only {paused:true} while a contest or
 * skill test runs for the learner: the XP of an AC would give a verdict away.
 */
export async function handleStudyGoal(request: Request, p: Person): Promise<Response> {
  if (request.method !== 'GET') throw new HttpError(404, '判题接口不存在');
  await limit(p, 'study-goal-read', 60);
  const tz = tzSchema.parse(new URL(request.url).searchParams.get('tz') ?? undefined);
  if (runningContestProblems(p.id).size) return json({ paused: true });
  const now = Date.now();
  const { pref, today, days, covered } = studyDays(p.id, tz, now);
  // The streak as My progress counts it (the bootstrap's 183 days of ACs and bought freezes), on
  // the learner's wall clock, with the covered days.
  const acs = sqlite()
    .prepare("SELECT problem_id,created_at FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted' AND created_at>?")
    .all(p.id, now - 183 * DAY) as { problem_id: string; created_at: number }[];
  const stats = practiceStats(
    acs.map((a) => ({ ...a, created_at: wall(a.created_at, tz) })),
    new Date(wall(now, tz)).toDateString(),
    true,
    [],
    WEEKS,
    purchasedFreezes(p.id).map((t) => wall(t, tz)),
    coveredNoons(covered),
  );
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = localDate(now - (6 - i) * DAY, tz);
    const cell = stats.cells[stats.todayIndex - 6 + i];
    return { date, xp: xpOf(days.get(date)), ac: cell.count, frozen: !!cell.frozen, covered: cell.covered ?? null };
  });
  // The quests lean on what the 7 days before today left alone. MCQ answers are kept for
  // verified accounts only (lib/server/mcq-stats.ts), so the others never draw that quest.
  const recent: DayCounts = {};
  for (const [date, counts] of days)
    if (date < today) for (const kind of STUDY_KINDS) recent[kind] = (recent[kind] ?? 0) + (counts[kind] ?? 0);
  if (!p.verified && p.role !== 'teacher') recent.mcq = Infinity;
  const done = days.get(today) ?? {};
  return json({
    user: p.id,
    streak: stats.streak,
    freezesLeft: stats.freezesLeft,
    rescue: stats.rescue,
    goalXp: pref.goalXp,
    restWeekdays: pref.restWeekdays,
    todayXp: xpOf(done),
    today,
    week,
    covered,
    quests: dailyQuests(`${p.id}|${today}`, recent).map((kind) => ({
      kind,
      need: QUESTS[kind].need,
      have: Math.min(done[kind] ?? 0, QUESTS[kind].need),
    })),
  });
}
