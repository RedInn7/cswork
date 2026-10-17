import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { parseReviewPrefs, reviewPause } from '@/lib/practice-review';
import { tally, xpOf, type CoveredDay, type StudyEvent } from '@/lib/study-goal';
import { localDate } from './local-day';

/**
 * A learner's study days on the server: the XP they earned (lib/study-goal.ts), the days they met
 * their goal, kept as user_marks (goal:YYYY-MM-DD, mark goal), and the days a streak survives
 * without an AC. GET oj/study-goal (study-goal.ts) and the reminder digest share it, so it
 * imports no contests: the judge worker's bundle stays free of them.
 */
const MINUTE = 60000;
const DAY = 1440 * MINUTE;
/** Days a met goal is kept (the privacy page says so). */
const KEEP_DAYS = 200;
/** The practice calendar's 183 days (lib/practice-stats.ts WEEKS). */
const SPAN = 183;

/** pref:study, JSON the learner writes: a field that does not parse falls back on its own. */
const prefSchema = z
  .object({
    goalXp: z.number().int().min(10).max(200).catch(30),
    restWeekdays: z.array(z.number().int().min(0).max(6)).max(2).catch([]),
  })
  .catch({ goalXp: 30, restWeekdays: [] });

const note = (userId: string, target: string) =>
  sqlite().prepare('SELECT body,updated_at FROM user_notes WHERE user_id=? AND target=?').get(userId, target) as
    | { body: string; updated_at: number }
    | undefined;
const parsed = (body: string | undefined): unknown => {
  try {
    return JSON.parse(body ?? '');
  } catch {
    return undefined;
  }
};

/** The daily XP goal (10–200) and up to 2 rest weekdays (0 is Sunday). */
export const studyPref = (userId: string) => prefSchema.parse(parsed(note(userId, 'pref:study')?.body));

/**
 * What the learner did since `since`, one event per item: ACs, finished stress tests and
 * complexity probes, first answers to bank MCQs, system design chapters read, English units done,
 * finished mock OAs, STAR stories saved (the last save only) and self-graded review cards.
 */
export function studyEvents(userId: string, since: number): StudyEvent[] {
  // ponytail: mcq_answers' key leads with question_id, so it is scanned; index (user_id,created_at) if it grows.
  const events = sqlite()
    .prepare(
      `SELECT CASE mode WHEN 'judge' THEN 'ac' ELSE 'stress' END AS kind,problem_id AS key,created_at AS at
        FROM submissions WHERE user_id=@user AND created_at>=@since
          AND ((mode='judge' AND status='accepted') OR (mode IN ('stress','complexity') AND finished_at IS NOT NULL))
      UNION ALL SELECT 'mcq',question_id,created_at FROM mcq_answers WHERE user_id=@user AND created_at>=@since
      UNION ALL SELECT CASE mark WHEN 'read' THEN 'sd' ELSE 'english' END,target,created_at FROM user_marks
        WHERE user_id=@user AND created_at>=@since
          AND ((mark='read' AND target>='sd:' AND target<'sd;') OR (mark='done' AND target>='content:english/' AND target<'content:english0'))
      UNION ALL SELECT 'mock',id,finished_at FROM mock_sessions WHERE user_id=@user AND finished_at>=@since
      UNION ALL SELECT 'story',target,updated_at FROM user_notes
        WHERE user_id=@user AND target>='story:' AND target<'story;' AND updated_at>=@since`,
    )
    .all({ user: userId, since }) as StudyEvent[];
  // recall:queue (lib/recall.ts) keeps each card's last grade as a UTC day number: the note's last
  // save for that day's cards, noon UTC for older ones.
  // ponytail: an older card graded late in the evening west of UTC counts on the next local day.
  const queue = note(userId, 'recall:queue');
  const items = (parsed(queue?.body) as { items?: unknown } | undefined)?.items;
  if (queue && items && typeof items === 'object')
    for (const [key, card] of Object.entries(items)) {
      if (!Array.isArray(card) || !Number.isInteger(card[1])) continue;
      const at = card[1] === Math.floor(queue.updated_at / DAY) ? queue.updated_at : card[1] * DAY + DAY / 2;
      if (at >= since) events.push({ kind: 'recall', key, at });
    }
  return events;
}

/**
 * The last 8 local days' study (today and the 7 before), recorded: each day that met the goal
 * becomes a goal mark, so un-reading a chapter or deleting a story later never takes back a day
 * already counted. Marks past KEEP_DAYS go. `covered`: the calendar's days kept alive without an
 * AC: met goals, rest weekdays and the review break (pref:review); a met goal wins over a rest day.
 * ponytail: rest weekdays cover past weeks as well, so changing them re-draws the calendar.
 */
export function studyDays(userId: string, tz: number, now = Date.now()) {
  const db = sqlite();
  const pref = studyPref(userId);
  const today = localDate(now, tz);
  const first = localDate(now - 7 * DAY, tz);
  const days = tally(studyEvents(userId, Date.parse(`${first}T00:00:00Z`) + tz * MINUTE), tz);
  db.transaction(() => {
    const insert = db.prepare("INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'goal',?) ON CONFLICT DO NOTHING");
    for (const [date, counts] of days) if (date <= today && xpOf(counts) >= pref.goalXp) insert.run(userId, `goal:${date}`, now);
    db.prepare("DELETE FROM user_marks WHERE user_id=? AND mark='goal' AND target<?").run(
      userId,
      `goal:${localDate(now - KEEP_DAYS * DAY, tz)}`,
    );
  })();
  const goals = new Set(
    db
      .prepare("SELECT substr(target,6) FROM user_marks WHERE user_id=? AND mark='goal' AND target>=? AND target<'goal;'")
      .pluck()
      .all(userId, `goal:${localDate(now - (SPAN - 1) * DAY, tz)}`) as string[],
  );
  const pause = reviewPause(parseReviewPrefs(note(userId, 'pref:review')?.body));
  const covered: CoveredDay[] = [];
  for (let i = SPAN - 1; i >= 0; i--) {
    const date = localDate(now - i * DAY, tz);
    if (goals.has(date)) covered.push({ date, rest: false });
    else if (
      pref.restWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ||
      (pause && pause.from <= date && date <= pause.to)
    )
      covered.push({ date, rest: true });
  }
  return { pref, today, days, covered };
}
