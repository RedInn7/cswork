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
/** An offer's answer-by date counts at the Offer stage only (kept, but ignored, at any other). */
export const offerOpen = (a: Application) => a.offerDeadline !== null && a.stage === 'offer';
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
  /** When an offer must be answered by. */
  offerDeadline: number | null;
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
  /**
   * The company's median weeks from applying to an offer in member write-ups, for a card at OA,
   * phone or onsite while the learner has an offer deadline ahead (expeditePlan), else null.
   */
  process: { weeks: number } | null;
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
export const ENDED: readonly Stage[] = ['rejected', 'withdrawn', 'ghosted'];
/** A follow-up is set and the card is still open (an ended card keeps its date but has nothing to chase). */
export const followUpOpen = (a: Application) => a.nextAt !== null && !ENDED.includes(a.stage);

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
/**
 * Applied a week ago, nothing since and no follow-up planned: worth a nudge (stale cards get their own hint).
 * Counts from the last edit too, so a follow-up marked done waits another week before the next nudge.
 */
export const followUpDue = (a: Application, now: number) =>
  a.stage === 'applied' &&
  a.nextAt === null &&
  now - Math.max(stageSince(a), a.updatedAt) >= FOLLOW_UP_DAYS * DAY &&
  !stale(a, now);
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
export const appliedOn = (a: Application) => a.appliedAt ?? a.stageLog.find(([s]) => s === 'applied')?.[1] ?? null;
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
  q.set('employment', /\bintern(ship)?s?\b|实习/i.test(a.role) ? 'intern' : 'fulltime');
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

export type AgendaEvent = { kind: 'oa' | 'interview' | 'next' | 'offer'; at: number; a: Application };
/** Every dated step still ahead, soonest first: open OA deadlines, interviews, follow-ups and offer deadlines. */
export function agenda(items: readonly Application[], now: number): AgendaEvent[] {
  return items
    .flatMap((a): (AgendaEvent | false)[] => [
      oaOpen(a) && a.oaDeadline! > now && { kind: 'oa', at: a.oaDeadline!, a },
      interviewAhead(a, now) && { kind: 'interview', at: a.interviewAt!, a },
      followUpOpen(a) && a.nextAt! > now && { kind: 'next', at: a.nextAt!, a },
      offerOpen(a) && a.offerDeadline! > now && { kind: 'offer', at: a.offerDeadline!, a },
    ])
    .filter((e): e is AgendaEvent => e !== false)
    .sort((x, y) => x.at - y.at);
}
/** The cards a calendar export would hold events for. */
export const calendarItems = (items: readonly Application[], now: number) => [...new Set(agenda(items, now).map((e) => e.a))];

/**
 * The calendar export: each open OA deadline still to come (reminded a day and two hours before),
 * each interview ahead (an hour before), each follow-up ahead and each offer deadline ahead (three
 * days and a day before). The OA event keeps the UID it always had, so a re-import updates
 * calendars that already hold it.
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
  const events = agenda(items, now).map(({ kind, at, a }) => {
    const what = `${a.company}${a.role ? ` · ${a.role}` : ''}`;
    const uid = `cswork-application-${a.id}${kind === 'oa' ? '' : `-${kind}`}@cswork`;
    if (kind === 'oa') return event(uid, at, english ? `OA due: ${what}` : `OA 截止：${what}`, a, ['-P1D', '-PT2H']);
    if (kind === 'interview') return event(uid, at, english ? `Interview: ${what}` : `面试：${what}`, a, ['-PT1H'], ['DURATION:PT1H']);
    if (kind === 'offer') return event(uid, at, english ? `Offer deadline: ${what}` : `Offer 截止：${what}`, a, ['-P3D', '-P1D']);
    const step = a.nextAction ? ` · ${a.nextAction}` : '';
    return event(uid, at, english ? `Follow up: ${what}${step}` : `跟进：${what}${step}`, a, ['PT0S']);
  });
  return calendar(['VERSION:2.0', 'PRODID:-//CSWork//Application tracker//EN', 'CALSCALE:GREGORIAN'], events);
}

/** Stages still in process: what an offer deadline may come before. */
const IN_PROCESS: readonly Stage[] = ['oa', 'phone', 'onsite'];
/**
 * With an offer deadline ahead, the processes that may not finish by the earliest one: each card at
 * OA, phone or onsite with when an offer would likely come (eta), and whether that is after the
 * deadline. The estimate is the company's median process length from member write-ups counted
 * from the application (process.weeks), else this board's own median from that stage to an
 * offer counted from the move there, else unknown (null). Null with no offer deadline ahead.
 */
export function expeditePlan(items: readonly Application[], now: number) {
  const offer = items.filter((a) => offerOpen(a) && a.offerDeadline! > now).sort((x, y) => x.offerDeadline! - y.offerDeadline!)[0];
  if (!offer) return null;
  const deadline = offer.offerDeadline!;
  const rows = items
    .filter((a) => IN_PROCESS.includes(a.stage))
    .map((a) => {
      const weeks = a.process?.weeks;
      const median = weeks === undefined ? medianDays(items, a.stage, 'offer') : null;
      const eta =
        weeks !== undefined ? (appliedOn(a) ?? a.createdAt) + weeks * 7 * DAY : median !== null ? stageSince(a) + median * DAY : null;
      return { a, eta, late: eta !== null && eta > deadline };
    });
  return { offer, deadline, rows };
}

const SCAN_DAYS = 14;
/** Interviews closer than this clash: an hour each plus half an hour to reset. */
const INTERVIEW_GAP = 90 * 60000;
export type ScheduleIssue = { kind: 'overlap' | 'oa-pile' | 'offer-clash'; day: string; ids: string[] };
/**
 * Clashes in the next two weeks: two interviews starting under 90 minutes apart, three or more OA
 * deadlines on one local day, and an offer deadline on the same day as another card's interview
 * or OA deadline. Days are this browser's local dates, soonest first.
 */
export function scheduleIssues(items: readonly Application[], now: number): ScheduleIssue[] {
  const ahead = agenda(items, now).filter((e) => e.at <= now + SCAN_DAYS * DAY);
  const issues: ScheduleIssue[] = [];
  const interviews = ahead.filter((e) => e.kind === 'interview');
  interviews.forEach((x, i) => {
    for (const y of interviews.slice(i + 1))
      if (y.at - x.at < INTERVIEW_GAP) issues.push({ kind: 'overlap', day: localStamp(x.at, false), ids: [x.a.id, y.a.id] });
  });
  const days = new Map<string, AgendaEvent[]>();
  for (const e of ahead) days.set(localStamp(e.at, false), [...(days.get(localStamp(e.at, false)) ?? []), e]);
  for (const [day, list] of days) {
    const oas = list.filter((e) => e.kind === 'oa');
    if (oas.length >= 3) issues.push({ kind: 'oa-pile', day, ids: oas.map((e) => e.a.id) });
    for (const o of list.filter((e) => e.kind === 'offer')) {
      const others = list.filter((e) => (e.kind === 'oa' || e.kind === 'interview') && e.a.id !== o.a.id).map((e) => e.a.id);
      if (others.length) issues.push({ kind: 'offer-clash', day, ids: [o.a.id, ...new Set(others)] });
    }
  }
  return issues.sort((x, y) => x.day.localeCompare(y.day));
}
