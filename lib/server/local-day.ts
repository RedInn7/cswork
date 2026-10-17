// A learner's local day on the server, from the Date#getTimezoneOffset (minutes) their client
// saved; shared by reminders and the wave-9 review, tracker and study-goal code without a cycle.
const MINUTE = 60000;

/** The local date (YYYY-MM-DD) at `at` for a Date#getTimezoneOffset of `tz` minutes. */
export const localDate = (at: number, tz: number) => new Date(at - tz * MINUTE).toISOString().slice(0, 10);
/**
 * `at` re-anchored so this process's local time reads the learner's wall clock at `at`: dueReviews
 * and practiceStats count local days, and this makes them the learner's whatever the process TZ.
 */
export function wall(at: number, tz: number) {
  const d = new Date(at - tz * MINUTE);
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  ).getTime();
}
