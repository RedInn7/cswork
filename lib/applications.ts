import { SOURCES } from './experience';
import { calendar, escapeText, utcStamp, vevent } from './ics';

/** The tracker board's columns in order (stored as the id; lib/server/applications.ts). */
export const STAGES = ['saved', 'applied', 'oa', 'phone', 'onsite', 'offer', 'ghosted', 'rejected', 'withdrawn'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_NAMES: Record<Stage, [string, string]> = {
  saved: ['想投', 'Saved'],
  applied: ['已投递', 'Applied'],
  oa: ['OA', 'OA'],
  phone: ['电面', 'Phone screen'],
  onsite: ['Onsite', 'Onsite'],
  offer: ['Offer', 'Offer'],
  ghosted: ['无回音', 'No response'],
  rejected: ['被拒', 'Rejected'],
  withdrawn: ['已撤回', 'Withdrawn'],
};
/** Stages with the OA still ahead: past them (or closed) a deadline gets no countdown and no calendar event. */
export const OA_OPEN: readonly Stage[] = ['saved', 'applied', 'oa'];
export const oaOpen = (a: Application) => a.oaDeadline !== null && OA_OPEN.includes(a.stage);
export const APPLICATIONS_MAX = 300;
export const NOTES_MAX = 2000;
export const JD_MAX = 10000;
/** Where a referral stands (job_applications.referral_status), [zh, en]. */
export const REFERRAL_STATUS: Readonly<Record<string, [string, string]>> = {
  'to-ask': ['想找人内推', 'Want a referral'],
  asked: ['已请求', 'Asked'],
  agreed: ['已答应', 'Agreed'],
  submitted: ['已提交', 'Submitted'],
  declined: ['被拒', 'Declined'],
};

export type ApplicationFields = {
  company: string;
  role: string;
  stage: Stage;
  /** Epoch ms or null. */
  appliedAt: number | null;
  oaDeadline: number | null;
  interviewAt: number | null;
  /** Who referred you (free text). */
  referral: string;
  link: string;
  notes: string;
  /** A CHANNELS key or ''. */
  channel: string;
  /** A REFERRAL_STATUS key or ''. */
  referralStatus: string;
  nextAction: string;
  nextAt: number | null;
  resumeVersion: string;
};
/** [stage, epoch ms it moved there], oldest first. */
export type StageEntry = [Stage, number];
export type Application = ApplicationFields & {
  id: string;
  /** The company page the name matched, or ''. */
  companySlug: string;
  /** Logged since wave 8: older cards start with []. */
  stageLog: StageEntry[];
  /** A job description is saved (read it with GET <id>/jd). */
  hasJd: boolean;
  createdAt: number;
  updatedAt: number;
  /** This company's OA problems and mock OA, when there are any. */
  links: { oa: string | null; mock: string | null } | null;
  /** The posting's last sighting when the company's job board no longer lists it, else null. */
  closedAt: number | null;
  /** Interview prep for a card at OA, phone or onsite with a company page, else null. */
  prep: { experiences: { href: string; n: number } | null; problems: string; stories: string } | null;
};

/** A job posting link: https only, no credentials in it. */
export function httpsLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

const OA_ON: readonly Stage[] = ['oa', 'phone', 'onsite', 'offer'];
const INTERVIEW_ON: readonly Stage[] = ['phone', 'onsite', 'offer'];
/** Applications sent, and how many reached an OA, an interview and an offer (a date counts as reached). */
export function funnel(items: readonly Application[]) {
  const sent = items.filter((a) => a.stage !== 'saved');
  return {
    applied: sent.length,
    oa: sent.filter((a) => OA_ON.includes(a.stage) || a.oaDeadline !== null).length,
    interview: sent.filter((a) => INTERVIEW_ON.includes(a.stage) || a.interviewAt !== null).length,
    offers: sent.filter((a) => a.stage === 'offer').length,
  };
}

export const DAY = 86400000;
export const STALE_DAYS = 21;
const FOLLOW_UP_DAYS = 7;
const WAITING: readonly Stage[] = ['applied', 'oa', 'phone', 'onsite'];
/** Closed for good: no interview reminders, nothing to chase. */
const ENDED: readonly Stage[] = ['rejected', 'withdrawn', 'ghosted'];

/**
 * When the card reached its stage: the last logged move. An applied card counts from its applied
 * date when that is earlier (added after applying). Cards from before the log fall back to
 * updated_at: later than the real move at worst, so they are never flagged early.
 */
export function stageSince(a: Application) {
  const moved = a.stageLog.at(-1)?.[1] ?? a.updatedAt;
  return a.stage === 'applied' && a.appliedAt !== null ? Math.min(moved, a.appliedAt) : moved;
}
/** Each logged stage with the days spent in it (the last one up to `now`). */
export function stageDays(a: Application, now: number) {
  return a.stageLog.map(([stage, at], i) => ({ stage, at, days: ((a.stageLog[i + 1]?.[1] ?? now) - at) / DAY }));
}
/** Median days from the first `from` move to the next `to` move, over cards whose log has both; null with none. */
export function medianDays(items: readonly Application[], from: Stage, to: Stage) {
  const spans = items
    .flatMap((a) => {
      const i = a.stageLog.findIndex(([s]) => s === from);
      const j = i < 0 ? -1 : a.stageLog.findIndex(([s], k) => k > i && s === to);
      return j < 0 ? [] : [(a.stageLog[j][1] - a.stageLog[i][1]) / DAY];
    })
    .sort((x, y) => x - y);
  const m = spans.length >> 1;
  return spans.length ? (spans.length % 2 ? spans[m] : (spans[m - 1] + spans[m]) / 2) : null;
}
const interviewAhead = (a: Application, now: number) => a.interviewAt !== null && a.interviewAt > now && !ENDED.includes(a.stage);
/** Waiting STALE_DAYS without a move, with no OA deadline or interview still ahead: probably ghosted. */
export const stale = (a: Application, now: number) =>
  WAITING.includes(a.stage) &&
  now - stageSince(a) > STALE_DAYS * DAY &&
  !(oaOpen(a) && a.oaDeadline! > now) &&
  !interviewAhead(a, now);
/** Applied a week ago, nothing since and no follow-up planned: worth a nudge (stale cards get their own hint). */
export const followUpDue = (a: Application, now: number) =>
  a.stage === 'applied' && a.nextAt === null && now - stageSince(a) >= FOLLOW_UP_DAYS * DAY && !stale(a, now);
/** 9:00 tomorrow, local time. */
export function tomorrowMorning(now: number) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9).getTime();
}
/** Local midnight starting the week (Monday) `now` falls in. */
export function weekStart(now: number) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime();
}
/** When the application went in: the applied date, else its logged move to Applied. */
const appliedOn = (a: Application) => a.appliedAt ?? a.stageLog.find(([s]) => s === 'applied')?.[1] ?? null;
const replied = (a: Application) =>
  OA_ON.includes(a.stage) || a.oaDeadline !== null || a.interviewAt !== null || a.stageLog.some(([s]) => OA_ON.includes(s));

/**
 * The board's numbers: per channel, applications sent and how many heard back (an OA or later);
 * the average days spent per stage over finished stays; the stage each rejection came after;
 * this week's applications and the weeks in a row (this one or the last finished one back)
 * that met `goal`.
 */
export function trackerStats(items: readonly Application[], now: number, goal: number) {
  const channels = new Map<string, { sent: number; replied: number }>();
  const stays = new Map<Stage, number[]>();
  const rejectedAfter = new Map<Stage, number>();
  for (const a of items) {
    if (a.stage !== 'saved') {
      const c = channels.get(a.channel) ?? { sent: 0, replied: 0 };
      channels.set(a.channel, { sent: c.sent + 1, replied: c.replied + Number(replied(a)) });
    }
    a.stageLog.forEach(([stage, at], i) => {
      const next = a.stageLog[i + 1];
      if (next) stays.set(stage, [...(stays.get(stage) ?? []), (next[1] - at) / DAY]);
      if (next?.[0] === 'rejected') rejectedAfter.set(stage, (rejectedAfter.get(stage) ?? 0) + 1);
    });
  }
  const start = weekStart(now);
  // Week w back starts at weekStart of a moment inside it (DST-safe), ends where week w-1 starts.
  const weekOf = (w: number) => weekStart(start - w * 7 * DAY + 3 * DAY);
  const sentIn = (w: number) => {
    const from = weekOf(w),
      to = w ? weekOf(w - 1) : Infinity;
    return items.filter((a) => {
      const at = appliedOn(a);
      return at !== null && at >= from && at < to;
    }).length;
  };
  const thisWeek = sentIn(0);
  let streak = 0;
  if (goal > 0) for (let w = thisWeek >= goal ? 0 : 1; w < 105 && sentIn(w) >= goal; w++) streak++;
  return {
    channels: [...channels].map(([channel, c]) => ({ channel, ...c })).sort((x, y) => y.sent - x.sent),
    stays: STAGES.filter((s) => stays.has(s)).map((stage) => {
      const days = stays.get(stage)!;
      return { stage, days: days.reduce((x, y) => x + y, 0) / days.length, n: days.length };
    }),
    rejectedAfter: STAGES.filter((s) => rejectedAfter.has(s))
      .map((stage) => ({ stage, n: rejectedAfter.get(stage)! }))
      .sort((x, y) => y.n - x.n),
    thisWeek,
    streak,
  };
}

/** The interview write-up form (experience-oa-outcomes prefills it), season from the interview's month. */
export function writeUpHref(a: Application) {
  const q = new URLSearchParams({ view: 'progress', tab: 'share' });
  if (a.companySlug) q.set('company', a.companySlug);
  if (a.role) q.set('role', a.role);
  q.set('employment', /intern|实习/i.test(a.role) ? 'intern' : 'fulltime');
  if (a.interviewAt !== null) {
    const d = new Date(a.interviewAt);
    q.set('season', `${d.getFullYear()}-${['winter', 'spring', 'summer', 'fall'][Math.floor(((d.getMonth() + 1) % 12) / 3)]}`);
  }
  return `/?${q}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** Local "YYYY-MM-DD" (`time`: plus " HH:mm"), '' for null. */
export function localStamp(at: number | null, time = true) {
  if (at === null) return '';
  const d = new Date(at);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return time ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

/** "3 天 4 小时" until `at`, or null once it has passed. */
export function countdown(at: number, now: number, english: boolean) {
  const left = at - now;
  if (left <= 0) return null;
  const days = Math.floor(left / 86400000),
    hours = Math.floor((left % 86400000) / 3600000),
    minutes = Math.max(1, Math.floor((left % 3600000) / 60000));
  if (english) return days ? `${days}d ${hours}h` : hours ? `${hours}h` : `${minutes}m`;
  return days ? `${days} 天 ${hours} 小时` : hours ? `${hours} 小时` : `${minutes} 分钟`;
}

/** A spreadsheet cell, quoted; text a spreadsheet would run as a formula (= + - @, tab, CR) gets a leading '. */
export const csvCell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

/** The board as CSV (UTF-8 with BOM so spreadsheets read Chinese), times in this browser's zone. */
export function applicationsCsv(items: readonly Application[], english: boolean) {
  const head = english
    ? ['Company', 'Role', 'Stage', 'Applied', 'OA deadline', 'Interview', 'Channel', 'Referral status', 'Referrer', 'Link', 'Resume version', 'Next step', 'Follow up on', 'Stage history', 'Notes', 'Updated']
    : ['公司', '岗位', '阶段', '投递日期', 'OA 截止', '面试时间', '渠道', '内推状态', '内推人', '链接', '简历版本', '下一步', '跟进时间', '阶段记录', '备注', '更新时间'];
  const i = english ? 1 : 0;
  const rows = items.map((a) => [
    a.company,
    a.role,
    STAGE_NAMES[a.stage][i],
    localStamp(a.appliedAt, false),
    localStamp(a.oaDeadline),
    localStamp(a.interviewAt),
    SOURCES[a.channel]?.[i] ?? '',
    REFERRAL_STATUS[a.referralStatus]?.[i] ?? '',
    a.referral,
    a.link,
    a.resumeVersion,
    a.nextAction,
    localStamp(a.nextAt),
    a.stageLog.map(([s, at]) => `${STAGE_NAMES[s][i]} ${localStamp(at, false)}`).join(' → '),
    a.notes,
    localStamp(a.updatedAt),
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** What a calendar export would hold: open OA deadlines, interviews and follow-ups still ahead. */
export const calendarItems = (items: readonly Application[], now: number) =>
  items.filter((a) => (oaOpen(a) && a.oaDeadline! > now) || interviewAhead(a, now) || (a.nextAt ?? 0) > now);

/**
 * The calendar export: each open OA deadline still to come (reminded a day and two hours before),
 * each interview ahead (an hour before) and each follow-up ahead. The OA event keeps the UID it
 * always had, so a re-import updates calendars that already hold it.
 */
export function applicationsIcs(items: readonly Application[], site: string, english: boolean, now = Date.now()) {
  const page = `${site}/career/tracker`;
  const event = (uid: string, at: number, summary: string, a: Application, triggers: string[], extra: string[] = []) =>
    vevent(
      uid,
      now,
      [
        `DTSTART:${utcStamp(at)}`,
        ...extra,
        `SUMMARY:${escapeText(summary)}`,
        `DESCRIPTION:${escapeText([a.link, page].filter(Boolean).join('\n'))}`,
        `URL:${page}`,
      ],
      triggers.map((trigger) => ({ trigger, note: summary })),
    );
  const events = calendarItems(items, now).flatMap((a) => {
    const what = `${a.company}${a.role ? ` · ${a.role}` : ''}`;
    const out: string[][] = [];
    if (oaOpen(a) && a.oaDeadline! > now)
      out.push(event(`cswork-application-${a.id}@cswork`, a.oaDeadline!, english ? `OA due: ${what}` : `OA 截止：${what}`, a, ['-P1D', '-PT2H']));
    if (interviewAhead(a, now))
      out.push(
        event(`cswork-application-${a.id}-interview@cswork`, a.interviewAt!, english ? `Interview: ${what}` : `面试：${what}`, a, ['-PT1H'], ['DURATION:PT1H']),
      );
    if ((a.nextAt ?? 0) > now) {
      const step = a.nextAction ? ` · ${a.nextAction}` : '';
      out.push(event(`cswork-application-${a.id}-next@cswork`, a.nextAt!, english ? `Follow up: ${what}${step}` : `跟进：${what}${step}`, a, ['PT0S']));
    }
    return out;
  });
  return calendar(['VERSION:2.0', 'PRODID:-//CSWork//Application tracker//EN', 'CALSCALE:GREGORIAN'], events);
}
