'use client';
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { buttonVariants } from './ui/button';
import { useT } from '@/lib/i18n';
import { formatClock } from '@/lib/mock-oa';
import { api } from '@/lib/types';
import type { RoomView } from '@/lib/server/contests';
import '@/app/mock-oa.css';

type Navigate = (view: string, extra?: Record<string, string>) => void;
type Submissions = { problem_id: string; status: string; created_at: number }[];
export type ContestState = { view: RoomView; skew: number; running: boolean };

/**
 * ?room=<id>: the contest this problem belongs to, for a reader who entered it; null otherwise.
 * `running` is the reader's own window (a virtual run has its own), flipped on time.
 */
export function useContestRoom(room: string | undefined, problemId: string): ContestState | null {
  const [loaded, setLoaded] = useState<{ view: RoomView; skew: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!room) return;
    let current = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      const sent = Date.now();
      api<RoomView>(`oj/contests/${encodeURIComponent(room)}`)
        .then((view) => {
          if (!current) return;
          setLoaded({ view, skew: view.now - (sent + Date.now()) / 2 });
          setNow(Date.now());
        })
        .catch(() => {});
    };
    load();
    document.addEventListener('visibilitychange', load);
    return () => {
      current = false;
      document.removeEventListener('visibilitychange', load);
    };
  }, [room]);
  const me = loaded?.view.me;
  const skew = loaded?.skew ?? 0;
  useEffect(() => {
    if (!me) return;
    const at = now + skew;
    const next = [me.start, me.end].find((edge) => edge > at);
    if (next === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2 ** 31 - 1, next - at + 50));
    return () => clearTimeout(timer);
  }, [me, now, skew]);
  if (!loaded || !me || !loaded.view.problems?.some((p) => p.id === problemId)) return null;
  return { ...loaded, running: now + skew >= me.start && now + skew < me.end };
}

/** The contest's strip above the workspace: questions as stops, the clock, the scoreboard link. */
export function ContestBar({
  contest,
  problemId,
  submissions,
  navigate,
}: {
  contest: ContestState;
  problemId: string;
  submissions: Submissions;
  navigate: Navigate;
}) {
  const t = useT();
  const { view, skew, running } = contest;
  const me = view.me!;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  const remaining = Math.max(0, me.end - (now + skew));
  const warn = remaining <= 5 * 60000 ? 5 : remaining <= 10 * 60000 ? 10 : 0;
  const problems = view.problems ?? [];
  const states = problems.map(({ id }) => {
    const mine = submissions.filter(
      (s) => s.problem_id === id && s.created_at >= me.start && s.created_at <= me.end && s.status !== 'cancelled',
    );
    return mine.some((s) => s.status === 'accepted') ? 'ac' : mine.length ? 'tried' : 'todo';
  });
  const title = view.week ? t(`CSWork 周赛 第 ${view.week} 期`, `CSWork Weekly #${view.week}`) : view.title;
  return (
    <div
      className="mock-exam-bar"
      data-warn={(running && warn) || undefined}
      data-done={!running || undefined}
      role="region"
      aria-label={t('比赛', 'Contest')}
    >
      <div className="mock-exam-id">
        <span className="mock-exam-kicker">
          {view.kind === 'weekly' ? 'WEEKLY' : view.kind === 'duel' ? 'DUEL' : 'CONTEST'}
          {me.virtual ? ' · VIRTUAL' : ''}
        </span>
        <strong>{running ? title : t('本场已结束，题解已解锁', 'Contest over. Solutions are unlocked')}</strong>
      </div>
      {running && (
        <nav className="mock-exam-stops" aria-label={t('比赛题目', 'Contest questions')}>
          <ol>
            {problems.map(({ id }, index) => (
              <li key={id} data-state={states[index]}>
                <button
                  type="button"
                  aria-current={id === problemId ? 'step' : undefined}
                  aria-label={`Q${index + 1}, ${
                    states[index] === 'ac' ? t('已通过', 'accepted') : states[index] === 'tried' ? t('已提交', 'attempted') : t('未作答', 'not started')
                  }`}
                  onClick={() => id !== problemId && navigate('problem', { problem: id, room: view.id })}
                >
                  <i aria-hidden="true" />Q{index + 1}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {running && (
        <div className="mock-exam-clock" style={{ '--left': remaining / (view.durationMin * 60000) } as React.CSSProperties}>
          <span role="timer" aria-label={t('剩余时间', 'Time left')}>
            {formatClock(remaining)}
          </span>
          <output aria-live="polite" className="mock-exam-alert">
            {warn ? t(`最后 ${warn} 分钟`, `Last ${warn} min`) : ''}
          </output>
        </div>
      )}
      <a className={buttonVariants({ className: 'mock-exam-finish' })} href={`/contest/${encodeURIComponent(view.id)}`}>
        {t('计分板', 'Scoreboard')}
        <ChevronRight size={15} />
      </a>
    </div>
  );
}
