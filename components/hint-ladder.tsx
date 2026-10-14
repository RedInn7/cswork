'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Lock } from 'lucide-react';
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
import { timerSeconds } from './problem-timer';
import {
  HINT_WAIT_SECONDS,
  hintUnlocked,
  hintsUnlocked,
  type OJSubmission,
} from '@/lib/oj-client';
import { track } from '@/lib/analytics';
import '@/app/problem-aids.css';

const LEVELS = [
  ['观察', 'Observation'],
  ['关键不变量', 'Key invariant'],
  ['步骤', 'Steps'],
] as const;

/**
 * Line 500's three hints, opened one at a time: hint 1 any time, hint 2 after a failed
 * formal submission or 10 minutes on the problem, hint 3 after two failures. A locked
 * hint says what opens it and can still be shown after a confirm.
 */
export function HintLadder({
  problemId,
  userId,
  hints,
  failed: loadedFailed,
  submission,
  english,
}: {
  problemId: string;
  userId: string;
  hints: { zh: string[]; en: string[] };
  /** Failed formal submissions this round when the problem loaded. */
  failed: number;
  /** The live verdict: a failure seen here counts too. */
  submission: OJSubmission | null;
  english: boolean;
}) {
  const list = hints[english ? 'en' : 'zh'];
  const [shown, setShown] = useState(0);
  const [confirm, setConfirm] = useState(false);
  // ponytail: a reload mid-judge can count that verdict twice (hint 3 one failure early);
  // exact needs the failed ids from the server.
  const [liveFailed, setLiveFailed] = useState<string[]>([]);
  useEffect(() => {
    if (submission && hintUnlocked([submission]))
      setLiveFailed((ids) =>
        ids.includes(submission.id) ? ids : [...ids, submission.id],
      );
  }, [submission]);
  const failed = loadedFailed + liveFailed.length;
  // The problem timer's reading when it ran, otherwise time since this page opened.
  const [openedAt] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);
  const unlocked = hintsUnlocked(failed, seconds);
  useEffect(() => {
    if (unlocked >= 2) return;
    const read = () =>
      setSeconds(
        timerSeconds(userId, problemId) ?? (Date.now() - openedAt) / 1000,
      );
    read();
    const id = setInterval(read, 15_000);
    return () => clearInterval(id);
  }, [unlocked, userId, problemId, openedAt]);
  // A newly shown hint takes focus, so the reader lands on it rather than on a vanished button.
  const latest = useRef<HTMLLIElement>(null);
  const moveFocus = useRef(false);
  useEffect(() => {
    if (moveFocus.current) latest.current?.focus();
    moveFocus.current = false;
  }, [shown]);
  const next = shown + 1;
  function reveal() {
    moveFocus.current = true;
    setShown(next);
    track('hint_open', { problem_id: problemId, level: next });
  }
  const minutesLeft = Math.max(1, Math.ceil((HINT_WAIT_SECONDS - seconds) / 60));
  const lockedReason =
    next === 2
      ? english
        ? `Unlocks after a failed submission or 10 minutes on this problem (about ${minutesLeft} min to go).`
        : `提交一次未通过，或在本题上用满 10 分钟后解锁（还差约 ${minutesLeft} 分钟）。`
      : english
        ? `Unlocks after two failed submissions (${2 - failed} more to go).`
        : `两次提交未通过后解锁（还差 ${2 - failed} 次）。`;
  return (
    <section className="cs-hint-ladder" aria-labelledby="hint-ladder-title">
      <div className="cs-hint-ladder-head">
        <strong id="hint-ladder-title">
          {english ? 'Step-by-step hints' : '分级提示'}
        </strong>
        <span className="cs-hint-ladder-lamps" aria-hidden="true">
          {LEVELS.map((_, i) => (
            <i
              key={i}
              data-state={
                i < shown ? 'shown' : i < unlocked ? 'open' : 'locked'
              }
            />
          ))}
        </span>
        <span className="cs-hint-ladder-count">
          {shown}/{LEVELS.length}
        </span>
      </div>
      <ol id="hint-ladder-list" className="cs-hint-ladder-list">
        {list.slice(0, shown).map((hint, i) => (
          <li
            key={i}
            ref={i === shown - 1 ? latest : undefined}
            tabIndex={-1}
          >
            <span className="cs-hint-ladder-stop" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <strong>
                {english
                  ? `Hint ${i + 1} · ${LEVELS[i][1]}`
                  : `提示 ${i + 1} · ${LEVELS[i][0]}`}
              </strong>
              <p lang={english ? 'en' : 'zh'}>{hint}</p>
            </div>
          </li>
        ))}
      </ol>
      {next <= LEVELS.length &&
        (next <= unlocked ? (
          <button
            className="cs-hint-ladder-next"
            aria-controls="hint-ladder-list"
            onClick={reveal}
          >
            {english ? 'Show next hint' : '显示下一条提示'}
            <span className="cs-hint-ladder-count">
              {english ? `Hint ${next}` : `提示 ${next}`}
            </span>
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : (
          <div className="cs-route-hint-locked">
            <Lock size={14} aria-hidden="true" />
            <p>
              <strong>{english ? `Hint ${next}: ` : `提示 ${next}：`}</strong>
              {lockedReason}
            </p>
            <button onClick={() => setConfirm(true)}>
              {english ? 'Show anyway' : '仍要查看'}
            </button>
          </div>
        ))}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent finalFocus={() => latest.current || true}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {english ? `Show hint ${next} now?` : `现在查看提示 ${next}？`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lockedReason}{' '}
              {english
                ? 'An idea you reach yourself is the one you remember in the interview.'
                : '先自己想出来的思路，面试时更记得住。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{english ? 'Keep trying' : '再想想'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                reveal();
                setConfirm(false);
              }}
            >
              {english ? 'Show hint' : '查看提示'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
