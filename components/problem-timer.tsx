'use client';
import { useEffect, useRef, useState } from 'react';
import { Hourglass, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { MAX_SOLVE_SECONDS, PRESETS } from '@/lib/practice-review';

/**
 * Stored per browser; startedAt is null while paused. The reading at the first AC is sent once to
 * POST oj/problems/<id>/aids (practice_aids.time, lib/server/practice-aids.ts).
 */
type TimerState = {
  mode: 'up' | 'down';
  minutes: number;
  elapsed: number;
  startedAt: number | null;
};
const CHOICES = [5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120];
const storageKey = (userId: string, problemId: string) =>
  `cswork:timer:${userId}:${problemId}`;
const elapsedMs = (s: TimerState, now: number) =>
  s.elapsed + (s.startedAt == null ? 0 : Math.max(0, now - s.startedAt));
const pause = (s: TimerState): TimerState =>
  s.startedAt == null
    ? s
    : { ...s, elapsed: elapsedMs(s, Date.now()), startedAt: null };
const start = (s: TimerState): TimerState =>
  s.startedAt == null ? { ...s, startedAt: Date.now() } : s;
// Other tabs announce writes with 'storage'; same-tab writes (stopTimer) with this.
const CHANGED = 'cswork:timer-changed';

function readTimer(userId: string, problemId: string): TimerState | null {
  try {
    const s = JSON.parse(
      localStorage.getItem(storageKey(userId, problemId)) || 'null',
    );
    if (
      (s?.mode === 'up' || s?.mode === 'down') &&
      Number.isFinite(s.minutes) &&
      s.minutes > 0 &&
      Number.isFinite(s.elapsed) &&
      (s.startedAt === null || Number.isFinite(s.startedAt))
    )
      return s;
  } catch {
    /* Blocked or corrupt storage: start fresh. */
  }
  return null;
}
function writeTimer(userId: string, problemId: string, s: TimerState) {
  try {
    localStorage.setItem(storageKey(userId, problemId), JSON.stringify(s));
  } catch {
    /* The timer still runs for this page. */
  }
}

/** Seconds on this problem's timer, or null when it never ran. */
export function timerSeconds(userId: string, problemId: string) {
  const s = readTimer(userId, problemId);
  const ms = s ? elapsedMs(s, Date.now()) : 0;
  return ms >= 1000 ? Math.floor(ms / 1000) : null;
}

/** An AC ends the attempt: pauses the timer and returns its seconds, or null
 * when it never ran or ran implausibly long. */
export function stopTimer(userId: string, problemId: string) {
  const s = readTimer(userId, problemId);
  if (s?.startedAt != null) {
    writeTimer(userId, problemId, pause(s));
    window.dispatchEvent(new Event(CHANGED));
  }
  const seconds = timerSeconds(userId, problemId);
  return seconds != null && seconds <= MAX_SOLVE_SECONDS ? seconds : null;
}

/** mm:ss, h:mm:ss past an hour, with a minus sign for countdown overtime. */
export function formatClock(seconds: number) {
  const total = Math.abs(Math.trunc(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  return `${seconds < 0 ? '-' : ''}${h ? `${h}:${pad(m)}` : pad(m)}:${pad(total % 60)}`;
}

export function ProblemTimer({
  userId,
  problemId,
  difficulty,
}: {
  userId: string;
  problemId: string;
  difficulty: string;
}) {
  const t = useT();
  const preset = PRESETS[difficulty] ?? 25;
  const fresh = (): TimerState => ({
    mode: 'up',
    minutes: preset,
    elapsed: 0,
    startedAt: null,
  });
  const [state, setState] = useState(fresh);
  const [now, setNow] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  // Storage is browser-only: read it after mount so SSR markup matches, then
  // follow writes from other tabs and stopTimer.
  useEffect(() => {
    const load = () => {
      setState(readTimer(userId, problemId) ?? fresh());
      setNow(Date.now());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey(userId, problemId))
        load();
    };
    load();
    setTimeUp(false);
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGED, load);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGED, load);
    };
  }, [userId, problemId]);
  const running = state.startedAt != null;
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [running]);
  const elapsed = elapsedMs(state, now);
  const remaining = state.minutes * 60_000 - elapsed;
  const countdown = state.mode === 'down';
  // Alert only when the countdown crosses zero here, not again after a reload.
  const lastRemaining = useRef<number | null>(null);
  useEffect(() => {
    const before = lastRemaining.current;
    lastRemaining.current = countdown && running ? remaining : null;
    if (before != null && before > 0 && remaining <= 0) setTimeUp(true);
  }, [countdown, running, remaining]);
  useEffect(() => {
    if (!timeUp) return;
    const hide = setTimeout(() => setTimeUp(false), 8000);
    return () => clearTimeout(hide);
  }, [timeUp]);

  // Builds on the stored state: another tab may have moved it since this render.
  function save(change: (s: TimerState) => TimerState) {
    const next = change(readTimer(userId, problemId) ?? state);
    writeTimer(userId, problemId, next);
    setState(next);
    setNow(Date.now());
  }
  const overdue = countdown && elapsed > 0 && remaining <= 0;
  const idle = !running && elapsed === 0;
  // Countdowns round up, so 25:00 shows until a full second has passed.
  const shown = countdown
    ? Math.ceil(remaining / 1000)
    : Math.floor(elapsed / 1000);
  return (
    <div
      className={`cs-timer ${overdue ? 'is-overdue' : ''}`}
      role="group"
      aria-label={t('做题计时器', 'Problem timer')}
    >
      <button
        className="cs-top-button cs-timer-mode"
        aria-label={
          countdown
            ? t('切换为正计时', 'Switch to stopwatch')
            : t('切换为倒计时', 'Switch to countdown')
        }
        title={
          countdown
            ? t('倒计时 · 点击切换为正计时', 'Countdown · switch to stopwatch')
            : t('正计时 · 点击切换为倒计时', 'Stopwatch · switch to countdown')
        }
        onClick={() =>
          save((s) => ({ ...s, mode: countdown ? 'up' : 'down' }))
        }
      >
        {countdown ? <Hourglass size={15} /> : <Timer size={15} />}
      </button>
      {countdown && idle ? (
        <select
          className="cs-timer-minutes"
          aria-label={t('倒计时时长', 'Countdown length')}
          value={state.minutes}
          onChange={(event) => {
            const minutes = Number(event.target.value);
            save((s) => ({ ...s, minutes }));
          }}
        >
          {[...new Set([...CHOICES, state.minutes])]
            .sort((a, b) => a - b)
            .map((minutes) => (
              <option key={minutes} value={minutes}>
                {t(`${minutes} 分钟`, `${minutes} min`)}
              </option>
            ))}
        </select>
      ) : (
        <span role="timer" className="cs-timer-clock">
          {formatClock(shown)}
        </span>
      )}
      <button
        className="cs-top-button"
        aria-label={
          running
            ? t('暂停计时', 'Pause timer')
            : idle
              ? t('开始计时', 'Start timer')
              : t('继续计时', 'Resume timer')
        }
        title={
          running
            ? t('暂停计时', 'Pause timer')
            : idle
              ? t('开始计时', 'Start timer')
              : t('继续计时', 'Resume timer')
        }
        onClick={() => save(running ? pause : start)}
      >
        {running ? <Pause size={15} /> : <Play size={15} />}
      </button>
      {!idle && (
        <button
          className="cs-top-button cs-timer-reset"
          aria-label={t('重置计时', 'Reset timer')}
          title={t('重置计时', 'Reset timer')}
          onClick={() => {
            setTimeUp(false);
            save((s) => ({ ...s, elapsed: 0, startedAt: null }));
          }}
        >
          <RotateCcw size={14} />
        </button>
      )}
      {/* Present before it fills, so screen readers announce it; never takes focus. */}
      <div className="cs-timer-toast" role="status">
        {timeUp && (
          <p>
            <Hourglass size={15} />
            {t(
              `${state.minutes} 分钟倒计时结束，计时继续。`,
              `Your ${state.minutes}-minute countdown is up. The timer keeps going.`,
            )}
            <button
              aria-label={t('关闭提示', 'Dismiss')}
              onClick={() => setTimeUp(false)}
            >
              <X size={14} />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
