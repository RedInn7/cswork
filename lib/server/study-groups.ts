import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedEntries } from '@/lib/ling-curated';
import { STOP_NAMES } from '@/lib/route-stops';
import type { Person } from './auth';
import { shownOaSql } from './env';
import { HttpError, json, limit, requirePerson } from './http';
import { readJson } from './my-practice';

/**
 * Study groups (db/study-groups-schema.ts): a member sees the group's name, goal, invite code
 * and, per member, only the display name chosen on joining and accepted-problem counts per
 * local day. Never names, emails, code or which problems. A group someone is not in reads as
 * missing; teachers may open and moderate any group from a report.
 */
const DAY = 86400000;
export const GROUP_MAX = 50;
export const OWNED_MAX = 3;
export const JOINED_MAX = 10;
/** Days of counts sent per member: the 14-day grid plus room for the streak (14 weeks). */
export const HISTORY_DAYS = 98;
// No 0/O/1/I: codes get read aloud and typed from screenshots.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Plain text without control or invisible format characters (no RTL overrides or zero widths). */
const plain = (max: number, min = 1) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/\p{C}/u.test(s));
const displayName = plain(24);
const groupId = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
const code = z
  .string()
  .max(40)
  .transform((s) => s.replace(/[\s-]/g, '').toUpperCase())
  .pipe(z.string().regex(CODE));

type GroupRow = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  goal_text: string;
  goal_stop: string;
  goal_set_at: number | null;
  created_at: number;
};
type MemberRow = { user_id: string; display_name: string; role: 'owner' | 'member'; joined_at: number };

function requireVerified(p: Person) {
  if (!p.verified && p.role !== 'teacher') throw new HttpError(403, '请先验证邮箱');
}
const newCode = () => [...randomBytes(8)].map((b) => ALPHABET[b & 31]).join('');
/** An opaque per-group member handle, so pages never carry account ids. */
export const memberKey = (group: string, user: string) =>
  createHash('sha256').update(`${group}:${user}`).digest('base64url').slice(0, 12);

/** The group if the reader is in it (or a teacher moderating); everyone else gets a 404. */
function readable(id: string, p: Person) {
  const db = sqlite();
  const row = groupId.safeParse(id).success
    ? (db.prepare('SELECT * FROM study_groups WHERE id=?').get(id) as GroupRow | undefined)
    : undefined;
  const me = row
    ? (db
        .prepare('SELECT role FROM study_group_members WHERE group_id=? AND user_id=?')
        .get(row.id, p.id) as { role: MemberRow['role'] } | undefined)
    : undefined;
  if (!row || (!me && p.role !== 'teacher')) throw new HttpError(404, '学习小组不存在');
  return { row, role: me?.role ?? null };
}
function managed(id: string, p: Person) {
  const g = readable(id, p);
  if (g.role !== 'owner' && p.role !== 'teacher') throw new HttpError(403, '只有组长可以管理小组');
  return g;
}

/**
 * The group page: per member, distinct accepted problems per local day (oldest first, the
 * last entry today) for `tz` (Date#getTimezoneOffset minutes), distinct ACs since this local
 * Monday, and progress on the goal stop. Only counts leave the server.
 */
export function groupDetail(id: string, p: Person, tz = 0, now = Date.now()) {
  const { row, role } = readable(id, p);
  const db = sqlite();
  const shift = tz * 60000;
  const today = Math.floor((now - shift) / DAY);
  const first = today - HISTORY_DAYS + 1;
  const monday = today - ((today + 3) % 7); // 1970-01-01 was a Thursday.
  const accepted = `FROM submissions WHERE user_id IN (SELECT user_id FROM study_group_members WHERE group_id=?)
    AND mode='judge' AND status='accepted' AND (problem_id LIKE 'lc-%' OR problem_id LIKE 'oa-%')${shownOaSql('problem_id')}`;
  const days = new Map<string, number[]>();
  for (const r of db
    .prepare(
      `SELECT user_id AS u,CAST((created_at-?)/${DAY} AS INTEGER) AS d,COUNT(DISTINCT problem_id) AS n ${accepted}
      AND created_at>=? GROUP BY u,d`,
    )
    .all(shift, row.id, first * DAY + shift) as { u: string; d: number; n: number }[]) {
    const list = days.get(r.u) ?? days.set(r.u, Array(HISTORY_DAYS).fill(0)).get(r.u)!;
    if (r.d >= first && r.d <= today) list[r.d - first] = r.n;
  }
  const week = new Map(
    (
      db
        .prepare(`SELECT user_id AS u,COUNT(DISTINCT problem_id) AS n ${accepted} AND created_at>=? GROUP BY u`)
        .all(row.id, monday * DAY + shift) as { u: string; n: number }[]
    ).map((r) => [r.u, r.n]),
  );
  const stop = row.goal_stop && Object.hasOwn(STOP_NAMES, row.goal_stop) ? row.goal_stop : '';
  const stopIds = stop ? curatedEntries.filter((e) => e.sectionSlug === stop).map((e) => `lc-${e.number}`) : [];
  const goal = new Map(
    stopIds.length
      ? (
          db
            .prepare(
              `SELECT user_id AS u,COUNT(DISTINCT problem_id) AS n ${accepted}
              AND problem_id IN (${stopIds.map(() => '?').join(',')}) GROUP BY u`,
            )
            .all(row.id, ...stopIds) as { u: string; n: number }[]
        ).map((r) => [r.u, r.n])
      : [],
  );
  const members = (
    db
      .prepare(
        'SELECT user_id,display_name,role,joined_at FROM study_group_members WHERE group_id=? ORDER BY joined_at,user_id',
      )
      .all(row.id) as MemberRow[]
  ).map((m) => ({
    key: memberKey(row.id, m.user_id),
    name: m.display_name,
    role: m.role,
    me: m.user_id === p.id,
    joinedAt: m.joined_at,
    days: days.get(m.user_id) ?? Array(HISTORY_DAYS).fill(0),
    week: week.get(m.user_id) ?? 0,
    goal: stop ? (goal.get(m.user_id) ?? 0) : null,
  }));
  return {
    id: row.id,
    name: row.name,
    role,
    // Any member may pass the code on; a moderating teacher does not need it.
    inviteCode: role ? row.invite_code : null,
    goal:
      row.goal_text || stop
        ? { text: row.goal_text, stop: stop || null, stopTotal: stopIds.length, setAt: row.goal_set_at }
        : null,
    max: GROUP_MAX,
    createdAt: row.created_at,
    members,
  };
}

/** The reader's groups, newest joined first. */
export function myGroups(userId: string) {
  return sqlite()
    .prepare(
      `SELECT g.id,g.name,m.role,m.joined_at AS joinedAt,
        (SELECT COUNT(*) FROM study_group_members x WHERE x.group_id=g.id) AS members
      FROM study_group_members m JOIN study_groups g ON g.id=m.group_id
      WHERE m.user_id=? ORDER BY m.joined_at DESC,g.id`,
    )
    .all(userId) as { id: string; name: string; role: MemberRow['role']; joinedAt: number; members: number }[];
}

function nameTaken(group: string, name: string, except: string) {
  return !!sqlite()
    .prepare('SELECT 1 FROM study_group_members WHERE group_id=? AND lower(display_name)=lower(?) AND user_id<>?')
    .get(group, name, except);
}
function joinedCount(userId: string) {
  return (
    sqlite().prepare('SELECT COUNT(*) AS n FROM study_group_members WHERE user_id=?').get(userId) as { n: number }
  ).n;
}

function create(p: Person, input: unknown) {
  requireVerified(p);
  const d = z.object({ name: plain(40), displayName }).strict().parse(input);
  const db = sqlite();
  const id = randomBytes(9).toString('base64url'),
    now = Date.now();
  db.transaction(() => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM study_groups WHERE owner_id=?').get(p.id) as { n: number };
    if (n >= OWNED_MAX) throw new HttpError(409, '每人最多创建 3 个学习小组');
    if (joinedCount(p.id) >= JOINED_MAX) throw new HttpError(409, '最多加入 10 个学习小组');
    db.prepare(
      `INSERT INTO study_groups(id,name,owner_id,invite_code,created_at,updated_at) VALUES(?,?,?,?,?,?)`,
    ).run(id, d.name, p.id, newCode(), now, now);
    db.prepare(
      `INSERT INTO study_group_members(group_id,user_id,display_name,role,joined_at) VALUES(?,?,?,'owner',?)`,
    ).run(id, p.id, d.displayName, now);
  })();
  return id;
}

function byCode(value: unknown) {
  const parsed = code.safeParse(value);
  const row = parsed.success
    ? (sqlite().prepare('SELECT * FROM study_groups WHERE invite_code=?').get(parsed.data) as GroupRow | undefined)
    : undefined;
  if (!row) throw new HttpError(404, '邀请码无效');
  return row;
}
function size(group: string) {
  return (
    sqlite().prepare('SELECT COUNT(*) AS n FROM study_group_members WHERE group_id=?').get(group) as { n: number }
  ).n;
}

function join(p: Person, input: unknown) {
  const d = z.object({ code: z.string(), displayName }).strict().parse(input);
  const row = byCode(d.code);
  const db = sqlite();
  db.transaction(() => {
    if (db.prepare('SELECT 1 FROM study_group_members WHERE group_id=? AND user_id=?').get(row.id, p.id)) return;
    if (size(row.id) >= GROUP_MAX) throw new HttpError(409, '小组已满（最多 50 人）');
    if (joinedCount(p.id) >= JOINED_MAX) throw new HttpError(409, '最多加入 10 个学习小组');
    if (nameTaken(row.id, d.displayName, p.id)) throw new HttpError(409, '这个昵称在小组里已被使用');
    db.prepare(
      `INSERT INTO study_group_members(group_id,user_id,display_name,role,joined_at) VALUES(?,?,?,'member',?)`,
    ).run(row.id, p.id, d.displayName, Date.now());
  })();
  return row.id;
}

function memberByKey(group: string, key: unknown) {
  const users = sqlite()
    .prepare('SELECT user_id,role FROM study_group_members WHERE group_id=?')
    .all(group) as { user_id: string; role: MemberRow['role'] }[];
  const found = typeof key === 'string' ? users.find((u) => memberKey(group, u.user_id) === key) : undefined;
  if (!found) throw new HttpError(404, '成员不存在');
  return found;
}

/** /api/oj/groups/…: everything needs an account; reads and writes are rate limited per learner. */
export async function handleStudyGroups(request: Request, p: Person | null, path: string[]) {
  requirePerson(p);
  const [, id, action, extra] = path;
  if (extra !== undefined) throw new HttpError(404, '学习小组接口不存在');
  const params = new URL(request.url).searchParams;
  const db = sqlite();
  const tz = () => {
    const value = Number(params.get('tz') ?? 0);
    return Number.isInteger(value) && Math.abs(value) <= 840 ? value : 0;
  };
  if (request.method === 'GET') {
    if (id === 'preview' && !action) {
      // Invite codes are short: probing them costs the join budget.
      await limit(p, 'group-join', 10);
      await limit(p, 'group-join-hour', 60, 3600);
      const row = byCode(params.get('code') ?? '');
      const mine = !!db.prepare('SELECT 1 FROM study_group_members WHERE group_id=? AND user_id=?').get(row.id, p.id);
      const members = size(row.id);
      return json({ id: mine ? row.id : null, name: row.name, members, full: members >= GROUP_MAX });
    }
    await limit(p, 'group-read', 120);
    if (!id) return json({ items: myGroups(p.id), ownedMax: OWNED_MAX, joinedMax: JOINED_MAX });
    if (action) throw new HttpError(404, '学习小组接口不存在');
    return json(groupDetail(id, p, tz()));
  }
  if (request.method !== 'POST') throw new HttpError(404, '学习小组接口不存在');
  await limit(p, 'group-write', 20);
  if (!id) return json(groupDetail(create(p, await readJson(request, 2000)), p, tz()), 201);
  if (id === 'join' && !action) {
    await limit(p, 'group-join', 10);
    await limit(p, 'group-join-hour', 60, 3600);
    return json(groupDetail(join(p, await readJson(request, 2000)), p, tz()));
  }
  if (action === 'leave') {
    const { row, role } = readable(id, p);
    if (!role) throw new HttpError(404, '学习小组不存在');
    if (role === 'owner') throw new HttpError(409, '组长不能退出，可以解散小组');
    db.prepare('DELETE FROM study_group_members WHERE group_id=? AND user_id=?').run(row.id, p.id);
    return json({ id: row.id, left: true });
  }
  if (action === 'me') {
    const { row, role } = readable(id, p);
    if (!role) throw new HttpError(404, '学习小组不存在');
    const d = z.object({ displayName }).strict().parse(await readJson(request, 1000));
    if (nameTaken(row.id, d.displayName, p.id)) throw new HttpError(409, '这个昵称在小组里已被使用');
    db.prepare('UPDATE study_group_members SET display_name=? WHERE group_id=? AND user_id=?').run(
      d.displayName,
      row.id,
      p.id,
    );
    return json(groupDetail(row.id, p, tz()));
  }
  const { row } = managed(id, p);
  if (action === 'delete') {
    db.transaction(() => {
      db.prepare('DELETE FROM study_group_members WHERE group_id=?').run(row.id);
      db.prepare('DELETE FROM study_groups WHERE id=?').run(row.id);
    })();
    return json({ id: row.id, deleted: true });
  }
  if (action === 'remove') {
    const d = z.object({ member: z.string().max(40) }).strict().parse(await readJson(request, 1000));
    const target = memberByKey(row.id, d.member);
    if (target.role === 'owner') throw new HttpError(409, '组长不能退出，可以解散小组');
    db.prepare('DELETE FROM study_group_members WHERE group_id=? AND user_id=?').run(row.id, target.user_id);
    return json(groupDetail(row.id, p, tz()));
  }
  if (action === 'rotate') {
    // ponytail: 32^8 codes, so a clash is a retry away; the UNIQUE index is the real guard.
    for (let tries = 0; ; tries++) {
      try {
        db.prepare('UPDATE study_groups SET invite_code=?,updated_at=? WHERE id=?').run(newCode(), Date.now(), row.id);
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE' || tries > 3) throw error;
      }
    }
    return json(groupDetail(row.id, p, tz()));
  }
  if (action) throw new HttpError(404, '学习小组接口不存在');
  const d = z
    .object({
      name: plain(40).optional(),
      goalText: plain(120, 0).optional(),
      goalStop: z
        .string()
        .refine((s) => s === '' || Object.hasOwn(STOP_NAMES, s))
        .optional(),
    })
    .strict()
    .parse(await readJson(request, 2000));
  const goalChanged = d.goalText !== undefined || d.goalStop !== undefined;
  db.prepare(
    `UPDATE study_groups SET name=COALESCE(?,name),goal_text=COALESCE(?,goal_text),goal_stop=COALESCE(?,goal_stop),
      goal_set_at=CASE WHEN ? THEN ? ELSE goal_set_at END,updated_at=? WHERE id=?`,
  ).run(d.name ?? null, d.goalText ?? null, d.goalStop ?? null, +goalChanged, Date.now(), Date.now(), row.id);
  return json(groupDetail(row.id, p, tz()));
}
