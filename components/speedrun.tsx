'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LogIn, RotateCcw, X, Zap } from 'lucide-react';
import { api, type Boot } from '@/lib/types';
import { track } from '@/lib/analytics';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { ROUTE_SECTIONS, STOP_NAMES } from '@/lib/route-stops';
import { groupIndex, stopCode, type SpeedrunQuestion } from '@/lib/speedrun';
import { StatementMarkdown } from './statement-markdown';
import type { Navigate } from './learning';
import '@/app/speedrun.css';

const BEST = 'cswork:speedrun:best';
function readBest() {
  try {
    return Number(localStorage.getItem(BEST)) || 0;
  } catch {
    return 0;
  }
}
function saveBest(score: number) {
  try {
    localStorage.setItem(BEST, String(score));
  } catch {
    /* Private mode: the best score just isn't kept. */
  }
}
/** Plain clicks stay in the app; modified clicks open a tab as usual. */
const inApp = (go: () => void) => (e: React.MouseEvent) => {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go();
};

export function Speedrun({ boot, navigate }: { boot: Boot; navigate: Navigate }) {
  const t = useT(),
    en = useLocale() === 'en';
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<SpeedrunQuestion[] | null>(null);
  const [error, setError] = useState('');
  const [picks, setPicks] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [best, setBest] = useState({ score: 0, beaten: false });
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ questions: SpeedrunQuestion[] }>('oj/speedrun')
      .then((r) => {
        if (cancelled) return;
        setQuestions(r.questions);
        setPicks([]);
        setIndex(0);
        setError('');
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [round]);

  const q = questions?.[index];
  const picked = picks[index];
  const done = !!questions?.length && index >= questions.length;
  const score = questions ? picks.filter((p, i) => p === questions[i]?.answer).length : 0;

  // A new question or the results take focus, except on the first load of the view.
  useEffect(() => {
    if (questions && (index > 0 || round > 0)) heading.current?.focus();
  }, [questions, index, round]);
  useEffect(() => {
    if (picked) nextButton.current?.focus();
  }, [picked]);

  function answer(slug: string) {
    if (!q || picked) return;
    setPicks((list) => (list.length === index ? [...list, slug] : list));
  }
  function next() {
    if (!questions || !picked) return;
    if (index + 1 === questions.length) {
      const final = picks.filter((p, i) => p === questions[i].answer).length;
      track('speedrun_finish', { score: final });
      const previous = readBest();
      if (final > previous) saveBest(final);
      setBest({ score: Math.max(previous, final), beaten: final > previous && previous > 0 });
    }
    setIndex(index + 1);
  }

  // 1-4 answer, Enter moves on. Buttons and fields keep their own keys.
  const keys = useRef({ answer, next, q, picked });
  keys.current = { answer, next, q, picked };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      const { answer, next, q, picked } = keys.current;
      if (/^[1-4]$/.test(e.key) && q && !picked) {
        e.preventDefault();
        answer(q.choices[Number(e.key) - 1]);
      } else if (e.key === 'Enter' && picked && !target?.closest?.('button, a')) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const stopName = (slug: string) =>
    Object.hasOwn(STOP_NAMES, slug) ? STOP_NAMES[slug][en ? 1 : 0] : slug;
  const groupName = (slug: string) => {
    const g = ROUTE_SECTIONS[groupIndex(slug)];
    return g ? (en ? g.en : g.zh) : t('其他', 'Other');
  };
  const title = (item: SpeedrunQuestion) =>
    (en ? item.titleEn || item.titleZh : item.titleZh || item.titleEn) || `#${item.number}`;
  const solveHref = (item: SpeedrunQuestion) => `/?view=problem&problem=${encodeURIComponent(item.id)}`;
  const solve = (item: SpeedrunQuestion) => inApp(() => navigate('problem', { problem: item.id }));
  const again = () => {
    setQuestions(null);
    setRound((n) => n + 1);
  };

  const board = (children: React.ReactNode) => (
    <section className="sr" aria-labelledby="sr-heading" lang={en ? 'en' : 'zh'}>
      {children}
    </section>
  );

  if (error)
    return board(
      <div className="sr-board sr-state" role="alert">
        <h2 id="sr-heading">{t('题型快练暂时无法加载', "Couldn't load the speedrun")}</h2>
        <p>{t(error, englishMessage(error))}</p>
        <button type="button" className="sr-cta" onClick={again}>
          <RotateCcw size={15} aria-hidden />
          {t('重试', 'Retry')}
        </button>
      </div>,
    );
  if (!questions)
    return board(
      <output className="sr-board sr-state" aria-busy="true">
        <span id="sr-heading">{t('正在发车…', 'Boarding…')}</span>
      </output>,
    );
  if (!questions.length)
    return board(
      <div className="sr-board sr-state">
        <h2 id="sr-heading">{t('还没有可练的题', 'No problems to drill yet')}</h2>
        <p>{t('500 路的题目开放评测后，这里就能开练。', 'Once Line 500 problems open for judging, the drill starts here.')}</p>
      </div>,
    );

  if (done) {
    const groups = new Map<number, { right: number; total: number }>();
    questions.forEach((item, i) => {
      const g = groupIndex(item.answer);
      const entry = groups.get(g) ?? { right: 0, total: 0 };
      entry.total++;
      if (picks[i] === item.answer) entry.right++;
      groups.set(g, entry);
    });
    return board(
      <>
        <div className="sr-board sr-result">
          <p className="sr-kicker">
            <Zap size={14} aria-hidden />
            {t('题型快练 · 本轮成绩', 'Pattern speedrun · Result')}
          </p>
          <h2 id="sr-heading" ref={heading} tabIndex={-1} className="sr-score">
            <span className="sr-led">{score}</span>
            <span className="sr-score-of">/ {questions.length}</span>
            <span className="sr-only">{t('题答对', 'correct')}</span>
          </h2>
          <p className="sr-best">
            {best.beaten && <span className="sr-chip">{t('新纪录', 'New best')}</span>}
            {t(`最佳 ${best.score} / ${questions.length}`, `Best ${best.score} / ${questions.length}`)}
          </p>
          <div className="sr-actions">
            <button type="button" className="sr-cta" onClick={again}>
              <RotateCcw size={15} aria-hidden />
              {t('再来一轮', 'Another round')}
            </button>
            <a className="sr-link" href="/?view=problems" onClick={inApp(() => navigate('problems'))}>
              {t('回到 500 路', 'Back to Line 500')}
            </a>
          </div>
        </div>
        <div className="sr-paper">
          <h3 className="sr-subhead">{t('分区正确率', 'Accuracy by section')}</h3>
          <ul className="sr-groups">
            {[...groups].sort(([a], [b]) => a - b).map(([g, { right, total }]) => (
              <li key={g} style={{ '--frac': right / total } as React.CSSProperties}>
                <span>{ROUTE_SECTIONS[g] ? (en ? ROUTE_SECTIONS[g].en : ROUTE_SECTIONS[g].zh) : t('其他', 'Other')}</span>
                <i aria-hidden />
                <b>
                  {right}/{total}
                </b>
              </li>
            ))}
          </ul>
          <h3 className="sr-subhead">{t('逐题回顾', 'Review')}</h3>
          <ol className="sr-review">
            {questions.map((item, i) => {
              const right = picks[i] === item.answer;
              return (
                <li key={item.id} data-right={right || undefined}>
                  {right ? <Check size={15} aria-label={t('答对', 'Correct')} /> : <X size={15} aria-label={t('答错', 'Wrong')} />}
                  <a href={solveHref(item)} onClick={solve(item)}>
                    <span className="sr-num">#{item.number}</span> {title(item)}
                  </a>
                  <span className="sr-review-stop">
                    {stopCode(item.answer)} {stopName(item.answer)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </>,
    );
  }

  const current = q!;
  // The site language's excerpt, else the other one.
  const excerptEn = en ? !!current.excerptEn : !current.excerptZh;
  const excerpt = excerptEn ? current.excerptEn : current.excerptZh;
  const right = picked === current.answer;
  return board(
    <>
      <div className="sr-board">
        <div className="sr-top">
          <p className="sr-kicker">
            <Zap size={14} aria-hidden />
            {t('题型快练', 'Pattern speedrun')}
          </p>
          <p className="sr-count" aria-label={t(`第 ${index + 1} 题，共 ${questions.length} 题`, `Question ${index + 1} of ${questions.length}`)}>
            <span className="sr-led">{String(index + 1).padStart(2, '0')}</span>
            <span aria-hidden>/{String(questions.length).padStart(2, '0')}</span>
          </p>
        </div>
        <ol className="sr-pips" aria-hidden>
          {questions.map((item, i) => (
            <li
              key={item.id}
              data-state={
                i < picks.length ? (picks[i] === item.answer ? 'right' : 'wrong') : i === index ? 'now' : undefined
              }
            />
          ))}
        </ol>
        <h2 id="sr-heading" ref={heading} tabIndex={-1} className="sr-title">
          <span className="sr-num">#{current.number}</span> {title(current)}
        </h2>
      </div>
      <div className="sr-paper">
        {excerpt ? (
          <div className="sr-excerpt" lang={excerptEn ? 'en' : 'zh'}>
            <StatementMarkdown body={excerpt} />
          </div>
        ) : (
          !boot.person && (
            <div className="sr-guest">
              <p>{t('登录后可以看到每道题的题面首段，更容易判断题型。', 'Sign in to see the opening of each statement, the part that gives the pattern away.')}</p>
              <button type="button" className="sr-link" onClick={() => window.dispatchEvent(new Event('cswork:auth-required'))}>
                <LogIn size={15} aria-hidden />
                {t('登录 / 注册', 'Sign in / Sign up')}
              </button>
            </div>
          )
        )}
        <div className="sr-ask" role="group" aria-labelledby="sr-ask">
          <p id="sr-ask" className="sr-ask-label">
            {t('这道题该在哪一站下车？', 'Which stop does this problem belong to?')}
            <span className="sr-hint" aria-hidden>
              {t('按 1–4 作答', 'Press 1–4')}
            </span>
          </p>
          <div className="sr-choices">
            {current.choices.map((slug, i) => {
              const state = !picked ? undefined : slug === current.answer ? 'right' : slug === picked ? 'wrong' : 'off';
              return (
                <button
                  key={slug}
                  type="button"
                  className="sr-choice"
                  data-state={state}
                  disabled={!!picked}
                  aria-keyshortcuts={String(i + 1)}
                  onClick={() => answer(slug)}
                >
                  <kbd aria-hidden>{i + 1}</kbd>
                  <span className="sr-roundel" aria-hidden>
                    {stopCode(slug)}
                  </span>
                  <span className="sr-choice-name">
                    {stopName(slug)}
                    <small>{groupName(slug)}</small>
                  </span>
                  {state === 'right' && <span className="sr-only">{t('（正确答案）', '(correct answer)')}</span>}
                  {state === 'wrong' && <span className="sr-only">{t('（你的选择）', '(your pick)')}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="sr-verdict" aria-live="polite">
          {picked && (
            <div data-right={right || undefined}>
              <p className="sr-verdict-head">
                {right ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                {right
                  ? t('答对了', 'Correct')
                  : t(
                      `不对，这题在 ${stopCode(current.answer)} ${stopName(current.answer)}`,
                      `Not quite: it's stop ${stopCode(current.answer)}, ${stopName(current.answer)}`,
                    )}
              </p>
              <p className="sr-reason">{en ? current.reasonEn || current.reason : current.reason || current.reasonEn}</p>
              <div className="sr-actions">
                <button type="button" ref={nextButton} className="sr-cta" onClick={next}>
                  {index + 1 === questions.length ? t('看成绩', 'See results') : t('下一题', 'Next')}
                  <ArrowRight size={15} aria-hidden />
                  <kbd aria-hidden>Enter</kbd>
                </button>
                <a className="sr-link" href={solveHref(current)} onClick={solve(current)}>
                  {t('去做这题', 'Solve it')}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
  );
}
