'use client';
import { useEffect, useRef, useState } from 'react';
import { Hourglass, Pause, Play, RotateCcw, Timer, X } from 'lucide-react';
import { useT } from '@/lib/i18n';

/** Stored per browser; startedAt is null while paused. Never synced to the server. */
type TimerState = {
  mode: 'up' | 'down';
  minutes: number;
  elapsed: number;
  startedAt: number | null;
};
const PRESETS: Record<string, number> = { 简单: 15, 中等: 25, 困难: 40 };
const CHOICES = [5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120];
const storageKey = (userId: string, problemId: string) =>
  `cswork:timer:${userId}:${problemId}`;
const elapsedMs = (s: TimerState, now: number) =>
  s.elapsed + (s.startedAt == null ? 0 : Math.max(0, now - s.startedAt));

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

/** Seconds on this problem's timer, or null when it never ran. */
export function timerSeconds(userId: string, problemId: string) {
  const s = readTimer(userId, problemId);
  const ms = s ? elapsedMs(s, Date.now()) : 0;
  return ms >= 1000 ? Math.floor(ms / 1000) : null;
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
  // Storage is browser-only: read it after mount so SSR markup matches.
  useEffect(() => {
    setState(readTimer(userId, problemId) ?? fresh());
    setNow(Date.now());
    setTimeUp(false);
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

  function save(next: TimerState) {
    const at = Date.now();
    setState(next);
    setNow(at);
    try {
      localStorage.setItem(
        storageKey(userId, problemId),
        JSON.stringify(next),
      );
    } catch {
      /* The timer still runs for this page. */
    }
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
        onClick={() => save({ ...state, mode: countdown ? 'up' : 'down' })}
      >
        {countdown ? <Hourglass size={15} /> : <Timer size={15} />}
      </button>
      {countdown && idle ? (
        <select
          className="cs-timer-minutes"
          aria-label={t('倒计时时长', 'Countdown length')}
          value={state.minutes}
          onChange={(event) =>
            save({ ...state, minutes: Number(event.target.value) })
          }
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
        onClick={() =>
          save(
            running
              ? {
                  ...state,
                  elapsed: elapsedMs(state, Date.now()),
                  startedAt: null,
                }
              : { ...state, startedAt: Date.now() },
          )
        }
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
            save({ ...state, elapsed: 0, startedAt: null });
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
