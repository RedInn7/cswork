'use client';
import { useEffect, useState } from 'react';
import {
  almanacDay,
  AS_JI,
  AS_YI,
  bestDays,
  GRADE_TEXT,
  interviewZone,
  rateDay,
  todayIn,
  TRACKS,
  type AlmanacDay,
  type DayRating,
  type Grade,
  type Ymd,
  type Zone,
} from '@/lib/interview-almanac';

type Lunar = typeof import('lunar-typescript');
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
// The seal stamp: 大吉 is a filled 吉.
const seal = (grade: Grade) => (grade === '大吉' ? '吉' : grade);
const same = (a: Ymd, b: Ymd) => a.y === b.y && a.m === b.m && a.d === b.d;
const signed = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v)}`;

function Seal({ grade }: { grade: Grade }) {
  return (
    <span className="almanac-seal" data-grade={grade} aria-hidden="true">
      {seal(grade)}
    </span>
  );
}

/**
 * /almanac: a month of the Chinese almanac read for interviews, and one tear-off sheet for the
 * chosen day. The lunar calendar (about 440 KB) loads after the page; nothing is stored or sent.
 */
export function InterviewAlmanac({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [lunar, setLunar] = useState<Lunar | null>(null);
  const [failed, setFailed] = useState(false);
  // Read after mount: the reader's time zone and date differ from the server's.
  const [zone, setZone] = useState<Zone | null>(null);
  const [today, setToday] = useState<Ymd | null>(null);
  const [view, setView] = useState<{ y: number; m: number } | null>(null);
  const [picked, setPicked] = useState<Ymd | null>(null);
  const goToday = () => {
    const z = interviewZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const now = todayIn(z.tz);
    setZone(z);
    setToday(now);
    setPicked(now);
    setView({ y: now.y, m: now.m });
  };
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- The reader's date exists only in the browser.
    goToday();
    let live = true;
    import('lunar-typescript').then(
      (lib) => live && setLunar(lib),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Once, on mount.
  }, []);

  if (failed)
    return (
      <p className="almanac-status" role="alert">
        {t(
          '黄历数据没能加载。检查网络后刷新页面再试。',
          'The almanac did not load. Check your connection and refresh the page.',
        )}
      </p>
    );
  if (!lunar || !zone || !today || !view || !picked)
    return (
      <p className="almanac-status" aria-live="polite">
        {t('正在翻黄历…', 'Opening the almanac…')}
      </p>
    );

  const zoneName = zh ? zone.zh : zone.en;
  const day = (p: Ymd) => almanacDay(lunar, p.y, p.m, p.d);
  const dateText = (p: Ymd, week: number) =>
    zh
      ? `${p.m}月${p.d}日 周${WEEK_ZH[week]}`
      : `${WEEK_EN[week]}, ${MONTHS_EN[p.m - 1].slice(0, 3)} ${p.d}`;
  const lunarText = (d: AlmanacDay) =>
    zh
      ? `农历${d.lunarMonth}月${d.lunarDay}`
      : `Lunar ${d.lunarNum[0]}/${d.lunarNum[1]}`;
  const holidayName = (d: AlmanacDay) =>
    d.holiday ? (zh ? d.holiday.zh : d.holiday.en) : '';
  // A cell's second line: a holiday or (in Chinese) a solar term or festival, else the lunar day.
  const cellNote = (d: AlmanacDay) =>
    holidayName(d) ||
    (zh
      ? d.jieqi ||
        d.festivals[0] ||
        (d.lunarDay === '初一' ? `${d.lunarMonth}月` : d.lunarDay)
      : `${d.lunarNum[0]}/${d.lunarNum[1]}`);
  const grade = (g: Grade) => GRADE_TEXT[g][zh ? 0 : 1];
  // The kinds worth booking that day, best first: "Onsite 最宜", "谈 Offer 宜".
  const goodFor = (r: DayRating) =>
    TRACKS.filter((track) => r.tracks[track.key].score >= 3)
      .sort((a, b) => r.tracks[b.key].score - r.tracks[a.key].score)
      .map(
        (track) =>
          `${zh ? track.zh : track.en} ${grade(r.tracks[track.key].grade)}`,
      );
  const stamp = (p: Ymd) => p.y * 10000 + p.m * 100 + p.d;
  const pick = (p: Ymd) => {
    setPicked(p);
    setView({ y: p.y, m: p.m });
  };
  const shift = (by: number) => {
    const next = new Date(view.y, view.m - 1 + by, 1);
    setView({ y: next.getFullYear(), m: next.getMonth() + 1 });
  };

  const best = bestDays(lunar, today);
  const first = new Date(view.y, view.m - 1, 1).getDay();
  const lead = (first + 6) % 7; // Monday first
  const count = new Date(view.y, view.m, 0).getDate();
  const tail = (7 - ((lead + count) % 7)) % 7;
  const monthLabel = zh
    ? `${view.y} 年 ${view.m} 月`
    : `${MONTHS_EN[view.m - 1]} ${view.y}`;
  const sheet = day(picked);
  const rating = rateDay(sheet);
  const readings = (items: string[], map: Record<string, [string, string]>) => [
    ...new Set(
      items.flatMap((item) => (map[item] ? [map[item][zh ? 0 : 1]] : [])),
    ),
  ];
  const yi = readings(sheet.yi, AS_YI);
  const ji = readings(sheet.ji, AS_JI);
  const marks = [
    holidayName(sheet),
    ...(zh ? [sheet.jieqi, ...sheet.festivals] : []),
  ]
    .filter(Boolean)
    .join(' · ');
  const off =
    sheet.holiday && !sheet.holiday.worked
      ? t(
          `${sheet.holiday.zh}，公司一般放假`,
          `${sheet.holiday.en}: most companies are closed`,
        )
      : sheet.dayOff
        ? t('周末一般不排面试', 'Interviews are rarely scheduled on weekends')
        : '';

  return (
    <div className="almanac">
      <p className="almanac-now">
        {t(
          `${zoneName} ${today.m}月${today.d}日 · ${lunarText(day(today))}`,
          `${zoneName} time · ${dateText(today, day(today).week)} · ${lunarText(day(today))}`,
        )}
      </p>

      <section className="almanac-best" aria-labelledby="almanac-best-title">
        <h2 id="almanac-best-title">
          {t('未来 30 天最宜面试', 'Best interview days in the next 30')}
        </h2>
        {best.length ? (
          <ol>
            {best.map(({ day: d, rating: r }) => (
              <li key={`${d.y}-${d.m}-${d.d}`}>
                <button type="button" onClick={() => pick(d)}>
                  <Seal grade={r.grade} />
                  <span className="almanac-when">{dateText(d, d.week)}</span>
                  <span className="almanac-why">
                    {goodFor(r).map((text) => (
                      <span key={text}>{text}</span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="almanac-empty">
            {t(
              '这 30 天没有特别好的日子，照常面。',
              'No standout days in the next 30. Interview as usual.',
            )}
          </p>
        )}
      </section>

      <div className="almanac-main">
        <section aria-label={monthLabel}>
          <div className="almanac-nav">
            <button
              type="button"
              onClick={() => shift(-1)}
              aria-label={t('上个月', 'Previous month')}
            >
              ‹
            </button>
            <span className="almanac-month" aria-live="polite">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              aria-label={t('下个月', 'Next month')}
            >
              ›
            </button>
            <button type="button" className="almanac-today" onClick={goToday}>
              {t('今天', 'Today')}
            </button>
          </div>
          <div className="almanac-cal">
            {[1, 2, 3, 4, 5, 6, 0].map((w) => (
              <div className="almanac-dow" key={w} aria-hidden="true">
                {zh ? WEEK_ZH[w] : WEEK_EN[w]}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <div
                className="almanac-pad"
                key={`lead-${i}`}
                aria-hidden="true"
              />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const p = { y: view.y, m: view.m, d: i + 1 };
              const d = day(p);
              const r = rateDay(d);
              const marked =
                !!d.holiday || (zh && (!!d.jieqi || d.festivals.length > 0));
              return (
                <button
                  type="button"
                  key={p.d}
                  className="almanac-cell"
                  data-off={d.dayOff || undefined}
                  data-today={same(p, today) || undefined}
                  data-past={stamp(p) < stamp(today) || undefined}
                  aria-pressed={same(p, picked)}
                  aria-label={`${dateText(p, d.week)}, ${lunarText(d)}, ${grade(r.grade)}`}
                  onClick={() => pick(p)}
                >
                  <span className="almanac-num">{p.d}</span>
                  <Seal grade={r.grade} />
                  <span
                    className="almanac-lunar"
                    data-mark={marked || undefined}
                  >
                    {cellNote(d)}
                  </span>
                </button>
              );
            })}
            {Array.from({ length: tail }, (_, i) => (
              <div
                className="almanac-pad"
                key={`tail-${i}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <ul className="almanac-legend">
            {(['大吉', '吉', '平', '慎'] as Grade[]).map((g) => (
              <li key={g}>
                <Seal grade={g} />
                {grade(g)}
              </li>
            ))}
          </ul>
        </section>

        <article
          className="almanac-sheet"
          aria-live="polite"
          key={`${picked.y}-${picked.m}-${picked.d}`}
        >
          <header>
            <div className="almanac-big">{sheet.d}</div>
            <div>
              <strong>
                {zh
                  ? `${sheet.m} 月 · 星期${WEEK_ZH[sheet.week]}`
                  : `${MONTHS_EN[sheet.m - 1]} · ${WEEK_EN[sheet.week]}`}
              </strong>
              <span>
                {lunarText(sheet)}
                {marks && <em> · {marks}</em>}
              </span>
              {off && <small>{off}</small>}
            </div>
          </header>
          <ul className="almanac-tracks">
            {TRACKS.map((track) => (
              <li key={track.key}>
                <Seal grade={rating.tracks[track.key].grade} />
                <strong>{zh ? track.zh : track.en}</strong>
                <span>{grade(rating.tracks[track.key].grade)}</span>
              </li>
            ))}
          </ul>
          <div className="almanac-yiji">
            <div data-side="yi">
              <span className="almanac-glyph" aria-hidden="true">
                宜
              </span>
              <ul aria-label={t('宜', 'Good for')}>
                {yi.length ? (
                  yi.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li data-plain>{t('照常准备', 'Prepare as usual')}</li>
                )}
              </ul>
            </div>
            <div data-side="ji">
              <span className="almanac-glyph" aria-hidden="true">
                忌
              </span>
              <ul aria-label={t('忌', 'Avoid')}>
                {ji.length ? (
                  ji.map((item) => <li key={item}>{item}</li>)
                ) : (
                  <li data-plain>{t('无', 'Nothing')}</li>
                )}
              </ul>
            </div>
          </div>
          <dl className="almanac-facts">
            <dt>{t('好时段', 'Good hours')}</dt>
            <dd>
              {sheet.times.length
                ? sheet.times.join(zh ? '、' : ', ')
                : t('无', 'None')}
              {t(`（${zoneName}时间）`, ` (${zoneName} time)`)}
            </dd>
          </dl>
          <details className="almanac-source">
            <summary>{t('黄历原文与打分', 'Almanac text and scoring')}</summary>
            <dl className="almanac-facts" lang="zh-CN">
              <dt>宜</dt>
              <dd>{sheet.yi.join(' ')}</dd>
              <dt>忌</dt>
              <dd>{sheet.ji.join(' ')}</dd>
              <dt>值神</dt>
              <dd>
                {sheet.tianShen}（{sheet.type}日）· {sheet.zhiXing}日 · 冲
                {sheet.chong}
              </dd>
            </dl>
            <table>
              <tbody>
                {TRACKS.map((track) => {
                  const r = rating.tracks[track.key];
                  return (
                    <tr key={track.key}>
                      <td>
                        <strong>{zh ? track.zh : track.en}</strong>{' '}
                        <span lang="zh-CN">
                          {[
                            '2',
                            ...r.reasons.map(
                              ([label, weight]) => `${label} ${signed(weight)}`,
                            ),
                          ].join('，')}
                        </span>
                      </td>
                      <td>
                        <strong>{r.score}</strong> / 5
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </article>
      </div>
    </div>
  );
}
