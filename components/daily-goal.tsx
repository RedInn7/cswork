'use client';

import '@/app/daily-goal.css';
import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import { Check, Flame, Snowflake } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import { readMockState } from '@/lib/mock-oa';
import { coveredNoons, QUESTS, type CoveredDay, type StudyKind } from '@/lib/study-goal';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from './ui/popover';

type Day = { date: string; xp: number; ac: number; frozen: boolean; covered: 'goal' | 'rest' | null };
type Pref = { goalXp: number; restWeekdays: number[] };
/** GET oj/study-goal (lib/server/study-goal.ts). */
export type StudyGoal = Pref & {
  user: string;
  streak: number;
  freezesLeft: number;
  rescue: boolean;
  todayXp: number;
  today: string;
  week: Day[];
  covered: CoveredDay[];
  quests: { kind: StudyKind; need: number; have: number }[];
};

// One request for the top bar and the calendars of a page, and again at most once a minute when
// the window gets focus. Signed out (401) or paused by a running contest or skill test: null.
// ponytail: a solve shows up on the next focus after the minute, not the moment it is accepted.
const TTL = 60_000;
let cached: StudyGoal | null = null;
let fetchedAt = -Infinity;
let latest = 0;
let busy = false;
const listeners = new Set<() => void>();
function publish(next: StudyGoal | null) {
  cached = next;
  for (const listener of listeners) listener();
}
function load(force = false) {
  if (!force && (busy || Date.now() - fetchedAt < TTL)) return;
  const mine = ++latest;
  busy = true;
  // Not api(): its 401 opens the sign-in dialog, and a guest only has nothing to show here.
  void fetch(`/api/oj/study-goal?tz=${new Date().getTimezoneOffset()}`)
    .then(async (r) => (r.ok ? ((await r.json()) as StudyGoal | { paused: true }) : r.status === 401 ? null : cached))
    .catch(() => cached)
    .then((next) => {
      if (mine !== latest) return;
      busy = false;
      fetchedAt = Date.now();
      publish(next && 'user' in next ? next : null);
    });
}
const onFocus = () => load();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('focus', onFocus);
  load();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('focus', onFocus);
  };
}
/** The learner's study goal, or null while loading, signed out or paused. */
export const useStudyGoal = () => useSyncExternalStore(subscribe, () => cached, () => null);
/** The days a streak survives without an AC, as usePracticeStats takes them. */
export function useCoveredDays() {
  const goal = useStudyGoal();
  return useMemo(() => (goal ? coveredNoons(goal.covered) : undefined), [goal]);
}

const TIERS = [10, 20, 30, 50];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const SHORT_ZH = '日一二三四五六';
const SHORT_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const LONG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const R = 7;
const AROUND = 2 * Math.PI * R;
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * The top bar's streak and today's XP ring; it opens the last 7 days, the freezes left, today's
 * 3 quests and the goal settings (the private note pref:study). Shows nothing to guests, during
 * a contest or skill test, or while a mock OA runs in this browser (its verdicts are sealed, and
 * the XP of an AC would give one away).
 */
export function DailyGoal() {
  const goal = useStudyGoal();
  const zh = useLocale() === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  const id = useId();
  const [state, setState] = useState<'' | 'saving' | 'failed'>('');
  if (!goal || readMockState(goal.user).active) return null;
  const { streak, todayXp, goalXp, restWeekdays } = goal;
  const met = todayXp >= goalXp;
  const today = goal.week[6];
  const short = (day: number) => (zh ? SHORT_ZH[day] : SHORT_EN[day]);

  async function save(next: Pref) {
    setState('saving');
    try {
      const response = await fetch(`/api/oj/notes?target=${encodeURIComponent('pref:study')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: JSON.stringify(next) }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setState('');
      if (cached) publish({ ...cached, ...next });
      load(true);
    } catch {
      setState('failed');
    }
  }
  const dayText = (d: Day) =>
    d.ac
      ? t(`通过 ${d.ac} 题`, `${d.ac} solved`)
      : d.covered === 'goal'
        ? t('经验达标', 'XP goal met')
        : d.covered === 'rest'
          ? t('休息日', 'Rest day')
          : d.frozen
            ? t('用了一次保护', 'Streak freeze used')
            : d === today
              ? t('还没打卡', 'Not yet')
              : t('没有打卡', 'Missed');

  return (
    <Popover>
      <PopoverTrigger
        className="daily-goal"
        data-met={met || undefined}
        aria-label={t(
          `连续 ${streak} 天，今日经验 ${todayXp}/${goalXp}`,
          `${streak}-day streak, ${todayXp} of ${goalXp} XP today`,
        )}
      >
        <Flame size={16} aria-hidden="true" data-lit={today.ac > 0 || !!today.covered || undefined} />
        <span>{streak}</span>
        <svg className="daily-goal-ring" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="9" r={R} />
          <circle cx="9" cy="9" r={R} strokeDasharray={`${Math.min(1, todayXp / goalXp) * AROUND} ${AROUND}`} />
        </svg>
      </PopoverTrigger>
      <PopoverContent align="end" className="daily-goal-pop">
        <PopoverTitle className="daily-goal-title">{t('今日学习目标', 'Today’s study goal')}</PopoverTitle>
        <p className="daily-goal-xp">
          <strong>{todayXp}</strong> / {goalXp} {t('经验', 'XP')}
          <span data-met={met || undefined}>
            {met ? t('已达标', 'Goal met') : t(`还差 ${goalXp - todayXp}`, `${goalXp - todayXp} to go`)}
          </span>
        </p>
        <ol className="daily-goal-week" aria-label={t('最近 7 天', 'The last 7 days')}>
          {goal.week.map((d) => (
            <li
              key={d.date}
              data-state={d.ac ? 'ac' : (d.covered ?? (d.frozen ? 'frozen' : undefined))}
              data-today={d === today || undefined}
              title={`${d.date} · ${dayText(d)} · ${d.xp} ${t('经验', 'XP')}`}
            >
              <span aria-hidden="true">{short(weekday(d.date))}</span>
              <i aria-hidden="true" />
              <span className="sr-only">{`${d.date}: ${dayText(d)}, ${d.xp} ${t('经验', 'XP')}`}</span>
            </li>
          ))}
        </ol>
        <p className="daily-goal-line">
          {t(`连续 ${streak} 天`, `${streak}-day streak`)}
          <span>
            <Snowflake size={12} aria-hidden="true" />
            {t(
              `本月还剩 ${goal.freezesLeft} 次断签保护`,
              `${goal.freezesLeft} ${goal.freezesLeft === 1 ? 'freeze' : 'freezes'} left this month`,
            )}
          </span>
        </p>
        {goal.rescue && (
          <p className="daily-goal-note">
            {t(
              '昨天断了一天：今天通过一题或经验达标，会自动用一次保护接上。',
              'You missed yesterday: solve one or meet today’s goal and a freeze bridges it.',
            )}
          </p>
        )}
        <h3 id={`${id}-quests`}>{t('今日任务', 'Today’s quests')}</h3>
        <ul className="daily-goal-quests" aria-labelledby={`${id}-quests`}>
          {goal.quests.map((q) => {
            const done = q.have >= q.need;
            return (
              <li key={q.kind} data-done={done || undefined}>
                <span className="daily-goal-check" aria-hidden="true">
                  {done && <Check size={11} strokeWidth={3} />}
                </span>
                <a href={QUESTS[q.kind].href}>{t(QUESTS[q.kind].zh, QUESTS[q.kind].en)}</a>
                <span className="daily-goal-count">
                  {done ? <span className="sr-only">{t('已完成', 'Done')}</span> : null}
                  {q.have}/{q.need}
                </span>
              </li>
            );
          })}
        </ul>
        <fieldset className="daily-goal-choices" disabled={state === 'saving'}>
          <legend>{t('每日目标（经验）', 'Daily goal (XP)')}</legend>
          {TIERS.map((n) => (
            <button key={n} type="button" aria-pressed={goalXp === n} onClick={() => void save({ goalXp: n, restWeekdays })}>
              {n}
            </button>
          ))}
        </fieldset>
        <fieldset className="daily-goal-choices" disabled={state === 'saving'}>
          <legend>{t('休息日（最多 2 天，连续天数不断）', 'Rest days (up to 2; the streak holds)')}</legend>
          {WEEK.map((day) => {
            const on = restWeekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                aria-label={zh ? `周${SHORT_ZH[day]}` : LONG_EN[day]}
                disabled={!on && restWeekdays.length >= 2}
                onClick={() =>
                  void save({
                    goalXp,
                    restWeekdays: on ? restWeekdays.filter((d) => d !== day) : [...restWeekdays, day].sort((a, b) => a - b),
                  })
                }
              >
                {short(day)}
              </button>
            );
          })}
        </fieldset>
        {state === 'failed' && (
          <p className="daily-goal-note" role="alert">
            {t('没有保存，请重试。', 'Not saved. Please try again.')}
          </p>
        )}
        <details className="daily-goal-note">
          <summary>{t('经验怎么算', 'How XP works')}</summary>
          {t(
            '每通过一道题 10，做完一场模拟 OA 15，读完一章系统设计 10，学完一个英语单元 5，写或改一条 STAR 故事 5，跑一次对拍或复杂度测试 5，答一道新选择题（验证邮箱后）或自评一张复习卡 1；每项每天有上限。经验达标的日子和休息日都能接上连续天数，但只有通过题目的日子计入天数。任务只打勾，不发积分。',
            'Each problem solved earns 10, a finished mock OA 15, a system design chapter read 10, an interview English unit 5, a STAR story written or edited 5, a stress test or complexity probe 5, and a new multiple-choice answer (with a verified email) or self-graded review card 1, each up to a daily cap. A day you meet your goal and a rest day both keep your streak going, but only days with a solve add to it. Quests are ticks only: they pay no points.',
          )}
        </details>
      </PopoverContent>
    </Popover>
  );
}
