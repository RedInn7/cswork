import { calendar, escapeText, utcStamp, vevent } from './ics';

/** The tracker board's columns in order (stored as the id; lib/server/applications.ts). */
export const STAGES = ['saved', 'applied', 'oa', 'phone', 'onsite', 'offer', 'rejected', 'withdrawn'] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_NAMES: Record<Stage, [string, string]> = {
  saved: ['想投', 'Saved'],
  applied: ['已投递', 'Applied'],
  oa: ['OA', 'OA'],
  phone: ['电面', 'Phone screen'],
  onsite: ['Onsite', 'Onsite'],
  offer: ['Offer', 'Offer'],
  rejected: ['被拒', 'Rejected'],
  withdrawn: ['已撤回', 'Withdrawn'],
};
/** Closed applications: no countdown, no calendar event. */
export const CLOSED: readonly Stage[] = ['rejected', 'withdrawn'];
export const APPLICATIONS_MAX = 300;
export const NOTES_MAX = 2000;

export type ApplicationFields = {
  company: string;
  role: string;
  stage: Stage;
  /** Epoch ms or null. */
  appliedAt: number | null;
  oaDeadline: number | null;
  interviewAt: number | null;
  referral: string;
  link: string;
  notes: string;
};
export type Application = ApplicationFields & {
  id: string;
  /** The company page the name matched, or ''. */
  companySlug: string;
  createdAt: number;
  updatedAt: number;
  /** This company's OA problems and mock OA, when there are any. */
  links: { oa: string | null; mock: string | null } | null;
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
    ? ['Company', 'Role', 'Stage', 'Applied', 'OA deadline', 'Interview', 'Referral', 'Link', 'Notes', 'Updated']
    : ['公司', '岗位', '阶段', '投递日期', 'OA 截止', '面试时间', '内推', '链接', '备注', '更新时间'];
  const rows = items.map((a) => [
    a.company,
    a.role,
    STAGE_NAMES[a.stage][english ? 1 : 0],
    localStamp(a.appliedAt, false),
    localStamp(a.oaDeadline),
    localStamp(a.interviewAt),
    a.referral,
    a.link,
    a.notes,
    localStamp(a.updatedAt),
  ]);
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** One event per open OA deadline, reminded a day and two hours before by the calendar itself. */
export function deadlinesIcs(items: readonly Application[], site: string, english: boolean, now = Date.now()) {
  const events = items
    .filter((a) => a.oaDeadline !== null && !CLOSED.includes(a.stage))
    .map((a) => {
      const what = `${a.company}${a.role ? ` · ${a.role}` : ''}`;
      const summary = english ? `OA due: ${what}` : `OA 截止：${what}`;
      return vevent(
        `cswork-application-${a.id}@cswork`,
        now,
        [
          `DTSTART:${utcStamp(a.oaDeadline!)}`,
          `SUMMARY:${escapeText(summary)}`,
          `DESCRIPTION:${escapeText([a.link, `${site}/career/tracker`].filter(Boolean).join('\n'))}`,
          `URL:${site}/career/tracker`,
        ],
        [
          { trigger: '-P1D', note: summary },
          { trigger: '-PT2H', note: summary },
        ],
      );
    });
  return calendar(['VERSION:2.0', 'PRODID:-//CSWork//Application tracker//EN', 'CALSCALE:GREGORIAN'], events);
}
