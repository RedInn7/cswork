// The interview almanac (/career/almanac): the Chinese almanac's 宜 / 忌 of each day read in
// interview terms. Folk custom for fun, not advice. Pure and client-safe: the lunar calendar library
// is passed in, so the page can load it on demand and tests can call it directly.
type LunarLib = Pick<typeof import('lunar-typescript'), 'Solar'>;

export type Grade = '大吉' | '吉' | '平' | '慎';
export type TrackKey = 'phone' | 'onsite' | 'offer';
/** [almanac item, weight, group]: one weight per group, so 立券 and 交易 don't count twice. */
type Rule = [string, number, string];
type Track = { key: TrackKey; zh: string; en: string; yi: Rule[]; ji: Rule[] };

// Each kind of interview reads its own almanac items.
export const TRACKS: Track[] = [
  {
    key: 'phone',
    zh: '电面',
    en: 'Phone screen',
    yi: [
      ['会亲友', 1, 'meet'],
      ['会友', 1, 'meet'],
      ['开市', 0.5, 'open'],
    ],
    ji: [
      ['会亲友', -1, 'meet'],
      ['会友', -1, 'meet'],
    ],
  },
  {
    key: 'onsite',
    zh: 'Onsite',
    en: 'Onsite',
    yi: [
      ['赴任', 1.5, 'post'],
      ['出行', 1, 'go'],
    ],
    ji: [
      ['赴任', -1.5, 'post'],
      ['出行', -1, 'go'],
    ],
  },
  {
    key: 'offer',
    zh: '谈 Offer',
    en: 'Offer talks',
    yi: [
      ['订盟', 1, 'pact'],
      ['立券交易', 1, 'deal'],
      ['立券', 1, 'deal'],
      ['交易', 1, 'deal'],
      ['纳财', 0.5, 'gain'],
    ],
    ji: [
      ['订盟', -1, 'pact'],
      ['立券交易', -1, 'deal'],
      ['立券', -1, 'deal'],
      ['交易', -1, 'deal'],
      ['纳财', -0.5, 'gain'],
    ],
  },
];

/** The almanac's 宜 items in interview terms: [zh, en]. */
export const AS_YI: Record<string, [string, string]> = {
  赴任: ['Onsite', 'Onsite'],
  出行: ['出门面试', 'Travel to an interview'],
  会亲友: ['电面', 'Phone screen'],
  会友: ['电面', 'Phone screen'],
  订盟: ['接 Offer', 'Accept an offer'],
  立券交易: ['签合同', 'Sign the contract'],
  立券: ['签合同', 'Sign the contract'],
  交易: ['签合同', 'Sign the contract'],
  纳财: ['谈薪', 'Negotiate pay'],
  开市: ['投简历', 'Send applications'],
  入学: ['刷题', 'Practice problems'],
  祈福: ['许愿上岸', 'Wish for an offer'],
};
/** The 忌 items: the same readings, except the few that mean something else as a warning. */
export const AS_JI: Record<string, [string, string]> = {
  赴任: AS_YI.赴任,
  出行: AS_YI.出行,
  订盟: AS_YI.订盟,
  立券交易: AS_YI.立券交易,
  立券: AS_YI.立券,
  交易: AS_YI.交易,
  纳财: AS_YI.纳财,
  会亲友: ['约 coffee chat', 'Coffee chats'],
  会友: ['约 coffee chat', 'Coffee chats'],
  开市: ['海投', 'Mass applying'],
};

export const GRADE_TEXT: Record<Grade, [string, string]> = {
  大吉: ['最宜', 'Best'],
  吉: ['宜', 'Good'],
  平: ['一般', 'Fair'],
  慎: ['能改期就改', 'Reschedule if you can'],
};

export type Holiday = { zh: string; en: string; worked: boolean };
const holidayCache = new Map<number, Map<string, Holiday>>();
/**
 * US federal holidays on their observed weekday, plus the Friday after Thanksgiving, when most
 * companies are closed. `worked`: federal holidays tech companies usually work through.
 */
export function usHolidays(y: number): Map<string, Holiday> {
  const cached = holidayCache.get(y);
  if (cached) return cached;
  const h = new Map<string, Holiday>();
  const put = (m: number, d: number, zh: string, en: string, worked = false) =>
    h.set(`${m}-${d}`, { zh, en, worked });
  // A fixed date moves to Friday from a Saturday and to Monday from a Sunday.
  const fixed = (
    m: number,
    d: number,
    zh: string,
    en: string,
    worked = false,
  ) => {
    const w = new Date(y, m - 1, d).getDay();
    const t = new Date(y, m - 1, d + (w === 6 ? -1 : w === 0 ? 1 : 0));
    if (t.getFullYear() === y)
      put(t.getMonth() + 1, t.getDate(), zh, en, worked);
  };
  const nth = (m: number, weekday: number, n: number) =>
    1 + ((weekday - new Date(y, m - 1, 1).getDay() + 7) % 7) + (n - 1) * 7;
  const last = (m: number, weekday: number) => {
    const end = new Date(y, m, 0);
    return end.getDate() - ((end.getDay() - weekday + 7) % 7);
  };
  fixed(1, 1, '元旦', "New Year's Day");
  put(1, nth(1, 1, 3), '马丁·路德·金纪念日', 'MLK Day');
  put(2, nth(2, 1, 3), '总统日', "Presidents' Day");
  put(5, last(5, 1), '阵亡将士纪念日', 'Memorial Day');
  fixed(6, 19, '六月节', 'Juneteenth');
  fixed(7, 4, '独立日', 'Independence Day');
  put(9, nth(9, 1, 1), '劳动节', 'Labor Day');
  put(10, nth(10, 1, 2), '哥伦布日', 'Columbus Day', true);
  fixed(11, 11, '退伍军人节', 'Veterans Day', true);
  const thanksgiving = nth(11, 4, 4);
  put(11, thanksgiving, '感恩节', 'Thanksgiving');
  put(11, thanksgiving + 1, '感恩节次日', 'Day after Thanksgiving');
  fixed(12, 25, '圣诞节', 'Christmas Day');
  // Next year's New Year's Day on a Saturday is observed on this December 31.
  if (new Date(y + 1, 0, 1).getDay() === 6)
    put(12, 31, '元旦（补休）', "New Year's Day (observed)");
  holidayCache.set(y, h);
  return h;
}

export type AlmanacDay = {
  y: number;
  m: number;
  d: number;
  /** 0 = Sunday. */
  week: number;
  lunarMonth: string;
  lunarDay: string;
  /** [month, day] of the lunar date, for readers who don't read Chinese numerals. */
  lunarNum: [number, number];
  jieqi: string;
  festivals: string[];
  holiday: Holiday | null;
  /** Nobody schedules interviews: a weekend or a holiday companies close for. */
  dayOff: boolean;
  yi: string[];
  ji: string[];
  tianShen: string;
  /** 黄道 or 黑道. */
  type: string;
  zhiXing: string;
  xiuLuck: string;
  chong: string;
  /** Auspicious two-hour blocks between 07:00 and 19:00, as "09–11". */
  times: string[];
};

const INTERVIEW_ZHI = ['辰', '巳', '午', '未', '申', '酉']; // 07:00–19:00 local
/** One day's almanac entry. */
export function almanacDay(
  { Solar }: LunarLib,
  y: number,
  m: number,
  d: number,
): AlmanacDay {
  const solar = Solar.fromYmd(y, m, d);
  const lunar = solar.getLunar();
  const week = solar.getWeek();
  const holiday = usHolidays(y).get(`${m}-${d}`) ?? null;
  return {
    y,
    m,
    d,
    week,
    lunarMonth: lunar.getMonthInChinese(),
    lunarDay: lunar.getDayInChinese(),
    lunarNum: [Math.abs(lunar.getMonth()), lunar.getDay()],
    jieqi: lunar.getJieQi(),
    festivals: lunar.getFestivals(),
    holiday,
    dayOff: week === 0 || week === 6 || (!!holiday && !holiday.worked),
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    tianShen: lunar.getDayTianShen(),
    type: lunar.getDayTianShenType(),
    zhiXing: lunar.getZhiXing(),
    xiuLuck: lunar.getXiuLuck(),
    chong: lunar.getDayChongDesc(),
    times: lunar
      .getTimes()
      .filter(
        (t) =>
          INTERVIEW_ZHI.includes(t.getZhi()) && t.getTianShenType() === '黄道',
      )
      .map(
        (t) =>
          `${t.getMinHm().slice(0, 2)}–${String(Number(t.getMaxHm().slice(0, 2)) + 1).padStart(2, '0')}`,
      ),
  };
}

export const gradeOf = (score: number): Grade =>
  score >= 4 ? '大吉' : score >= 3 ? '吉' : score >= 2 ? '平' : '慎';
export type TrackRating = {
  score: number;
  grade: Grade;
  reasons: [string, number][];
};
type Rated = Pick<AlmanacDay, 'yi' | 'ji' | 'type' | 'zhiXing' | 'xiuLuck'>;

/**
 * A kind of interview starts at 2 of 5; its own 宜 / 忌 items, then the day's 黄道 / 黑道, 建除
 * and 星宿, add or take away.
 */
export function rateTrack(day: Rated, track: Track): TrackRating {
  if (day.yi.includes('诸事不宜') || day.ji.includes('诸事不宜'))
    return { score: 0.5, grade: '慎', reasons: [['诸事不宜', -1.5]] };
  const reasons: [string, number][] = [];
  let score = 2;
  for (const [rules, items] of [
    [track.yi, day.yi],
    [track.ji, day.ji],
  ] as const) {
    const seen = new Set<string>();
    for (const [word, weight, group] of rules) {
      if (!items.includes(word) || seen.has(group)) continue;
      seen.add(group);
      score += weight;
      reasons.push([`${weight > 0 ? '宜' : '忌'}${word}`, weight]);
    }
  }
  const add = (label: string, weight: number) => {
    score += weight;
    reasons.push([label, weight]);
  };
  add(
    day.type === '黄道' ? '黄道日' : '黑道日',
    day.type === '黄道' ? 0.5 : -0.5,
  );
  if (['成', '开', '定'].includes(day.zhiXing)) add(`${day.zhiXing}日`, 0.5);
  else if (['破', '危', '闭'].includes(day.zhiXing))
    add(`${day.zhiXing}日`, -0.5);
  if (day.xiuLuck === '吉') add('星宿吉', 0.25);
  else if (day.xiuLuck === '凶') add('星宿凶', -0.25);
  score = Math.max(0, Math.min(5, score));
  return { score, grade: gradeOf(score), reasons };
}

export type DayRating = TrackRating & {
  tracks: Record<TrackKey, TrackRating>;
  best: TrackKey;
};
/** The day's interview grade, shown on the month grid: the better of phone screen and onsite. */
export function rateDay(day: Rated): DayRating {
  const tracks = Object.fromEntries(
    TRACKS.map((t) => [t.key, rateTrack(day, t)]),
  ) as Record<TrackKey, TrackRating>;
  const best: TrackKey =
    tracks.onsite.score >= tracks.phone.score ? 'onsite' : 'phone';
  return { ...tracks[best], tracks, best };
}

export type Ymd = { y: number; m: number; d: number };
export const addDays = (p: Ymd, n: number): Ymd => {
  const t = new Date(p.y, p.m - 1, p.d + n);
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
};

/** The working days worth booking in the `span` days from `from`: at most `limit`, best first, shown in date order. */
export function bestDays(lib: LunarLib, from: Ymd, span = 30, limit = 6) {
  const days: { day: AlmanacDay; rating: DayRating }[] = [];
  for (let n = 0; n < span; n++) {
    const p = addDays(from, n);
    const day = almanacDay(lib, p.y, p.m, p.d);
    if (day.dayOff) continue;
    const rating = rateDay(day);
    if (rating.score >= 3) days.push({ day, rating });
  }
  // Stable sort: equal scores keep date order, so the earlier day wins a tie.
  const stamp = ({ day }: { day: AlmanacDay }) =>
    day.y * 10000 + day.m * 100 + day.d;
  return days
    .sort((a, b) => b.rating.score - a.rating.score)
    .slice(0, limit)
    .sort((a, b) => stamp(a) - stamp(b));
}

const US_ZONES: [string, string, string][] = [
  ['Pacific', '美西', 'Pacific'],
  ['Mountain', '山地', 'Mountain'],
  ['Central', '中部', 'Central'],
  ['Eastern', '美东', 'Eastern'],
  ['Alaska', '阿拉斯加', 'Alaska'],
  ['Hawaii', '夏威夷', 'Hawaii'],
];
export type Zone = { tz: string; zh: string; en: string };
const PACIFIC: Zone = { tz: 'America/Los_Angeles', zh: '美西', en: 'Pacific' };
/** The reader's own zone when it is a US one, else Pacific time, where most of these interviews are scheduled. */
export function interviewZone(tz: string): Zone {
  try {
    if (!tz.startsWith('America/') && tz !== 'Pacific/Honolulu') return PACIFIC;
    const long =
      new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? '';
    const hit = US_ZONES.find(([name]) => long.includes(name));
    return hit ? { tz, zh: hit[1], en: hit[2] } : PACIFIC;
  } catch {
    return PACIFIC;
  }
}
/** The calendar date in a time zone at `now`. */
export function todayIn(tz: string, now = new Date()): Ymd {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return { y: parts.year, m: parts.month, d: parts.day };
}
