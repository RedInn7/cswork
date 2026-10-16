'use client';
import { useEffect, useState } from 'react';
import { PenLine, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { activeStatuses, ojRequest, type OJSubmission } from '@/lib/oj-client';
import { useNote } from './problem-notes';
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
import '@/app/whiteboard.css';

// The verdicts that fail a whiteboard attempt (lib/server/practice-aids.ts); a judge fault or a cancel is no attempt.
const FAILED = ['wrong_answer', 'compile_error', 'time_limit', 'memory_limit', 'output_limit', 'runtime_error'];

export type Whiteboard = ReturnType<typeof useWhiteboard>;

/**
 * Whiteboard mode in components/problem-workspace.tsx: a plain-text editor with no runs, custom
 * cases, stress tests, hints, editorials or AI, and one submission. Submitting leaves the mode;
 * once judged, the result bar says whether it passed and the learner's first whiteboard attempt
 * on the problem is recorded for the progress page (POST problems/<id>/aids, kind whiteboard).
 * `available` is false in a mock exam or contest, a drill and on the SQL track.
 */
export function useWhiteboard(problemId: string, signedIn: boolean, submission: OJSubmission | null, available: boolean) {
  const [on, setOn] = useState(false);
  // The whiteboard submission still being judged, then its outcome.
  const [pending, setPending] = useState<string | null>(null);
  const [result, setResult] = useState<'passed' | 'failed' | 'void' | null>(null);
  useEffect(() => {
    if (!pending || submission?.id !== pending || activeStatuses.has(submission.status)) return;
    const status = submission.status;
    const outcome = status === 'accepted' ? 'passed' : FAILED.includes(status) ? 'failed' : 'void';
    setPending(null);
    setResult(outcome);
    // Sent once the verdict is final here, which the server already holds (it answers 409 before).
    if (signedIn && outcome !== 'void')
      void ojRequest(`problems/${encodeURIComponent(problemId)}/aids`, { kind: 'whiteboard', submissionId: pending }).catch(
        () => {},
      );
  }, [pending, submission, problemId, signedIn]);
  return {
    available,
    on: on && available,
    result,
    enter() {
      setOn(true);
      setResult(null);
    },
    exit: () => setOn(false),
    /** A submission was created: the one whiteboard submission, so the mode ends. */
    submitted(id: string) {
      if (!on || !available) return;
      setOn(false);
      setPending(id);
    },
    dismiss: () => setResult(null),
  };
}

/** The top bar's switch; entering asks once, leaving is a click (nothing is recorded). */
export function WhiteboardToggle({ wb, onEnter }: { wb: Whiteboard; onEnter: () => void }) {
  const t = useT();
  const [asking, setAsking] = useState(false);
  const label = wb.on ? t('退出白板模式', 'Leave whiteboard mode') : t('白板模式', 'Whiteboard mode');
  return (
    <>
      <button
        className="cs-top-button"
        aria-pressed={wb.on}
        aria-label={label}
        title={t('像面试白板一样写：不能运行、没有补全和提示，只能提交一次', 'Code like on an interview whiteboard: no runs, completion or hints, one submission')}
        onClick={() => (wb.on ? wb.exit() : setAsking(true))}
      >
        <PenLine size={15} />
        <span>{t('白板', 'Whiteboard')}</span>
      </button>
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('进入白板模式？', 'Start whiteboard mode?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                '编辑器变成纯文本：没有补全、括号自动补齐和报错提示。不能运行、不能用自定义用例和对拍，提示、题解和 AI 助教也会隐藏。只能提交一次，提交后自动退出，你的第一次白板结果会记入进度页。',
                "The editor becomes plain text: no completion, auto-closing brackets or error marks. You can't run code, use custom cases or stress tests, and hints, editorials and the AI tutor are hidden. You get one submission; it ends the mode, and your first whiteboard result goes on your progress page.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                wb.enter();
                onEnter();
                setAsking(false);
              }}
            >
              {t('开始', 'Start')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * The console in whiteboard mode: a manual dry-run pad for tracing the code by hand. Saved to the
 * account as note wb:<problem id>, or in this browser for a guest.
 */
export function WhiteboardPad({ userId, problemId }: { userId: string | null; problemId: string }) {
  const t = useT();
  const note = useNote(userId, `wb:${problemId}`);
  const key = `cswork:wb:${problemId}`;
  const [local, setLocal] = useState('');
  useEffect(() => {
    if (userId) return;
    try {
      setLocal(localStorage.getItem(key) ?? '');
    } catch {}
  }, [userId, key]);
  const edit = (value: string) => {
    if (userId) return note.edit(value);
    setLocal(value);
    try {
      localStorage.setItem(key, value);
    } catch {}
  };
  return (
    <>
      <p className="cs-console-note">
        {t(
          '白板模式：不能运行，自定义用例和对拍已隐藏。用下面的草稿区拿一个小例子，一行行手动推演变量的变化，确认没问题再提交（只有一次）。',
          'Whiteboard mode: running, custom cases and stress tests are off. Use the pad below to trace a small example by hand, line by line, then submit once you are sure (you get one try).',
        )}
      </p>
      <label className="cs-wb-label" htmlFor="whiteboard-dry-run">
        {t('手动 dry-run', 'Manual dry run')}
      </label>
      <textarea
        id="whiteboard-dry-run"
        className="cs-custom-input"
        value={userId ? note.text : local}
        onChange={(event) => edit(event.target.value)}
        placeholder={t('例如：nums=[2,7,11,15]，i=0 时 seen={2:0}…', 'e.g. nums=[2,7,11,15]; at i=0, seen={2:0}…')}
        spellCheck={false}
      />
      {userId && note.error && (
        <p className="cs-console-note" role="alert">
          {note.error}
        </p>
      )}
    </>
  );
}

/** After the whiteboard submission is judged: passed on the first try or not. */
export function WhiteboardResult({ wb }: { wb: Whiteboard }) {
  const t = useT();
  if (!wb.result) return null;
  return (
    <output className="cs-draft-restored">
      <span>
        {wb.result === 'passed'
          ? t('白板一次通过：没运行过就写对了。', 'Whiteboard pass: right on the first try, without running it.')
          : wb.result === 'failed'
            ? t('白板没通过。现在可以运行、看提示，接着改。', 'Whiteboard attempt failed. You can now run, use hints and keep going.')
            : t('这次判题没有完成，不算白板结果，可以再进一次白板模式。', "Judging didn't finish, so this doesn't count. You can start whiteboard mode again.")}
      </span>
      <button type="button" aria-label={t('关闭提示', 'Dismiss')} onClick={wb.dismiss}>
        <X size={13} />
      </button>
    </output>
  );
}
