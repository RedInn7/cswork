'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Flag, X } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { useT } from '@/lib/i18n';
import {
  archiveMock,
  findMock,
  finishMock,
  formatClock,
  mockClock,
  mockExamFor,
  questionStates,
  readMockState,
  watchMockState,
  writeMockState,
  type MockSession,
} from '@/lib/mock-oa';
import '@/app/mock-oa.css';

type Navigate = (view: string, extra?: Record<string, string>) => void;
type Submissions = { problem_id: string; status: string; created_at: number }[];

/**
 * The mock this problem belongs to (?mock=<id>, or the running one that holds it);
 * running only before its deadline. Follows hand-ins and new draws from other tabs.
 */
export function useMockExam(
  mock: string | undefined,
  userId: string,
  problemId: string,
) {
  // Client-only: the workspace never renders on the server.
  const [exam, setExam] = useState(() =>
    mockExamFor(readMockState(userId), mock, problemId, Date.now()),
  );
  useEffect(() => {
    const sync = () =>
      setExam(mockExamFor(readMockState(userId), mock, problemId, Date.now()));
    // A hidden tab may have missed a write; it re-reads when shown again.
    document.addEventListener('visibilitychange', sync);
    const unwatch = watchMockState(userId, sync);
    return () => {
      unwatch();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [mock, userId, problemId]);
  return exam;
}

/** Stops the clock, keeps the result in this browser and opens the report. */
export function finishMockExam(
  userId: string,
  id: string,
  navigate: Navigate,
  reason: MockSession['reason'] = 'manual',
) {
  const state = readMockState(userId),
    session = findMock(state, id);
  if (session)
    writeMockState(
      userId,
      archiveMock(state, finishMock(session, Date.now(), reason)),
    );
  navigate('mock', { report: id });
}

const stateLabel = {
  todo: ['未作答', 'not started'],
  tried: ['已提交', 'attempted'],
  ac: ['已通过', 'accepted'],
} as const;

/**
 * The proctor's strip above the workspace: questions as stops, the countdown and
 * the finish button. Warnings at 10 and 5 minutes; at zero the exam hands itself in.
 */
export function MockExamBar({
  session,
  userId,
  problemId,
  submissions,
  navigate,
}: {
  session: MockSession;
  userId: string;
  problemId: string;
  submissions: Submissions;
  navigate: Navigate;
}) {
  const t = useT();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const clock = mockClock(session, now);
  const finished = clock.phase === 'finished';
  const handedIn = useRef(false);
  useEffect(() => {
    if (!finished || handedIn.current) return;
    handedIn.current = true;
    finishMockExam(userId, session.id, navigate, 'timeout');
  }, [finished, userId, session.id, navigate]);
  const [confirm, setConfirm] = useState(false);
  const states = questionStates(session, submissions);
  const solved = states.filter((s) => s === 'ac').length;
  const left = clock.remaining / (session.minutes * 60000);
  return (
    <div
      className="mock-exam-bar"
      data-warn={clock.warning || undefined}
      role="region"
      aria-label={t('模拟考试', 'Mock exam')}
    >
      <div className="mock-exam-id">
        <span className="mock-exam-kicker">MOCK OA</span>
        <strong>{session.name || t('自定义模拟', 'Custom mock')}</strong>
        {session.platform && <small>{session.platform}</small>}
      </div>
      <nav className="mock-exam-stops" aria-label={t('考试题目', 'Exam questions')}>
        <ol>
          {session.ids.map((id, index) => {
            const label = stateLabel[states[index]];
            return (
              <li key={id} data-state={states[index]}>
                <button
                  type="button"
                  aria-current={id === problemId ? 'step' : undefined}
                  aria-label={`Q${index + 1}, ${t(label[0], label[1])}`}
                  onClick={() =>
                    id !== problemId &&
                    navigate('problem', { problem: id, mock: session.id })
                  }
                >
                  <i aria-hidden="true" />
                  Q{index + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div
        className="mock-exam-clock"
        style={{ '--left': left } as React.CSSProperties}
      >
        <span role="timer" aria-label={t('剩余时间', 'Time left')}>
          {formatClock(clock.remaining)}
        </span>
        {/* Changes only at the thresholds, so screen readers hear each warning once. */}
        <output aria-live="polite" className="mock-exam-alert">
          {clock.warning
            ? t(`最后 ${clock.warning} 分钟`, `Last ${clock.warning} min`)
            : ''}
        </output>
      </div>
      <Button className="mock-exam-finish" onClick={() => setConfirm(true)}>
        <Flag size={15} />
        {t('交卷', 'Finish')}
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('确定交卷？', 'Finish the exam?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `已通过 ${solved} / ${session.ids.length} 题，还剩 ${formatClock(clock.remaining)}。交卷后计时停止，题解随即解锁。`,
                `${solved} of ${session.ids.length} solved with ${formatClock(clock.remaining)} left. Finishing stops the clock and unlocks the solutions.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('继续作答', 'Keep going')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => finishMockExam(userId, session.id, navigate)}
            >
              {t('交卷', 'Finish')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A finished mock opened again: solutions are unlocked; the report is one click away. */
export function MockExamDone({
  session,
  navigate,
}: {
  session: MockSession;
  navigate: Navigate;
}) {
  const t = useT();
  return (
    <div className="mock-exam-bar" data-done role="region" aria-label={t('模拟考试', 'Mock exam')}>
      <div className="mock-exam-id">
        <span className="mock-exam-kicker">MOCK OA</span>
        <strong>{t('本场已交卷，题解已解锁', 'Exam finished. Solutions are unlocked')}</strong>
      </div>
      <Button
        className="mock-exam-finish"
        onClick={() => navigate('mock', { report: session.id })}
      >
        {t('查看成绩单', 'View report')}
        <ChevronRight size={15} />
      </Button>
    </div>
  );
}

/** The exam's AC modal: the next unsolved question of this exam, or hand in. */
export function ExamAcceptedDialog({
  session,
  problemId,
  submissions,
  userId,
  navigate,
  onClose,
}: {
  session: MockSession;
  problemId: string;
  submissions: Submissions;
  userId: string;
  navigate: Navigate;
  onClose: () => void;
}) {
  const t = useT();
  const primary = useRef<HTMLButtonElement>(null);
  // The refreshed submissions may not include this AC yet.
  const states = questionStates(session, submissions).map((s, i) =>
    session.ids[i] === problemId ? 'ac' : s,
  );
  const at = session.ids.indexOf(problemId);
  const order = [...session.ids.slice(at + 1), ...session.ids.slice(0, at)];
  const next = order.find((id) => states[session.ids.indexOf(id)] !== 'ac');
  const solved = states.filter((s) => s === 'ac').length;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="cs-accepted-dialog" showCloseButton={false} initialFocus={primary}>
        <div className="cs-accepted-banner">
          <DialogTitle className="cs-accepted-title">Accepted</DialogTitle>
          <DialogDescription className="cs-accepted-stats">
            {t(
              `Q${at + 1} 通过 · 本场 ${solved} / ${session.ids.length}`,
              `Q${at + 1} solved · ${solved} of ${session.ids.length} in this exam`,
            )}
          </DialogDescription>
          <Button
            ref={primary}
            size="lg"
            className="cs-accepted-next"
            onClick={() =>
              next
                ? navigate('problem', { problem: next, mock: session.id })
                : finishMockExam(userId, session.id, navigate)
            }
          >
            {next
              ? t(`下一题 Q${session.ids.indexOf(next) + 1}`, `Next: Q${session.ids.indexOf(next) + 1}`)
              : t('全部通过，交卷', 'All solved: finish')}
            <ChevronRight />
          </Button>
          <button
            className="cs-accepted-dismiss"
            aria-label={t('收起通过提示', 'Dismiss success message')}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
