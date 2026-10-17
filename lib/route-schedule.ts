/**
 * A route's schedule (components/role-path.tsx): each step's remaining minutes laid into the weeks
 * from today at the learner's weekly hours, the day each step should be finished, and the hours a
 * week the target date needs. Pure; dates are local YYYY-MM-DD days (lib/study-plan.ts).
 */
import { STEP_DONE, type ExtStep } from './content/role-paths';
import { calendar, escapeText, vevent } from './ics';
import { addDays, daysBetween, weekday } from './study-plan';

export type ScheduleStep = ExtStep | { id: string; minutes: number; optional?: boolean; unavailable?: boolean };
export type RouteWeek = { start: string; end: string; items: { id: string; minutes: number }[] };

/** What a step still needs: nothing once done (STEP_DONE of it), skipped, optional or unavailable. */
export function remainingMinutes(step: ScheduleStep, share: number, skip: boolean) {
  if (skip) return 0;
  if ('units' in step) return Math.max(0, step.units - step.done) * step.unitMinutes;
  if (step.optional || step.unavailable || share >= STEP_DONE) return 0;
  return Math.round(step.minutes * (1 - share));
}

/**
 * Steps in route order, at weeklyHours / 7 a day from today: the first (Monday-to-Sunday) week holds
 * only its days left, and a step runs into the next week when this one fills. `finish`: the day each
 * step with work left ends; `needHours`: hours a week to be done by targetDate (null without one, or
 * once it has passed).
 */
export function scheduleRoute({
  steps,
  doneShare = {},
  state = {},
  today,
  weeklyHours,
  targetDate = '',
}: {
  steps: ScheduleStep[];
  doneShare?: Record<string, number>;
  state?: Record<string, 'doing' | 'skip'>;
  today: string;
  weeklyHours: number;
  targetDate?: string;
}) {
  // Sevenths of a minute, so a day holds a whole weeklyHours * 60 of them.
  const perDay = weeklyHours * 60;
  const offset = weekday(today);
  const monday = addDays(today, -offset);
  const weeks: RouteWeek[] = [];
  const finish: Record<string, string> = {};
  let at = 0;
  for (const step of steps) {
    const need = remainingMinutes(step, doneShare[step.id] ?? 0, state[step.id] === 'skip') * 7;
    if (!need) continue;
    let from = at;
    at += need;
    finish[step.id] = addDays(today, Math.ceil(at / perDay) - 1);
    while (from < at) {
      const week = Math.floor((Math.floor(from / perDay) + offset) / 7);
      const to = Math.min(at, (7 * (week + 1) - offset) * perDay);
      while (weeks.length <= week) {
        const start = addDays(monday, 7 * weeks.length);
        weeks.push({ start, end: addDays(start, 6), items: [] });
      }
      weeks[week].items.push({ id: step.id, minutes: Math.round((to - from) / 7) });
      from = to;
    }
  }
  const days = targetDate ? daysBetween(today, targetDate) + 1 : 0;
  return {
    weeks,
    finish,
    end: at ? addDays(today, Math.ceil(at / perDay) - 1) : '',
    // Tenths of an hour, rounded up: at sevenths over days * 60 is hours a week.
    needHours: days > 0 ? Math.ceil((at * 10) / (days * 60)) / 10 : null,
  };
}

/** Steps whose saved finish day has passed while work is left on them. */
export const overdue = (planned: Record<string, string>, finish: Record<string, string>, today: string) =>
  Object.keys(finish).filter((id) => planned[id] && planned[id] < today);

const compact = (date: string) => date.replaceAll('-', '');
const allDay = (date: string) => [`DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(addDays(date, 1))}`];

/**
 * The schedule as an iCalendar file: an all-day event on each step's finish day and one on the target
 * date. UIDs come from the route and step ids, so importing an updated schedule replaces the old one.
 */
export function routeIcs({
  routeId,
  name,
  steps,
  finish,
  targetDate,
  now,
  origin,
  english = false,
}: {
  routeId: string;
  name: string;
  steps: { id: string; title: string; href?: string }[];
  finish: Record<string, string>;
  targetDate: string;
  now: Date;
  origin: string;
  english?: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const uid = (part: string) => `cswork-route-${routeId}-${part.replace(/[^A-Za-z0-9-]/g, '_')}@cswork.org`;
  const events = steps
    .filter((step) => finish[step.id])
    .map((step) =>
      vevent(uid(step.id), now, [
        ...allDay(finish[step.id]),
        `SUMMARY:${escapeText(t(`完成：${step.title}`, `Finish: ${step.title}`))}`,
        'TRANSP:TRANSPARENT',
        ...(step.href ? [`URL:${origin}${step.href}`] : []),
      ]),
    );
  if (targetDate)
    events.push(
      vevent(uid('target'), now, [
        ...allDay(targetDate),
        `SUMMARY:${escapeText(t(`目标日：${name}`, `Target date: ${name}`))}`,
        'TRANSP:TRANSPARENT',
      ]),
    );
  return calendar(
    ['VERSION:2.0', 'PRODID:-//CSWork//Route//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(name)}`],
    events,
  );
}
