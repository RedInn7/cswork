'use client';
import { useId, useState } from 'react';
import { parseReviewPrefs, reviewPause, type ReviewPrefs, type scheduleReviews } from '@/lib/practice-review';
import { Button } from './ui/button';
import '@/app/review-load.css';

const NOTE = `/api/oj/notes?target=${encodeURIComponent('pref:review')}`;
const CAPS = [5, 10, 15, 20, 30, 50];
const BREAKS = [3, 7, 14, 30];
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');
const dateOf = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const utc = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

/**
 * My progress → Due for review, on top: the next 30 days of problem reviews (lib/practice-review.ts
 * scheduleReviews), today's held back by the daily cap, the share of graded reviews that went
 * Good or Easy (from 5 grades), and the load settings, saved as the private note `pref:review`.
 */
export function ReviewForecast({
  schedule,
  prefs,
  now,
  english,
  onChange,
}: {
  schedule: ReturnType<typeof scheduleReviews>;
  prefs: ReviewPrefs;
  now: number;
  english: boolean;
  onChange: (prefs: ReviewPrefs) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const id = useId();
  const [length, setLength] = useState(7);
  const [state, setState] = useState<'' | 'saving' | 'failed'>('');
  const { forecast, deferred, retention } = schedule;
  const top = Math.max(1, ...forecast);
  const today = dateOf(now);
  const pause = reviewPause(prefs);
  const paused = !!pause && pause.from <= today && today <= pause.to;
  const label = (i: number) => {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + i).toLocaleDateString(english ? 'en-US' : 'zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  async function save(next: ReviewPrefs) {
    setState('saving');
    const text = JSON.stringify(next);
    try {
      const response = await fetch(NOTE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Nothing set removes the note (lib/server/my-practice.ts).
        body: JSON.stringify({ body: text === '{}' ? '' : text }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setState('');
      onChange(parseReviewPrefs(text));
    } catch {
      setState('failed');
    }
  }
  // Ended early: the break keeps the days actually taken, so their push-back stays.
  const taken = pause ? Math.round((utc(today) - utc(pause.from)) / DAY) : 0;

  return (
    <section className="review-forecast" aria-labelledby={id}>
      <h2 id={id}>{t('未来 30 天的复习量', 'Reviews over the next 30 days')}</h2>
      <p className="review-forecast-summary">
        {paused
          ? t(`休假中，${pause?.to} 之后恢复复习。`, `On a break: reviews resume after ${pause?.to}.`)
          : t(`今天 ${forecast[0]} 道`, `${forecast[0]} today`)}
        {deferred > 0 && t(` · 今日顺延 ${deferred} 道`, ` · ${deferred} held over from today`)}
        {retention.total >= 5 &&
          t(
            ` · 近 30 天 ${retention.total} 次自评中，良好及以上占 ${Math.round((100 * retention.passed) / retention.total)}%`,
            ` · ${Math.round((100 * retention.passed) / retention.total)}% of ${retention.total} graded reviews in 30 days went Good or Easy`,
          )}
      </p>
      <ol className="review-forecast-bars" aria-hidden="true">
        {forecast.map((n, i) => (
          <li key={i} data-today={i === 0 || undefined} title={`${label(i)}: ${n}`}>
            <span style={{ height: `${(100 * n) / top}%` }} />
          </li>
        ))}
      </ol>
      <div className="review-forecast-axis" aria-hidden="true">
        <span>{t('今天', 'Today')}</span>
        <span>{label(29)}</span>
      </div>
      <ul className="sr-only">
        {forecast.map((n, i) => (
          <li key={i}>{t(`${label(i)}：${n} 道`, `${label(i)}: ${n}`)}</li>
        ))}
      </ul>
      <div className="review-forecast-settings">
        <label>
          {t('每天最多复习', 'Daily cap')}
          <select
            value={prefs.dailyCap ?? ''}
            disabled={state === 'saving'}
            onChange={(event) => void save({ ...prefs, dailyCap: Number(event.target.value) || undefined })}
          >
            <option value="">{t('不限', 'No cap')}</option>
            {[...new Set([...CAPS, ...(prefs.dailyCap ? [prefs.dailyCap] : [])])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {t(`${n} 道`, String(n))}
                </option>
              ))}
          </select>
        </label>
        {paused ? (
          <Button
            variant="outline"
            size="sm"
            disabled={state === 'saving'}
            onClick={() =>
              void save({ ...prefs, pausedFrom: taken ? prefs.pausedFrom : undefined, pausedDays: taken || undefined })
            }
          >
            {t('提前结束休假', 'End the break now')}
          </Button>
        ) : (
          <span className="review-forecast-break">
            <label>
              {t('休假', 'Take a break for')}
              <select value={length} onChange={(event) => setLength(Number(event.target.value))}>
                {BREAKS.map((n) => (
                  <option key={n} value={n}>
                    {t(`${n} 天`, `${n} days`)}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={state === 'saving'}
              onClick={() => void save({ ...prefs, pausedFrom: today, pausedDays: length })}
            >
              {t('从今天开始', 'Start today')}
            </Button>
          </span>
        )}
      </div>
      <p className="review-forecast-note" aria-live="polite">
        {state === 'failed'
          ? t('没能保存设置，请重试。', "Couldn't save the settings. Try again.")
          : t(
              '今天已做完的复习也算在上限里，超过上限的题按到期先后顺延到下一天。休假期间不安排复习，原本落在休假里及之后的复习整体往后推；只记一段休假，新开一段会替换上一段。',
              'Reviews already done today count toward the cap. Past it, the most overdue go first and the rest move to the next day. A break schedules nothing and pushes later reviews back by its length; only one break is kept, and a new one replaces it.',
            )}
      </p>
    </section>
  );
}
