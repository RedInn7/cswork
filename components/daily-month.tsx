'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthDays } from '@/lib/achievements';
import { beijingDate } from '@/lib/daily-problem';
import { api } from '@/lib/types';

const MONTHS_BACK = 11;
/** YYYY-MM, `back` months before `month`. */
const shift = (month: string, back: number) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 7);
};
/** Blanks before the 1st in a Monday-first week. */
const lead = (y: number, m: number) => (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
const monthName = (y: number, m: number) =>
  new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * One Beijing month of daily problems, from the points ledger (GET oj/points/daily) like the
 * month badges: done days ticked, today starred, up to 12 months back. Guests see nothing.
 * Its styles (app/daily-month.css) come with the pages that show it, so server views stay CSS-free.
 */
export function DailyMonth({ english }: { english: boolean }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [days, setDays] = useState<Set<string> | null>(null);
  const [today, setToday] = useState('');
  const [back, setBack] = useState(0);
  useEffect(() => {
    let live = true;
    api<{ days: string[] }>('oj/points/daily').then(
      (r) => {
        if (!live) return;
        setDays(new Set(r.days));
        setToday(beijingDate(Date.now()));
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  if (!days || !today) return null;
  const month = shift(today.slice(0, 7), back);
  const [y, m] = month.split('-').map(Number);
  const total = monthDays(month);
  const dates = Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  const done = dates.filter((d) => days.has(d)).length;
  const title = english ? monthName(y, m) : `${y} 年 ${m} 月`;
  return (
    <section className="daily-month" aria-label={t('每日一题月历', 'Daily problem calendar')}>
      <header className="daily-month-head">
        <button
          type="button"
          onClick={() => setBack(back + 1)}
          disabled={back >= MONTHS_BACK}
          aria-label={t('上个月', 'Previous month')}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
        <h3 aria-live="polite">
          {title}
          <span>{back ? ` · ${done}/${total}` : t(` · 本月 ${done}/${total}`, ` · ${done}/${total} this month`)}</span>
        </h3>
        <button type="button" onClick={() => setBack(back - 1)} disabled={!back} aria-label={t('下个月', 'Next month')}>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </header>
      <ol className="daily-month-grid">
        {(english ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['一', '二', '三', '四', '五', '六', '日']).map((d, i) => (
          <li key={`h${i}`} className="daily-month-weekday" aria-hidden="true">
            {d}
          </li>
        ))}
        {Array.from({ length: lead(y, m) }, (_, i) => (
          <li key={`b${i}`} aria-hidden="true" />
        ))}
        {dates.map((date, i) => {
          const isDone = days.has(date);
          const isToday = date === today;
          return (
            <li key={date} data-done={isDone || undefined} data-today={isToday || undefined}>
              <span aria-hidden="true">{i + 1}</span>
              <span className="sr-only">
                {english ? `${title.split(' ')[0]} ${i + 1}` : `${m} 月 ${i + 1} 日`}
                {isToday && t('，今天', ', today')}
                {isDone ? t('，已完成', ', solved') : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="daily-month-note">
        {t('按北京时间，只记当天做完的；积分功能上线前的日子查不到。', 'Beijing dates, solved on the day; days before points began aren’t recorded.')}
      </p>
    </section>
  );
}
