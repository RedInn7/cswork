import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { parseReviewPrefs, reviewPause } from '@/lib/practice-review';
import { RECALL_CARDS, RECALL_IDEAS, RECALL_NOTE } from '@/lib/recall';
import { tally, xpOf, type CoveredDay, type StudyEvent } from '@/lib/study-goal';
import { localDate } from './local-day';

/**
 * A learner's study days on the server: the XP they earned (lib/study-goal.ts), the days they met
 * their goal or rested, kept as user_marks (goal:YYYY-MM-DD and rest:YYYY-MM-DD, both mark goal),
 * and the days a streak survives without an AC. GET oj/study-goal (study-goal.ts) and the reminder
 * digest share it, so it imports no contests: the judge worker's bundle stays free of them.
 */
const MINUTE = 60000;
const DAY = 1440 * MINUTE;
/** Days a met goal or a rest day is kept (the privacy page says so). */
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
 * What the learner did from `since` to `now`, one event per item: ACs, finished stress tests and
 * complexity probes, first answers to bank MCQs, system design chapters read, finished mock OAs
 * and self-graded review cards.
 * A mock's finish and a card's day come from the browser: one past `now` is dropped.
 */
export function studyEvents(userId: string, since: number, now: number): StudyEvent[] {
  // ponytail: mcq_answers' key leads with question_id, so it is scanned; index (user_id,created_at) if it grows.
  const events = sqlite()
    .prepare(
      `SELECT CASE mode WHEN 'judge' THEN 'ac' ELSE 'stress' END AS kind,problem_id AS key,created_at AS at
        FROM submissions WHERE user_id=@user AND created_at>=@since
          AND ((mode='judge' AND status='accepted') OR (mode IN ('stress','complexity') AND finished_at IS NOT NULL))
      UNION ALL SELECT 'mcq',question_id,created_at FROM mcq_answers WHERE user_id=@user AND created_at>=@since
      UNION ALL SELECT 'sd',target,created_at FROM user_marks
        WHERE user_id=@user AND created_at>=@since AND mark='read' AND target>='sd:' AND target<'sd;'
      UNION ALL SELECT 'mock',id,finished_at FROM mock_sessions WHERE user_id=@user AND finished_at>=@since`,
    )
    .all({ user: userId, since }) as StudyEvent[];
  // The recall notes (lib/recall.ts: open questions, own cards, problem ideas; their keys never
  // collide) keep each card's last grade as a UTC day number: the note's last save for that day's
  // cards, noon UTC for older ones.
  // ponytail: an older card graded late in the evening west of UTC counts on the next local day.
  for (const target of [RECALL_NOTE, RECALL_CARDS, RECALL_IDEAS]) {
    const queue = note(userId, target);
    const items = (parsed(queue?.body) as { items?: unknown } | undefined)?.items;
    if (queue && items && typeof items === 'object')
      for (const [key, card] of Object.entries(items)) {
        if (!Array.isArray(card) || !Number.isInteger(card[1])) continue;
        const at = card[1] === Math.floor(queue.updated_at / DAY) ? queue.updated_at : card[1] * DAY + DAY / 2;
        if (at >= since) events.push({ kind: 'recall', key, at });
      }
  }
  return events.filter((e) => e.at <= now);
}

/**
 * The last 8 local days (today and the 7 before), recorded: each day that met the goal becomes a
 * goal: mark, and each other past one that was a rest weekday or inside the review break
 * (pref:review) a rest: mark. So un-reading a chapter, changing the rest weekdays
 * or a new break replacing the old one never takes back a day already counted, and neither reaches
 * further back than the 7 days. Marks past KEEP_DAYS go. `covered`: the calendar's days kept alive
 * without an AC: the marks, and today when it is a rest day now; a met goal wins over a rest day.
 */
export function studyDays(userId: string, tz: number, now = Date.now()) {
  const db = sqlite();
  const pref = studyPref(userId);
  const today = localDate(now, tz);
  const first = localDate(now - 7 * DAY, tz);
  const days = tally(studyEvents(userId, Date.parse(`${first}T00:00:00Z`) + tz * MINUTE, now), tz);
  const pause = reviewPause(parseReviewPrefs(note(userId, 'pref:review')?.body));
  const rest = (date: string) =>
    pref.restWeekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay()) ||
    (!!pause && pause.from <= date && date <= pause.to);
  db.transaction(() => {
    const insert = db.prepare("INSERT INTO user_marks(user_id,target,mark,created_at) VALUES(?,?,'goal',?) ON CONFLICT DO NOTHING");
    for (let i = 7; i >= 0; i--) {
      const date = localDate(now - i * DAY, tz);
      if (xpOf(days.get(date)) >= pref.goalXp) insert.run(userId, `goal:${date}`, now);
      // Today is not over: a rest day taken back today is no rest day.
      else if (i && rest(date)) insert.run(userId, `rest:${date}`, now);
    }
    db.prepare("DELETE FROM user_marks WHERE user_id=? AND mark='goal' AND substr(target,6)<?").run(
      userId,
      localDate(now - KEEP_DAYS * DAY, tz),
    );
  })();
  // goal: sorts before rest:, so MIN picks a met goal over a rest day.
  const covered = (
    db
      .prepare(
        `SELECT substr(target,6) AS date,MIN(target>='rest:') AS rest FROM user_marks
        WHERE user_id=? AND mark='goal' AND substr(target,6) BETWEEN ? AND ? GROUP BY 1 ORDER BY 1`,
      )
      .all(userId, localDate(now - (SPAN - 1) * DAY, tz), today) as { date: string; rest: number }[]
  ).map((c): CoveredDay => ({ date: c.date, rest: !!c.rest }));
  if (covered.at(-1)?.date !== today && rest(today)) covered.push({ date: today, rest: true });
  return { pref, today, days, covered };
}
