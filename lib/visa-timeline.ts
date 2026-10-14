// The F-1 → H-1B → green card date planner (/career/visa-timeline). Pure and client-safe: the
// page keeps its answers in this browser only. Planning help, not legal advice; every rule names
// the official page it was read from and the day it was last checked there.

/** Day the rules below were last checked against their sources. */
export const VERIFIED_ON = '2026-10-14';
const USCIS = 'https://www.uscis.gov';

export type RuleId = 'opt' | 'unemployment' | 'stem' | 'h1b' | 'capGap' | 'greenCard';
export const VISA_RULES: Record<RuleId, { zh: string; en: string; source: string; verifiedOn: string }> = {
  opt: {
    zh: '毕业后 OPT 用 I-765 申请：最早在项目结束日前 90 天，最晚在结束日后 60 天，并且要在 DSO 把推荐录入 SEVIS 后 30 天内递交。',
    en: 'Post-completion OPT is filed on Form I-765 from 90 days before to 60 days after the program end date, and within 30 days of your DSO entering the recommendation in SEVIS.',
    source: `${USCIS}/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students`,
    verifiedOn: VERIFIED_ON,
  },
  unemployment: {
    zh: 'OPT 期间累计失业最多 90 天；获批 24 个月 STEM OPT 延期后，整个 OPT 期间合计最多 150 天。',
    en: 'Up to 90 days of unemployment in total during OPT; with the 24-month STEM extension, up to 150 days over the whole OPT period.',
    source: `${USCIS}/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt`,
    verifiedOn: VERIFIED_ON,
  },
  stem: {
    zh: 'STEM OPT 延期最早在当前 OPT EAD 到期前 90 天递交，必须在到期前送达，并且在 DSO 录入推荐后 60 天内；按时递交、EAD 到期时仍在审的，工作许可自动延长 180 天。',
    en: 'The STEM OPT extension may be filed up to 90 days before your current OPT EAD expires, must arrive before it expires and within 60 days of your DSO’s recommendation; while a timely application is pending, work authorization is extended automatically for 180 days.',
    source: `${USCIS}/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt`,
    verifiedOn: VERIFIED_ON,
  },
  h1b: {
    zh: 'H-1B 名额要先在线注册抽签，注册期通常在 3 月，具体日期每年由 USCIS 公布（FY2027 起按工资级别加权抽签）；中签后最早 4 月 1 日递交申请，最早 10 月 1 日开始工作。',
    en: 'Cap-subject H-1B starts with an online registration, usually in March on dates USCIS announces each year (weighted by wage level from FY2027); selected registrants may file from April 1, with employment starting October 1 at the earliest.',
    source: `${USCIS}/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations/h-1b-electronic-registration-process`,
    verifiedOn: VERIFIED_ON,
  },
  capGap: {
    zh: 'Cap-gap：中签后按时递交、申请在美国境内转换身份的 H-1B，可让 F-1 身份和 OPT 工作许可延续到 H-1B 生效日或该财年的 4 月 1 日，以较早者为准。',
    en: 'Cap-gap: a timely filed, selected H-1B petition requesting a change of status can extend F-1 status and OPT work authorization until the H-1B start date or April 1 of that fiscal year, whichever is earlier.',
    source: `${USCIS}/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations/extension-of-post-completion-optional-practical-training-opt-and-f-1-status-for-eligible-students`,
    verifiedOn: VERIFIED_ON,
  },
  greenCard: {
    zh: '职业移民绿卡一般经过 PERM（劳工部）、I-140、I-485 几步，优先日决定排队位置；处理时长和排期常变，以 USCIS 和国务院签证公告为准。这里只计算已经过去的天数。',
    en: 'An employment-based green card usually goes through PERM (Department of Labor), I-140 and I-485, and the priority date sets your place in the queue; processing times and the Visa Bulletin change often. This page only counts the days already passed.',
    source: `${USCIS}/green-card/green-card-processes-and-procedures/visa-availability-priority-dates`,
    verifiedOn: VERIFIED_ON,
  },
};

export type VisaInput = {
  /** Dates are YYYY-MM-DD; anything else is ignored. */
  programEnd?: string;
  /** The degree is on the DHS STEM list. */
  stem?: boolean;
  optStart?: string;
  optEnd?: string;
  /** A STEM OPT extension is filed or approved. */
  stemFiled?: boolean;
  /** The registration year (March) in which the H-1B was selected, if any. */
  h1bSelected?: number;
  permFiled?: string;
  permApproved?: string;
  i140Filed?: string;
  priorityDate?: string;
  i485Filed?: string;
};
export type VisaEvent = {
  date: string;
  kind: string;
  zh: string;
  en: string;
  /** deadline: a date to file by; warn: a limit running out; info: a window opening; past: a stage reached. */
  severity: 'deadline' | 'warn' | 'info' | 'past';
  rule: RuleId;
  /** past only: whole days from `date` to today. */
  days?: number;
};

const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const time = (date: string) => Date.parse(`${date}T00:00:00Z`);
/** A real calendar date in YYYY-MM-DD, or undefined. */
export function validDate(value: unknown) {
  if (typeof value !== 'string' || !ISO.test(value)) return undefined;
  const t = time(value);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value ? value : undefined;
}
export const addDays = (date: string, n: number) => new Date(time(date) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((time(to) - time(from)) / DAY);
/** `n` months on, clamped to the month's last day (Feb 29 + 12 months is Feb 28): never later than real. */
export function addMonths(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Every dated step for this learner, oldest first. `today` is YYYY-MM-DD. */
export function visaTimeline(input: VisaInput, today: string): VisaEvent[] {
  const out: VisaEvent[] = [];
  const add = (date: string, kind: string, severity: VisaEvent['severity'], rule: RuleId, zh: string, en: string) =>
    out.push({ date, kind, zh, en, severity, rule });
  const end = validDate(input.programEnd);
  const optStart = validDate(input.optStart);
  const optEnd = validDate(input.optEnd);
  if (end) {
    add(addDays(end, -90), 'opt-open', 'info', 'opt', '最早可以递交 OPT 申请（I-765）', 'Earliest day to file for OPT (Form I-765)');
    add(addDays(end, 60), 'opt-close', 'deadline', 'opt', 'OPT 申请最晚递交日（项目结束后第 60 天）', 'Last day to file for OPT (60 days after the program end date)');
  }
  if (optStart)
    // Day 1 is the EAD start date, so day 90 comes 89 days later: the earlier of two readings.
    add(
      addDays(optStart, 89),
      'unemployment',
      'warn',
      'unemployment',
      input.stemFiled
        ? '若从 EAD 开始日起一直没有工作，这天用满 90 天失业额度（含 STEM 延期合计 150 天）'
        : '若从 EAD 开始日起一直没有工作，这天用满 90 天失业额度',
      input.stemFiled
        ? 'If you have not worked since the EAD start date, your 90 days of unemployment run out on this day (150 in total with the STEM extension)'
        : 'If you have not worked since the EAD start date, your 90 days of unemployment run out on this day',
    );
  if (optEnd) {
    if (input.stem && !input.stemFiled)
      add(addDays(optEnd, -90), 'stem-open', 'info', 'stem', '最早可以递交 STEM OPT 延期申请', 'Earliest day to file the STEM OPT extension');
    add(
      optEnd,
      'opt-end',
      'deadline',
      input.stem && !input.stemFiled ? 'stem' : 'opt',
      input.stem && !input.stemFiled ? 'OPT EAD 到期：STEM OPT 延期申请必须在这天之前送达 USCIS' : 'OPT EAD 到期',
      input.stem && !input.stemFiled ? 'OPT EAD expires: the STEM OPT extension must reach USCIS before this day' : 'OPT EAD expires',
    );
    if (input.stemFiled)
      add(
        addDays(optEnd, 180),
        'stem-pending',
        'info',
        'stem',
        'STEM OPT 申请若仍在审，自动延长的工作许可最晚到这天',
        'If the STEM OPT application is still pending, the automatic extension of work authorization ends by this day',
      );
  }
  // Registrations inside the work authorization: OPT, plus 24 months of STEM where it applies.
  const authEnd = optEnd && input.stem ? addMonths(optEnd, 24) : optEnd;
  const from = optStart ?? end;
  const selected = Number.isInteger(input.h1bSelected) ? input.h1bSelected! : undefined;
  const years = new Set<number>(selected ? [selected] : []);
  // Without any F-1 date there is no window to place registrations in.
  if (from)
    for (let y = Number(from.slice(0, 4)); y <= Number(from.slice(0, 4)) + 3; y++)
      if (`${y}-03-31` >= from && (!authEnd || `${y}-03-01` <= authEnd)) years.add(y);
  for (const y of [...years].sort((a, b) => a - b).filter((y) => !selected || y <= selected).slice(0, 3)) {
    const fy = y + 1;
    if (y === selected) {
      add(`${y}-04-01`, 'h1b-file', 'info', 'h1b', `FY${fy} H-1B 中签：最早从这天起递交申请`, `FY${fy} H-1B selected: the petition may be filed from this day`);
    } else
      add(
        `${y}-03-01`,
        'h1b-registration',
        'info',
        'h1b',
        `FY${fy} H-1B 注册期通常在 3 月，具体日期以 USCIS 当年公告为准`,
        `The FY${fy} H-1B registration usually opens in March, on dates USCIS announces that year`,
      );
    add(`${y}-10-01`, 'h1b-start', 'info', 'h1b', `FY${fy} H-1B 最早生效日`, `Earliest FY${fy} H-1B start date`);
    // OPT running out between the filing season and October 1 is the gap cap-gap may bridge.
    if (authEnd && authEnd >= `${y}-04-01` && authEnd < `${y}-10-01`)
      add(
        authEnd,
        'cap-gap',
        'warn',
        'capGap',
        `工作许可在 FY${fy} H-1B 生效前到期：若已按时递交转换身份的 H-1B 申请，cap-gap 最长延续到 ${y}-10-01 生效日或 ${fy}-04-01，以较早者为准；没有的话要提前和 DSO 商量`,
        `Work authorization ends before the FY${fy} H-1B start: with a timely change-of-status petition, cap-gap may extend it to the ${y}-10-01 start or ${fy}-04-01, whichever is earlier; otherwise talk to your DSO early`,
      );
  }
  const stages: [keyof VisaInput, string, string, string][] = [
    ['permFiled', 'perm-filed', 'PERM 已递交', 'PERM filed'],
    ['permApproved', 'perm-approved', 'PERM 已批准', 'PERM approved'],
    ['i140Filed', 'i140-filed', 'I-140 已递交', 'I-140 filed'],
    ['priorityDate', 'priority-date', '优先日', 'Priority date'],
    ['i485Filed', 'i485-filed', 'I-485 已递交', 'I-485 filed'],
  ];
  for (const [key, kind, zh, en] of stages) {
    const date = validDate(input[key]);
    if (date) out.push({ date, kind, zh, en, severity: 'past', rule: 'greenCard', days: Math.max(0, daysBetween(date, today)) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The next deadline on or after today, or else the next dated step; null when nothing is ahead. */
export function nextDeadline(events: readonly VisaEvent[], today: string) {
  const ahead = events.filter((e) => e.severity !== 'past' && e.date >= today);
  const next = ahead.find((e) => e.severity === 'deadline') ?? ahead[0];
  return next ? { event: next, days: daysBetween(today, next.date) } : null;
}
