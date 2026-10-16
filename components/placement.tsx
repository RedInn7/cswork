'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Compass, RotateCcw, X } from 'lucide-react';
import { ojRequest } from '@/lib/oj-client';
import { masteredStops, PER_GROUP, type PlacementResult } from '@/lib/placement';
import { ROUTE_SECTIONS, ROUTE_SLUGS, STOP_NAMES } from '@/lib/route-stops';
import { stopCode } from '@/lib/speedrun';
import { StatementMarkdown } from './statement-markdown';
import '@/app/speedrun.css';

type Question = {
  id: string;
  number: number;
  titleZh: string;
  titleEn: string;
  choices: string[];
  excerptZh?: string;
  excerptEn?: string;
};
type View = {
  latest: PlacementResult | null;
  retakeAt: number | null;
  session: { total: number; index: number; answered: boolean[]; group: number; question: Question } | null;
};
type Verdict = { id: string; pick: string; answer: string; right: boolean; reason: string; reasonEn: string };

const problemHref = (id: string) => `/?${new URLSearchParams({ view: 'problem', problem: id })}`;

/**
 * /placement: the pattern-recognition placement quiz (lib/server/placement.ts) on the speedrun's
 * board. PER_GROUP questions a group on a ladder, the verdict after each, then a skill map: the
 * groups the sprint plan can skip, and two problems to check each weak one.
 */
export function Placement({ zh }: { zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [load, setLoad] = useState(0);
  const [view, setView] = useState<View | null>(null);
  // An answer's verdict and the view after it, shown once the learner moves on.
  const [answered, setAnswered] = useState<{ verdict: Verdict; next: View } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    let live = true;
    ojRequest<View>('speedrun/placement').then(
      (value) => live && setView(value),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [load]);
  // A new question or the result takes focus, except on the first load.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
    moved.current = false;
  }, [view]);
  useEffect(() => {
    if (answered) nextButton.current?.focus();
  }, [answered]);

  async function send(data: unknown) {
    setBusy(true);
    setError('');
    try {
      return await ojRequest<View & { verdict?: Verdict }>('speedrun/placement', data);
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    if (busy) return;
    const next = await send({ start: true });
    if (!next) return;
    moved.current = true;
    setView(next);
  }
  async function pick(slug: string) {
    const q = view?.session?.question;
    if (!q || answered || busy) return;
    const next = await send({ id: q.id, pick: slug });
    if (next?.verdict) setAnswered({ verdict: next.verdict, next });
  }
  function proceed() {
    if (!answered) return;
    moved.current = true;
    setView(answered.next);
    setAnswered(null);
  }
  function reload() {
    setError('');
    setView(null);
    setAnswered(null);
    setLoad((n) => n + 1);
  }

  const stopName = (slug: string) => (Object.hasOwn(STOP_NAMES, slug) ? STOP_NAMES[slug][zh ? 0 : 1] : slug);
  const groupName = (g: number) => (ROUTE_SECTIONS[g] ? (zh ? ROUTE_SECTIONS[g].zh : ROUTE_SECTIONS[g].en) : t('其他', 'Other'));
  const title = (q: { number: number; titleZh: string; titleEn: string }) =>
    (zh ? q.titleZh || q.titleEn : q.titleEn || q.titleZh) || `#${q.number}`;
  const day = (at: number) =>
    new Date(at).toLocaleDateString(zh ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const board = (children: React.ReactNode) => (
    <section className="sr" aria-labelledby="sr-heading" lang={zh ? 'zh' : 'en'}>
      {children}
    </section>
  );
  const failure = error && (
    <p className="pl-error" role="alert">
      {error}{' '}
      <button type="button" className="sr-link" onClick={reload}>
        {t('刷新', 'Reload')}
      </button>
    </p>
  );

  if (!view)
    return board(
      error ? (
        <div className="sr-board sr-state" role="alert">
          <h2 id="sr-heading">{t('定位测验暂时无法加载', "Couldn't load the placement quiz")}</h2>
          <p>{error}</p>
          <button type="button" className="sr-cta" onClick={reload}>
            <RotateCcw size={15} aria-hidden />
            {t('重试', 'Retry')}
          </button>
        </div>
      ) : (
        <output className="sr-board sr-state" aria-busy="true">
          <span id="sr-heading">{t('正在加载…', 'Loading…')}</span>
        </output>
      ),
    );

  const session = view.session;
  if (session) {
    const q = session.question;
    const verdict = answered?.verdict;
    // The site language's excerpt, else the other one.
    const excerptEn = zh ? !q.excerptZh : !!q.excerptEn;
    const excerpt = excerptEn ? q.excerptEn : q.excerptZh;
    return board(
      <>
        <div className="sr-board">
          <div className="sr-top">
            <p className="sr-kicker">
              <Compass size={14} aria-hidden />
              {t('题型识别测验', 'Pattern placement')} · {groupName(session.group)}
            </p>
            <p className="sr-count">
              <span className="sr-only">
                {t(`第 ${session.index + 1} 题，共 ${session.total} 题`, `Question ${session.index + 1} of ${session.total}`)}
              </span>
              <span className="sr-led" aria-hidden>
                {String(session.index + 1).padStart(2, '0')}
              </span>
              <span aria-hidden>/{String(session.total).padStart(2, '0')}</span>
            </p>
          </div>
          <ol className="sr-pips" aria-hidden>
            {Array.from({ length: session.total }, (_, i) => {
              const right = i < session.answered.length ? session.answered[i] : i === session.index ? verdict?.right : undefined;
              return (
                <li
                  key={i}
                  data-state={right === undefined ? (i === session.index ? 'now' : undefined) : right ? 'right' : 'wrong'}
                />
              );
            })}
          </ol>
          <h2 id="sr-heading" ref={heading} tabIndex={-1} className="sr-title">
            <span className="sr-num">#{q.number}</span> {title(q)}
          </h2>
        </div>
        <div className="sr-paper">
          {excerpt && (
            <div className="sr-excerpt" lang={excerptEn ? 'en' : 'zh'}>
              <StatementMarkdown body={excerpt} />
            </div>
          )}
          <fieldset className="sr-ask">
            <legend className="sr-ask-label">{t('这道题该用哪一站的方法？', 'Which stop’s technique does this problem call for?')}</legend>
            <div className="sr-choices">
              {q.choices.map((slug) => {
                const state = !verdict ? undefined : slug === verdict.answer ? 'right' : slug === verdict.pick ? 'wrong' : 'off';
                return (
                  <button
                    key={slug}
                    type="button"
                    className="sr-choice pl-choice"
                    data-state={state}
                    disabled={!!verdict || busy}
                    onClick={() => pick(slug)}
                  >
                    {/* Stop numbers wait for the answer: they would give it away. */}
                    <span className="sr-roundel" aria-hidden>
                      {verdict && stopCode(slug)}
                    </span>
                    <span className="sr-choice-name">{stopName(slug)}</span>
                    {state === 'right' && <span className="sr-only">{t('（正确答案）', '(correct answer)')}</span>}
                    {state === 'wrong' && <span className="sr-only">{t('（你的选择）', '(your pick)')}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {failure}
          <div className="sr-verdict" aria-live="polite">
            {verdict && (
              <div data-right={verdict.right || undefined}>
                <p className="sr-verdict-head">
                  {verdict.right ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
                  {verdict.right
                    ? t('答对了', 'Correct')
                    : t(
                        `不对，这题在 ${stopCode(verdict.answer)} ${stopName(verdict.answer)}`,
                        `Not quite: it's stop ${stopCode(verdict.answer)}, ${stopName(verdict.answer)}`,
                      )}
                </p>
                <p className="sr-reason">{zh ? verdict.reason || verdict.reasonEn : verdict.reasonEn || verdict.reason}</p>
                <div className="sr-actions">
                  <button type="button" ref={nextButton} className="sr-cta" onClick={proceed}>
                    {answered?.next.session ? t('下一题', 'Next') : t('看结果', 'See results')}
                    <ArrowRight size={15} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>,
    );
  }

  const latest = view.latest;
  const canStart = !view.retakeAt || Date.now() >= view.retakeAt;
  if (!latest)
    return board(
      <div className="sr-board">
        <p className="sr-kicker">
          <Compass size={14} aria-hidden />
          {t('题型识别测验', 'Pattern placement')}
        </p>
        <h2 id="sr-heading" ref={heading} tabIndex={-1} className="sr-title">
          {t('哪些站你已经认得出来？', 'Which stops can you already spot?')}
        </h2>
        <p className="pl-lead">
          {t(
            `${ROUTE_SECTIONS.length} 组，每组 ${PER_GROUP} 题。答对了下一题难一档，答错了容易一档。读题面开头，选出这道题该用哪一站的方法，大约 15 分钟；中途离开，下次接着做。`,
            `${ROUTE_SECTIONS.length} groups, ${PER_GROUP} questions each. A right answer makes the next one harder, a miss makes it easier. Read the opening of each statement and pick the stop whose technique it calls for. About 15 minutes; leave halfway and you pick up where you stopped.`,
          )}
        </p>
        <div className="sr-actions">
          <button type="button" className="sr-cta" onClick={start} disabled={busy}>
            {t('开始测验', 'Start the quiz')}
            <ArrowRight size={15} aria-hidden />
          </button>
        </div>
        {failure}
      </div>,
    );

  const mastered = masteredStops(latest);
  const skips = latest.groups.filter((g) => g.skip).length;
  const picks = latest.groups.flatMap((g) => g.picks.map((p) => ({ ...p, group: g.group })));
  return board(
    <>
      <div className="sr-board sr-result">
        <p className="sr-kicker">
          <Compass size={14} aria-hidden />
          {t(`题型识别测验 · ${day(latest.at)}`, `Pattern placement · ${day(latest.at)}`)}
        </p>
        <h2 id="sr-heading" ref={heading} tabIndex={-1} className="sr-score">
          <span className="sr-led">{skips}</span>
          <span className="sr-score-of">/ {latest.groups.length}</span>
          <span className="sr-only">{t('组可以跳过', 'groups to skip')}</span>
        </h2>
        <p className="sr-best">
          {t('组可以直接跳过，冲刺计划会把这些站标为已掌握', 'groups to skip: the sprint plan marks their stops as known')}
        </p>
        {/* The line, its known stops lit. */}
        <ol className="sr-pips" aria-hidden>
          {ROUTE_SLUGS.map((slug) => (
            <li key={slug} data-state={mastered.has(slug) ? 'right' : undefined} />
          ))}
        </ol>
        <div className="sr-actions">
          <a className="sr-cta" href="/?view=problems">
            {t('去排冲刺计划', 'Open the sprint plan')}
            <ArrowRight size={15} aria-hidden />
          </a>
          {canStart ? (
            <button type="button" className="sr-link" onClick={start} disabled={busy}>
              <RotateCcw size={15} aria-hidden />
              {t('重测', 'Retake')}
            </button>
          ) : (
            <span className="pl-lead">
              {t(`${day(view.retakeAt!)} 起可以重测`, `You can retake it from ${day(view.retakeAt!)}`)}
            </span>
          )}
        </div>
        {failure}
      </div>
      <div className="sr-paper">
        <h3 className="sr-subhead">{t('技能图', 'Skill map')}</h3>
        <ul className="sr-groups">
          {latest.groups.map((g) => (
            <li key={g.group} style={{ '--frac': g.total ? g.right / g.total : 0 } as React.CSSProperties}>
              <span>
                {groupName(g.group)}
                {g.skip && <em className="pl-skip">{t('可跳过', 'Skip')}</em>}
                <small>{g.level ? t(`估计水平 ≈${g.level}`, `Level ≈${g.level}`) : t('暂无估计', 'No estimate')}</small>
              </span>
              <i aria-hidden />
              <b>
                {g.right}/{g.total}
              </b>
            </li>
          ))}
        </ul>
        {picks.length > 0 && (
          <>
            <h3 className="sr-subhead">{t('薄弱组：各做两道验证一下', 'Weak groups: check each with two problems')}</h3>
            <ol className="sr-review">
              {picks.map((p) => (
                <li key={p.id}>
                  <span className="sr-num">{p.rated ? p.score : `≈${p.score}`}</span>
                  <a href={problemHref(p.id)}>
                    <span className="sr-num">#{p.number}</span> {title(p)}
                  </a>
                  <span className="sr-review-stop">{groupName(p.group)}</span>
                </li>
              ))}
            </ol>
          </>
        )}
        <p className="pl-note">
          {t(
            '这是题型识别测验：只看你能不能认出一道题该用哪类方法，不考写代码，也不代表编码能力。水平取答对过的最难一题，没有周赛难度分的题按难度折算（简单 1200、中等 1600、困难 2000），仅供参考。',
            'This quiz checks whether you can tell which technique a problem calls for. It does not test writing code and is not a measure of coding skill. The level is the hardest problem you answered right; problems without a contest rating count by difficulty (Easy 1200, Medium 1600, Hard 2000). Treat it as a rough guide.',
          )}
        </p>
      </div>
    </>,
  );
}
