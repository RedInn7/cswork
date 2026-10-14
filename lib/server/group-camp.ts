import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { classicList, classicLists } from '@/lib/classic-lists';
import { listClassicLibrary } from './study-library';

/**
 * A study group's cohort (db/group-camp-schema.ts): from its start date the group works through
 * a classic list, `perDay` judgeable problems a day in list order. The plan is group content, so
 * members see today's problems and, per member, which of them they have solved since day 1.
 */
const DAY = 86400000;
export const PER_DAY_MAX = 10;
/** How far from today a start date may be set, either way. */
export const START_RANGE_DAYS = 60;
const dayIndex = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;

/** The plan's problems judgeable here, in list order, each once. */
export function campTasks(plan: string) {
  const list = classicList(plan);
  if (!list) return [];
  const seen = new Set<string>();
  return listClassicLibrary(list).groups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (!item.judgeProblemId || seen.has(item.judgeProblemId)) return [];
      seen.add(item.judgeProblemId);
      return [{ id: item.judgeProblemId, number: item.number, titleZh: item.titleZh, titleEn: item.titleEn, difficulty: item.difficulty }];
    }),
  );
}

/**
 * The cohort as the reader sees it on local day `today` (days since the epoch, shifted by
 * `shift` ms like groupDetail): day N (below 1 before the start, past `days` once done),
 * today's slice, and per member user id which of today's problems are solved since day 1 and
 * how many of the whole plan. Null when the group has no cohort.
 */
export function campDetail(groupId: string, shift: number, today: number) {
  const db = sqlite();
  const row = db.prepare('SELECT plan,per_day,start_date FROM study_group_camps WHERE group_id=?').get(groupId) as
    | { plan: string; per_day: number; start_date: string }
    | undefined;
  const list = row && classicList(row.plan);
  if (!row || !list) return null;
  const all = campTasks(row.plan);
  const days = Math.ceil(all.length / row.per_day);
  const day = today - dayIndex(row.start_date) + 1;
  const slice = day >= 1 && day <= days ? all.slice((day - 1) * row.per_day, day * row.per_day) : [];
  const solved = new Map<string, Set<string>>();
  for (const r of db
    .prepare(
      `SELECT DISTINCT user_id AS u,problem_id AS id FROM submissions
      WHERE user_id IN (SELECT user_id FROM study_group_members WHERE group_id=?)
        AND mode='judge' AND status='accepted' AND created_at>=? AND problem_id IN (SELECT value FROM json_each(?))`,
    )
    .all(groupId, dayIndex(row.start_date) * DAY + shift, JSON.stringify(all.map((t) => t.id))) as { u: string; id: string }[])
    (solved.get(r.u) ?? solved.set(r.u, new Set()).get(r.u)!).add(r.id);
  return {
    info: {
      plan: row.plan,
      planName: [list.nameZh, list.nameEn] as [string, string],
      perDay: row.per_day,
      startDate: row.start_date,
      day,
      days,
      total: all.length,
      tasks: slice,
    },
    member: (user: string) => ({
      today: slice.map((t) => !!solved.get(user)?.has(t.id)),
      done: solved.get(user)?.size ?? 0,
    }),
  };
}

/** Sets (or with plan '' removes) the group's cohort; the start must lie within 60 days of now. */
export function setCamp(groupId: string, input: unknown, now = Date.now()) {
  const d = z
    .union([
      z.object({ plan: z.literal('') }).strict(),
      z
        .object({
          plan: z.string().refine((slug) => classicLists.some((list) => list.slug === slug)),
          perDay: z.number().int().min(1).max(PER_DAY_MAX),
          startDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .refine((date) => Math.abs(dayIndex(date) - Math.floor(now / DAY)) <= START_RANGE_DAYS),
        })
        .strict(),
    ])
    .parse(input);
  const db = sqlite();
  if (!('perDay' in d)) db.prepare('DELETE FROM study_group_camps WHERE group_id=?').run(groupId);
  else
    db.prepare(
      `INSERT INTO study_group_camps(group_id,plan,per_day,start_date,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(group_id) DO UPDATE SET plan=excluded.plan,per_day=excluded.per_day,start_date=excluded.start_date,updated_at=excluded.updated_at`,
    ).run(groupId, d.plan, d.perDay, d.startDate, now);
}
