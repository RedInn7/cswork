'use client';
import { useEffect, useRef, useState } from 'react';
import type { SdQuestion } from '@/lib/server/system-design-course';

type Picks = (number | null)[];
const LETTERS = 'ABCDEFGH';
const localKey = (slug: string) => `cswork:sd-quiz:${slug}`;
const noteUrl = (slug: string) => `/api/oj/notes?target=${encodeURIComponent(`sd:${slug}`)}`;
/** Saves the answers as the note; an empty body removes it (lib/server/my-practice.ts). */
const putPicks = (slug: string, picks: Picks) =>
  fetch(noteUrl(slug), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: picks.every((pick) => pick === null) ? '' : JSON.stringify({ picks }),
    }),
  }).then(
    (response) => response.ok,
    () => false,
  );

/** Saved answers, one per question (null: not answered); anything malformed or stale reads as none. */
export function parsePicks(raw: unknown, quiz: SdQuestion[]): Picks | null {
  try {
    const picks: unknown = typeof raw === 'string' && raw ? JSON.parse(raw)?.picks : null;
    return Array.isArray(picks) &&
      picks.length === quiz.length &&
      picks.every(
        (pick, i) =>
          pick === null || (Number.isInteger(pick) && pick >= 0 && pick < quiz[i].choices.length),
      )
      ? (picks as Picks)
      : null;
  } catch {
    return null;
  }
}
function readLocal(slug: string) {
  try {
    return localStorage.getItem(localKey(slug));
  } catch {
    return null;
  }
}
function writeLocal(slug: string, picks: Picks | null) {
  try {
    if (picks) localStorage.setItem(localKey(slug), JSON.stringify({ picks }));
    else localStorage.removeItem(localKey(slug));
  } catch {}
}

/**
 * A chapter's multiple-choice quiz. Each question locks on the first pick and explains the
 * answer. Signed in, the answers are the learner's private note `sd:<slug>` (user_notes);
 * signed out they stay in this browser, and move to the account on the next signed-in visit.
 */
export function SdQuiz({ slug, quiz, zh }: { slug: string; quiz: SdQuestion[]; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [picks, setPicks] = useState<Picks>(() => quiz.map(() => null));
  const [where, setWhere] = useState<'loading' | 'account' | 'device'>('loading');
  const [saveFailed, setSaveFailed] = useState(false);
  // Saves go out one at a time, so an older body never lands after a newer one.
  const queue = useRef(Promise.resolve());

  function save(next: Picks) {
    if (where !== 'account')
      return writeLocal(slug, next.every((pick) => pick === null) ? null : next);
    queue.current = queue.current.then(() => putPicks(slug, next).then((ok) => setSaveFailed(!ok)));
  }

  useEffect(() => {
    let current = true;
    const local = parsePicks(readLocal(slug), quiz);
    fetch(noteUrl(slug))
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const saved = parsePicks((await response.json())?.body, quiz);
        if (!current) return;
        setWhere('account');
        if (saved) setPicks(saved);
        else if (local) {
          // Answered while signed out: the account takes them over.
          setPicks(local);
          writeLocal(slug, null);
          queue.current = queue.current.then(() =>
            putPicks(slug, local).then((ok) => setSaveFailed(!ok)),
          );
        }
      })
      .catch(() => {
        if (!current) return;
        setWhere('device');
        if (local) setPicks(local);
      });
    return () => {
      current = false;
    };
  }, [slug, quiz]);

  const choose = (question: number, choice: number) => {
    if (picks[question] !== null) return;
    const next = picks.map((pick, i) => (i === question ? choice : pick));
    setPicks(next);
    save(next);
  };
  const restart = () => {
    const next = quiz.map(() => null);
    setPicks(next);
    save(next);
  };
  const answered = picks.filter((pick) => pick !== null).length;
  const right = picks.filter((pick, i) => pick === quiz[i].answer).length;
  return (
    <section className="sd-quiz" aria-labelledby="sd-quiz-title">
      <header className="sd-quiz-head">
        <h2 id="sd-quiz-title">{t('章节测验', 'Chapter quiz')}</h2>
        <output className="sd-quiz-score">
          {answered === 0
            ? t(`${quiz.length} 道选择题`, `${quiz.length} questions`)
            : answered === quiz.length
              ? t(`完成：答对 ${right} / ${quiz.length}`, `Done: ${right} of ${quiz.length} correct`)
              : t(`已答 ${answered} / ${quiz.length} · 答对 ${right}`, `${answered} of ${quiz.length} answered · ${right} correct`)}
        </output>
      </header>
      <ol className="sd-quiz-list">
        {quiz.map((question, i) => {
          const pick = picks[i];
          const done = pick !== null;
          return (
            <li key={i}>
              <fieldset>
                <legend>
                  <span className="sd-quiz-qno" aria-hidden="true">
                    Q{i + 1}
                  </span>
                  {zh ? question.qZh : question.qEn}
                </legend>
                <ul className="sd-quiz-choices">
                  {question.choices.map((choice, j) => {
                    const state = !done ? undefined : j === question.answer ? 'right' : j === pick ? 'wrong' : undefined;
                    return (
                      <li key={j}>
                        <button
                          type="button"
                          // Answered: aria-disabled, not disabled, so the focused pick keeps focus.
                          disabled={where === 'loading'}
                          aria-disabled={done || undefined}
                          aria-pressed={pick === j}
                          data-state={state}
                          onClick={() => choose(i, j)}
                        >
                          <span className="sd-quiz-letter" aria-hidden="true">
                            {LETTERS[j]}
                          </span>
                          <span>{zh ? choice.zh : choice.en}</span>
                          {state && (
                            <span className="sd-quiz-mark">
                              {state === 'right' ? t('正确答案', 'Answer') : t('你的选择', 'Your pick')}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div aria-live="polite">
                  {done && (
                    <p className="sd-quiz-why" data-state={pick === question.answer ? 'right' : 'wrong'}>
                      <strong>
                        {pick === question.answer
                          ? t('答对了。', 'Correct.')
                          : t(`答案是 ${LETTERS[question.answer]}。`, `The answer is ${LETTERS[question.answer]}.`)}
                      </strong>{' '}
                      {zh ? question.whyZh : question.whyEn}
                    </p>
                  )}
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <footer className="sd-quiz-foot">
        <p>
          {where === 'account'
            ? t('答题进度保存在你的账号里。', 'Your answers are saved to your account.')
            : where === 'device'
              ? t('答题进度只保存在这台设备上；登录后再打开本章，会存进账号。', 'Your answers stay on this device; open the chapter signed in to keep them in your account.')
              : ''}
          {saveFailed && (
            <span role="alert"> {t('最近一次保存失败，刷新后可能看不到。', "The last save failed; it may be gone after a reload.")}</span>
          )}
        </p>
        {answered > 0 && (
          <button type="button" className="sd-quiz-restart" onClick={restart}>
            {t('重新作答', 'Start over')}
          </button>
        )}
      </footer>
    </section>
  );
}
