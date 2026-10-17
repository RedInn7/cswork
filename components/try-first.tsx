'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Eye, ListOrdered, PenLine } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { AnswerGrade, GRADE_MIN, GRADEABLE } from './answer-grade';
import { useNote } from './problem-notes';
import '@/app/interview-prep.css';

/**
 * "Write your answer first": the learner's answer to a question, saved as their note on it
 * (`content:<type>/<slug>`), above a reference answer that stays closed until they compare.
 * Showing it without writing anything asks once whether they'd rather try first.
 * Key it by target. A guest's answer is kept in `local` when given (by the caller), and either way
 * saved to their account once they sign in.
 */
export function TryFirst({
  userId,
  target,
  revealed,
  onReveal,
  revealOnLoad,
  local,
  code,
  gradeable = true,
  scaffold,
}: {
  userId: string | null;
  target: string;
  revealed: boolean;
  /** `asked`: the learner pressed a button (move focus); false when an earlier answer opened it. */
  onReveal: (asked: boolean) => void;
  /** An answer saved on an earlier visit counts as having tried. */
  revealOnLoad?: boolean;
  local?: { value: string; onChange: (value: string) => void };
  code?: boolean;
  /** False when the question has no reference answer for AI feedback to grade against. */
  gradeable?: boolean;
  /** Section headings an empty answer can start from (the question's answer steps). */
  scaffold?: string;
}) {
  const t = useT();
  const id = useId();
  const note = useNote(userId, target, 800, local?.value);
  const guest = !userId;
  const text = guest && local ? local.value : note.text;
  // A guest's answer also goes to the note, which saves it to the account on sign-in.
  const edit = (value: string) => {
    if (guest) local?.onChange(value);
    note.edit(value);
  };
  const [asking, setAsking] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const tryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) tryButton.current?.focus();
  }, [asking]);
  const locked = !guest && (note.state === 'loading' || note.conflict !== null);
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current || note.state === 'loading') return;
    checked.current = true;
    if (revealOnLoad && !revealed && note.text.trim()) onReveal(false);
  }, [note.state, note.text, revealOnLoad, revealed, onReveal]);

  const status =
    note.state === 'saving'
      ? t('正在保存…', 'Saving…')
      : note.state === 'saved'
        ? t('已保存', 'Saved')
        : '';
  return (
    <section className="ip-try" aria-labelledby={`${id}-h`} data-revealed={revealed || undefined}>
      <header className="ip-try-head">
        <h2 id={`${id}-h`}>
          <PenLine size={15} aria-hidden="true" /> {t('先写你的思路', 'Write your answer first')}
        </h2>
        <p>
          {guest
            ? local
              ? t('只存在这台设备上；登录后会存进你的账号。', 'Kept on this device only; sign in to save it to your account.')
              : t('登录后会自动保存到你的账号。', 'Sign in and it saves to your account.')
            : t(
                '只有你能看到，停下输入就自动保存。写完再对照参考答案，差在哪一眼就能看出来。',
                'Only you can see it, and it saves when you pause. Then compare it with the reference answer.',
              )}
        </p>
      </header>
      {note.state === 'load-failed' ? (
        <p className="ip-warn" role="alert">
          {t('你的答案没能加载。', "Couldn't load your answer.")} {note.error}{' '}
          <button type="button" onClick={() => note.retry()}>
            {t('重试', 'Retry')}
          </button>
        </p>
      ) : (
        <>
          {note.conflict !== null && (
            <div className="ip-warn" role="alert">
              <p>
                {t(
                  '这台设备上有一份没保存的版本（比如登录前写的），和账号里保存的答案不一样。下面是账号里保存的内容。',
                  'This device has an unsaved version (written before you signed in, say) that differs from the answer saved to your account. The saved one is below.',
                )}
              </p>
              <button type="button" onClick={() => note.resolve(true)}>
                {t('改用这台设备的版本', "Use this device's version")}
              </button>{' '}
              <button type="button" onClick={() => note.resolve(false)}>
                {t('丢弃它', 'Discard it')}
              </button>
            </div>
          )}
          {scaffold && !text.trim() && (
            <button
              type="button"
              className="rd-button is-quiet ip-try-scaffold"
              disabled={locked}
              onClick={() => {
                edit(scaffold);
                box.current?.focus();
              }}
            >
              <ListOrdered size={14} aria-hidden="true" /> {t('按步骤分段', 'Outline by steps')}
            </button>
          )}
          <textarea
            ref={box}
            className="ip-try-input"
            aria-labelledby={`${id}-h`}
            data-code={code || undefined}
            rows={code ? 9 : 6}
            spellCheck={!code}
            readOnly={locked}
            value={text}
            onChange={(event) => edit(event.target.value)}
            placeholder={
              code
                ? t('思路、复杂度、关键代码……', 'Approach, complexity, the key code…')
                : t('先列要点：你会怎么回答？', 'Jot the points you would make.')
            }
          />
          <p className="ip-try-status" aria-live="polite">
            {note.state === 'unsaved' ? (
              <span className="ip-warn-text">
                {t('没能保存，已暂存在这台设备，下次打开会自动补存。', "Couldn't save. A copy is kept on this device for next time.")}{' '}
                {note.error}{' '}
                <button type="button" onClick={() => note.retry()}>
                  {t('重试', 'Retry')}
                </button>
              </span>
            ) : note.state === 'too-long' ? (
              <span className="ip-warn-text">{t('超过 20 KB，删减后才会保存。', 'Over 20 KB. Shorten it to save.')}</span>
            ) : (
              status
            )}
          </p>
          {/* Above the reference answer, which it leaves closed. */}
          {!guest && gradeable && GRADEABLE.test(target) && (
            <AnswerGrade ready={text.trim().length >= GRADE_MIN} request={() => ({ target, answer: text })} />
          )}
        </>
      )}
      {!revealed &&
        (text.trim() ? (
          <button type="button" className="rd-button ip-try-go" onClick={() => onReveal(true)}>
            <Eye size={14} aria-hidden="true" /> {t('对照参考答案', 'Compare with the reference answer')}
          </button>
        ) : asking ? (
          <fieldset className="ip-try-ask">
            <legend className="sr-only">{t('先试着写？', 'Try first?')}</legend>
            <p>
              {t(
                '先写几句再看？哪怕只是思路的骨架，对照答案时也更容易看出差在哪。',
                'Write a few lines first? Even a rough outline makes the gaps easier to see when you compare.',
              )}
            </p>
            <button
              ref={tryButton}
              type="button"
              className="rd-button"
              onClick={() => {
                setAsking(false);
                box.current?.focus();
              }}
            >
              {t('好，我先写', "OK, I'll try first")}
            </button>
            <button type="button" className="rd-button is-quiet" onClick={() => onReveal(true)}>
              {t('还是直接看', 'Show it anyway')}
            </button>
          </fieldset>
        ) : (
          <button type="button" className="rd-button is-quiet ip-try-skip" onClick={() => setAsking(true)}>
            <Eye size={14} aria-hidden="true" /> {t('直接看答案', 'Show the answer')}
          </button>
        ))}
    </section>
  );
}
