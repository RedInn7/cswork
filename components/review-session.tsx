'use client';
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type Boot } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { problemTitle } from '@/lib/problems';
import { STOP_NAMES } from '@/lib/route-stops';
import { mcqDay, mcqDue, mcqRight, parseMcqReview, readMockState, reviewMcq } from '@/lib/mock-oa';
import { parseReviewPrefs, scheduleReviews, type DueReview, type PracticeHistoryItem } from '@/lib/practice-review';
import { RECALL_CARDS, RECALL_IDEAS, RECALL_NOTE, dueRecall, rateRecall, recallHref, recallNext, type RecallGrade, type RecallQueue } from '@/lib/recall';
import { CARD_MAX, parseCard, toAnki, toCsv, type Card, type ExportRow } from '@/lib/recall-cards';
import { putReview, type PracticeItem } from '@/app/oa/mcq/practice';
import { CardEditor } from './card-editor';
import { McqItem } from './oa-mcq';
import { ProblemNotes, useNote } from './problem-notes';
import { loadRecall, recallDate, updateRecall } from './recall-rate';
import { Button } from './ui/button';
import type { Navigate } from './learning';
import '@/app/study-library.css';
import '@/app/my-progress.css';
import '@/app/review-session.css';

type T = (zh: string, en: string) => string;
/** GET /api/oj/recall/ideas (lib/server/recall-ideas.ts). */
export type Idea = {
  id: string;
  excerpt: string | null;
  hint: string | null;
  complexity: { time: string; space: string } | null;
  stop: string | null;
  takeaway: string | null;
  note: string | null;
};
/** One card of the flip deck: a self-made card, a problem's idea or a self-graded open question. */
export type Flip =
  | { kind: 'card'; key: string; card: Card }
  | { kind: 'idea'; key: string; id: string; idea?: Idea }
  | { kind: 'open'; key: string; title: string };
const NOTE_OF = { card: RECALL_CARDS, idea: RECALL_IDEAS, open: RECALL_NOTE } as const;
// 1/2/3 on the keyboard, in this order.
const GRADES: [RecallGrade, string, string][] = [
  ['no', '不会', "Didn't know"],
  ['partial', '部分会', 'Partly'],
  ['know', '会了', 'Knew it'],
];
const MCQ_SESSION = 30;
const IDEAS_MAX = 100;
const TABS = [
  ['today', '今日复习', 'Due today'],
  ['ideas', '思路速记', 'Idea review'],
  ['cards', '卡片与摘录', 'Cards & excerpts'],
] as const;
type Tab = (typeof TABS)[number][0];

async function ideasOf(ids: string[], en: boolean) {
  const out = new Map<string, Idea>();
  for (let i = 0; i < ids.length; i += IDEAS_MAX) {
    const { items } = await api<{ items: Idea[] }>(`oj/recall/ideas?ids=${ids.slice(i, i + IDEAS_MAX).map(encodeURIComponent).join(',')}&lang=${en ? 'en' : 'zh'}`);
    for (const idea of items) out.set(idea.id, idea);
  }
  return out;
}
async function mcqQuestions(ids: string[], en: boolean) {
  const out: PracticeItem[] = [];
  for (let i = 0; i < ids.length; i += 50)
    out.push(...(await api<{ items: PracticeItem[] }>(`oj/mcq/questions?ids=${ids.slice(i, i + 50).join(',')}&lang=${en ? 'en' : 'zh'}`)).items);
  return out;
}
async function myCards() {
  const { items } = await api<{ items: { target: string; body: string }[] }>(`oj/notes?prefix=${encodeURIComponent('card:')}`);
  return new Map(items.flatMap(({ target, body }) => {
    const card = parseCard(body);
    return card ? [[target.slice(5), card] as const] : [];
  }));
}
const note = (target: string) => api<{ body: string }>(`oj/notes?target=${encodeURIComponent(target)}`).then((r) => r.body);
const midnight = () => new Date().setHours(0, 0, 0, 0);

/**
 * ?view=review-session: one place to review. "Due today" runs the due cards (self-made, problem
 * ideas, self-graded open questions) as a flip deck (Space flips, 1/2/3 grades), then the due
 * multiple-choice questions, then today's coding reviews opened in a new tab and ticked off when
 * they come back accepted. "Idea review" flips through solved or redo problems' patterns without
 * code. "Cards & excerpts" manages the cards and saved excerpts and exports them for Anki or as
 * CSV. Signed in only; a running mock OA (which has a multiple-choice part) closes all of it.
 */
export function ReviewSession({ boot, tab }: { boot: Boot; navigate: Navigate; tab?: string }) {
  const english = useLocale() === 'en';
  const t: T = useCallback((zh: string, en: string) => (english ? en : zh), [english]);
  const userId = boot.person?.id ?? '';
  const [mock] = useState(() => !!userId && !!readMockState(userId).active);
  const [view, setView] = useState<Tab>(TABS.some(([key]) => key === tab) ? (tab as Tab) : 'today');
  const titles = useMemo(() => new Map(boot.problems.map((p) => [p.id, problemTitle(p, english ? 'en' : 'zh')])), [boot.problems, english]);
  const titleOf = (id: string) => titles.get(id) ?? id;
  return (
    <section className="study-library algorithm-library my-progress review-session" lang={english ? 'en' : 'zh'}>
      <header className="progress-board">
        <div className="progress-board-main">
          <p className="route-kicker">{t('我的进度 · 复习', 'My progress · Review')}</p>
          <h1>{t('今日复习', 'Review session')}</h1>
        </div>
      </header>
      {mock ? (
        <p className="rs-state" role="status">
          {t(
            '模拟考进行中：交卷或到时后再来复习，考试期间卡片、选择题和思路都不显示。',
            'A mock exam is in progress. Come back once it is submitted or over: cards, questions and ideas stay hidden during it.',
          )}
        </p>
      ) : (
        <>
          <div className="progress-tabs" role="tablist" aria-label={t('复习方式', 'Review modes')}>
            {TABS.map(([key, zh, en]) => (
              <button key={key} id={`rs-tab-${key}`} role="tab" type="button" aria-selected={view === key} aria-controls="rs-panel" onClick={() => setView(key)}>
                {t(zh, en)}
              </button>
            ))}
          </div>
          <div id="rs-panel" role="tabpanel" aria-labelledby={`rs-tab-${view}`}>
            {view === 'today' ? (
              <Today t={t} english={english} titleOf={titleOf} />
            ) : view === 'ideas' ? (
              <IdeaReview t={t} english={english} titleOf={titleOf} />
            ) : (
              <CardsAndClips t={t} english={english} userId={userId} titleOf={titleOf} />
            )}
          </div>
        </>
      )}
    </section>
  );
}

/** What a card shows: the front, and the back once flipped. */
function faces(flip: Flip, t: T, titleOf: (id: string) => string): [ReactNode, ReactNode] {
  if (flip.kind === 'card')
    return [
      <p key="front" className="rs-text">{flip.card.front}</p>,
      <Fragment key="back">
        <p className="rs-text">{flip.card.back || t('（背面是空的）', '(The back is empty.)')}</p>
        {flip.card.src && (
          <p className="rs-meta">
            {t('来源：', 'From: ')}
            <a href={flip.card.src.href}>{flip.card.src.title || flip.card.src.href}</a>
          </p>
        )}
      </Fragment>,
    ];
  if (flip.kind === 'open') {
    const href = recallHref(flip.key);
    return [
      <Fragment key="front">
        <p className="rs-title">{flip.title || flip.key}</p>
        <p className="rs-meta">{t('先在心里答一遍，再翻面对照参考答案。', 'Answer it in your head first, then flip and check the reference answer.')}</p>
      </Fragment>,
      href ? (
        <p key="back">
          <a href={href} target="_blank" rel="noopener">
            {t('在新标签页打开题目和参考答案', 'Open the question and its reference answer in a new tab')}
          </a>
        </p>
      ) : null,
    ];
  }
  const idea = flip.idea;
  return [
    <Fragment key="front">
      <p className="rs-title">
        <a href={`/?view=problem&problem=${encodeURIComponent(flip.id)}`} target="_blank" rel="noopener">
          {titleOf(flip.id)}
        </a>
      </p>
      {idea?.excerpt && <p className="rs-excerpt">{idea.excerpt}</p>}
      <p className="rs-meta">{t('说出套路、关键观察和复杂度，不用写代码。', 'Name the pattern, the key observation and the complexity. No code.')}</p>
    </Fragment>,
    <dl key="back" className="rs-idea">
      {idea?.hint && (
        <>
          <dt>{t('思路', 'Approach')}</dt>
          <dd>{idea.hint}</dd>
        </>
      )}
      {idea?.takeaway && (
        <>
          <dt>{t('要点', 'Takeaway')}</dt>
          <dd>{idea.takeaway}</dd>
        </>
      )}
      {idea?.complexity && (
        <>
          <dt>{t('复杂度', 'Complexity')}</dt>
          <dd>
            {t('时间', 'Time')} {idea.complexity.time} · {t('空间', 'space')} {idea.complexity.space}
          </dd>
        </>
      )}
      {idea?.stop && STOP_NAMES[idea.stop] && (
        <>
          <dt>{t('Line 500 站', 'Line 500 stop')}</dt>
          <dd>
            <a href={`/topics/${idea.stop}`}>{t(...STOP_NAMES[idea.stop])}</a>
          </dd>
        </>
      )}
      {idea?.note && (
        <>
          <dt>{t('我的笔记', 'My note')}</dt>
          <dd className="rs-text">{idea.note}</dd>
        </>
      )}
      {!idea?.hint && !idea?.takeaway && !idea?.note && <dd>{t('这道题还没有思路要点，翻开题目看看自己的提交。', 'No notes on this one yet: open the problem and look at your submissions.')}</dd>}
    </dl>,
  ];
}

export type Tally = Record<RecallGrade, number>;
const ZERO: Tally = { no: 0, partial: 0, know: 0 };
const counted = (grade: RecallGrade) => (tally: Tally) => ({ ...tally, [grade]: tally[grade] + 1 });
/**
 * A flip deck: Space shows the back, 1/2/3 grade it (didn't know / partly / knew it) through
 * rateRecall into the card's own queue. Keys typed into a field or a dialog are left alone.
 */
export function Deck({
  flips,
  t,
  titleOf,
  onGrade,
  onDone,
}: {
  flips: Flip[];
  t: T;
  titleOf: (id: string) => string;
  onGrade: (grade: RecallGrade) => void;
  onDone: () => void;
}) {
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const flip = flips[at];
  const rate = useCallback(
    async (grade: RecallGrade) => {
      if (!flip || busy) return;
      setBusy(true);
      const saved = await updateRecall(true, (queue) => rateRecall(queue, flip.key, '', grade, mcqDay()), NOTE_OF[flip.kind]);
      setBusy(false);
      setFailed(!saved);
      if (!saved) return;
      onGrade(grade);
      setFlipped(false);
      if (at + 1 < flips.length) setAt(at + 1);
      else onDone();
    },
    [flip, busy, at, flips.length, onGrade, onDone],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || el?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key === ' ' && !flipped) {
        event.preventDefault();
        setFlipped(true);
      } else if (flipped && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        void rate(GRADES[Number(event.key) - 1][0]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, rate]);
  if (!flip) return null;
  const [front, back] = faces(flip, t, titleOf);
  return (
    <div className="rs-deck">
      <p className="rs-count">
        {t(`第 ${at + 1} / ${flips.length} 张`, `Card ${at + 1} of ${flips.length}`)}
        {flip.kind === 'card' && flip.card.tags.length > 0 && <span> · {flip.card.tags.map((tag) => `#${tag}`).join(' ')}</span>}
      </p>
      <article className="rs-card" data-flipped={flipped || undefined}>
        <div className="rs-front">{front}</div>
        {flipped && (
          <div className="rs-back" aria-live="polite">
            {back}
          </div>
        )}
      </article>
      {!flipped ? (
        <Button onClick={() => setFlipped(true)}>
          {t('翻面', 'Show the back')} <kbd>Space</kbd>
        </Button>
      ) : (
        <fieldset className="rs-grades">
          <legend className="sr-only">{t('这张你会了吗？', 'How well did you know it?')}</legend>
          {GRADES.map(([grade, zh, en], i) => (
            <Button key={grade} variant={grade === 'know' ? 'default' : 'outline'} disabled={busy} onClick={() => void rate(grade)}>
              <kbd>{i + 1}</kbd> {t(zh, en)}
            </Button>
          ))}
        </fieldset>
      )}
      {failed && (
        <p className="rs-error" role="alert">
          {t('没能保存这次打分，请再试一次。', "Couldn't save that grade. Try again.")}
        </p>
      )}
    </div>
  );
}

type TodayData = { flips: Flip[]; mcqs: PracticeItem[]; coding: DueReview[] };
function Today({ t, english, titleOf }: { t: T; english: boolean; titleOf: (id: string) => string }) {
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState('');
  const [stage, setStage] = useState(0);
  const [tally, setTally] = useState<Tally>(ZERO);
  const [mcq, setMcq] = useState({ at: 0, picks: [] as number[], shown: false, right: 0, failed: false });
  const [solved, setSolved] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let current = true;
    const today = mcqDay();
    (async () => {
      const [cards, cardQ, ideaQ, openQ, mcqBody, history, prefs] = await Promise.all([
        myCards(),
        loadRecall(true, RECALL_CARDS),
        loadRecall(true, RECALL_IDEAS),
        loadRecall(true),
        note('mcq:answers'),
        api<{ items: PracticeHistoryItem[] }>('oj/history'),
        note('pref:review').catch(() => ''),
      ]);
      const queued = (q: RecallQueue) => dueRecall(q, today).map(([key]) => key);
      // A new card (never graded) is due today; graded ones follow the 1/3/7/21-day boxes.
      const cardFlips: Flip[] = [
        ...queued(cardQ.queue).filter((key) => cards.has(key.slice(5))),
        ...[...cards.keys()].map((id) => `card:${id}`).filter((key) => !cardQ.queue.items[key]),
      ].map((key) => ({ kind: 'card' as const, key, card: cards.get(key.slice(5))! }));
      const ideaIds = queued(ideaQ.queue).map((key) => key.slice(5)).slice(0, IDEAS_MAX);
      const ideas = ideaIds.length ? await ideasOf(ideaIds, english) : new Map<string, Idea>();
      // Problems the server left out (a running contest) are not shown.
      const ideaFlips: Flip[] = ideaIds.filter((id) => ideas.has(id)).map((id) => ({ kind: 'idea' as const, key: `idea:${id}`, id, idea: ideas.get(id) }));
      const openFlips: Flip[] = dueRecall(openQ.queue, today).map(([key, card]) => ({ kind: 'open' as const, key, title: card[2] }));
      const review = parseMcqReview(mcqBody);
      const dueMcq = Object.keys(review)
        .filter((id) => mcqDue(review[id], today))
        .sort((a, b) => review[a][1] - review[b][1])
        .slice(0, MCQ_SESSION);
      const mcqs = dueMcq.length ? await mcqQuestions(dueMcq, english) : [];
      const coding = scheduleReviews(history.items, Date.now(), parseReviewPrefs(prefs)).today;
      if (current) setData({ flips: [...cardFlips, ...ideaFlips, ...openFlips], mcqs, coding });
    })().catch((reason: Error) => current && setError(reason.message || t('加载失败', 'Loading failed')));
    return () => {
      current = false;
    };
  }, [english, t]);
  const stages = data ? (['flip', 'mcq', 'code'] as const).filter((s) => (s === 'flip' ? data.flips : s === 'mcq' ? data.mcqs : data.coding).length) : [];
  const now = stages[stage] ?? 'done';
  // Back from a coding review's tab: today's accepted ones tick off.
  useEffect(() => {
    if (now !== 'code') return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      api<{ items: PracticeHistoryItem[] }>('oj/history')
        .then(({ items }) => {
          const since = midnight();
          setSolved(new Set(items.filter((item) => item.acAt.some((at) => at >= since)).map((item) => item.problemId)));
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, [now]);

  if (error)
    return (
      <p className="rs-error" role="alert">
        {error}
      </p>
    );
  if (!data) return <output className="rs-state">{t('正在加载…', 'Loading…')}</output>;
  const next = () => setStage((s) => s + 1);
  const coded = data.coding.filter((d) => solved.has(d.item.problemId)).length;
  const head = (
    <p className="rs-plan">
      {t(
        `今天到期：卡片 ${data.flips.length} 张 · 选择题 ${data.mcqs.length} 道 · 编程题 ${data.coding.length} 道`,
        `Due today: ${data.flips.length} card${data.flips.length === 1 ? '' : 's'} · ${data.mcqs.length} multiple-choice · ${data.coding.length} coding`,
      )}
    </p>
  );
  if (now === 'flip')
    return (
      <>
        {head}
        <Deck flips={data.flips} t={t} titleOf={titleOf} onGrade={(grade) => setTally(counted(grade))} onDone={next} />
        <p className="rs-skip">
          <button type="button" onClick={next}>
            {t('跳过剩下的卡片', 'Skip the remaining cards')}
          </button>
        </p>
      </>
    );
  if (now === 'mcq') {
    const q = data.mcqs[mcq.at];
    const submit = async () => {
      setMcq((m) => ({ ...m, shown: true }));
      // Read the latest review first, so an answer given on another page meanwhile is kept.
      let ok = false;
      try {
        const review = parseMcqReview(await note('mcq:answers'));
        ok = await putReview({ ...review, [q.id]: reviewMcq(review[q.id], q.answer, mcq.picks, mcqDay()) });
      } catch {}
      setMcq((m) => ({ ...m, right: m.right + Number(mcqRight(q.answer, m.picks)), failed: !ok }));
    };
    return (
      <>
        {head}
        <p className="rs-count">{t(`选择题 ${mcq.at + 1} / ${data.mcqs.length}`, `Question ${mcq.at + 1} of ${data.mcqs.length}`)}</p>
        <McqItem key={q.id} q={q} text={q.text} n={mcq.at + 1} zh={!english} picks={mcq.picks} onPick={(picks) => setMcq((m) => ({ ...m, picks }))} reveal={mcq.shown}>
          <div className="rs-grades">
            {!mcq.shown ? (
              <Button disabled={!mcq.picks.length} onClick={() => void submit()}>
                {t('提交', 'Submit')}
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (mcq.at + 1 < data.mcqs.length) setMcq((m) => ({ ...m, at: m.at + 1, picks: [], shown: false, failed: false }));
                  else next();
                }}
              >
                {mcq.at + 1 < data.mcqs.length ? t('下一题', 'Next question') : t('继续', 'Continue')}
              </Button>
            )}
          </div>
        </McqItem>
        {mcq.failed && (
          <p className="rs-error" role="alert">
            {t('这道题的复习进度没能保存。', "This question's review couldn't be saved.")}
          </p>
        )}
      </>
    );
  }
  if (now === 'code')
    return (
      <>
        {head}
        <p className="rs-meta">
          {t(
            '每道题在新标签页打开，通过后回到这里会自动勾掉。',
            'Each problem opens in a new tab; once it is accepted it ticks off here when you come back.',
          )}
        </p>
        <ul className="rs-list">
          {data.coding.map(({ item }) => (
            <li key={item.problemId} data-done={solved.has(item.problemId) || undefined}>
              <a href={`/?view=problem&problem=${encodeURIComponent(item.problemId)}`} target="_blank" rel="noopener">
                {titleOf(item.problemId)}
              </a>
              <span>{solved.has(item.problemId) ? t('今天已通过', 'Accepted today') : t('待复习', 'To review')}</span>
            </li>
          ))}
        </ul>
        <Button onClick={next}>{coded === data.coding.length ? t('完成', 'Finish') : t('结束复习', 'End the session')}</Button>
      </>
    );
  return (
    <section className="rs-done" aria-labelledby="rs-done-title">
      <h2 id="rs-done-title">{stages.length ? t('今天的复习完成了', "That's today's review") : t('今天没有到期的复习', 'Nothing is due today')}</h2>
      {stages.length > 0 && (
        <ul>
          {data.flips.length > 0 && (
            <li>
              {t(
                `卡片：会了 ${tally.know} · 部分会 ${tally.partial} · 不会 ${tally.no}`,
                `Cards: knew ${tally.know} · partly ${tally.partial} · didn't know ${tally.no}`,
              )}
            </li>
          )}
          {data.mcqs.length > 0 && <li>{t(`选择题：答对 ${mcq.right} / ${data.mcqs.length}`, `Multiple choice: ${mcq.right} of ${data.mcqs.length} right`)}</li>}
          {data.coding.length > 0 && <li>{t(`编程题：今天通过 ${coded} / ${data.coding.length}`, `Coding: ${coded} of ${data.coding.length} accepted today`)}</li>}
        </ul>
      )}
      <p className="rs-meta">
        {t('想多练一会儿？试试「思路速记」，或者在「卡片与摘录」里加几张卡。', 'Want more? Try the idea review, or add a few cards under Cards & excerpts.')}
      </p>
    </section>
  );
}

type Scope = 'all' | 'redo' | 'star' | `stop:${string}`;
function IdeaReview({ t, english, titleOf }: { t: T; english: boolean; titleOf: (id: string) => string }) {
  const [pool, setPool] = useState<{ history: PracticeHistoryItem[]; redo: Set<string>; star: Set<string> } | null>(null);
  const [error, setError] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [flips, setFlips] = useState<Flip[] | null>(null);
  const [tally, setTally] = useState<Tally>(ZERO);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let current = true;
    const marks = (mark: string) =>
      api<{ items: { target: string }[] }>(`oj/marks?mark=${mark}`).then(
        ({ items }) => new Set(items.filter((m) => m.target.startsWith('problem:')).map((m) => m.target.slice(8))),
      );
    Promise.all([api<{ items: PracticeHistoryItem[] }>('oj/history'), marks('redo'), marks('star')])
      .then(([history, redo, star]) => current && setPool({ history: history.items, redo, star }))
      .catch((reason: Error) => current && setError(reason.message));
    return () => {
      current = false;
    };
  }, []);
  if (error)
    return (
      <p className="rs-error" role="alert">
        {error}
      </p>
    );
  if (!pool) return <output className="rs-state">{t('正在加载…', 'Loading…')}</output>;
  const byId = new Map(pool.history.map((h) => [h.problemId, h]));
  const solved = pool.history.filter((h) => h.acAt.length).map((h) => h.problemId);
  const stops = [...new Set(pool.history.flatMap((h) => (h.acAt.length && h.stop && STOP_NAMES[h.stop] ? [h.stop] : [])))];
  const picked = [
    ...new Set(
      scope === 'redo'
        ? pool.redo
        : scope === 'star'
          ? pool.star
          : scope === 'all'
            ? [...solved, ...pool.redo]
            : [...solved, ...pool.redo].filter((id) => byId.get(id)?.stop === scope.slice(5)),
    ),
  ]
    // Marked to redo first, then the longest since last done.
    .sort((a, b) => Number(pool.redo.has(b)) - Number(pool.redo.has(a)) || (byId.get(a)?.lastAt ?? 0) - (byId.get(b)?.lastAt ?? 0));
  async function start() {
    setError('');
    try {
      const ids = picked.slice(0, IDEAS_MAX);
      const ideas = await ideasOf(ids, english);
      setDone(false);
      setTally(ZERO);
      setFlips(ids.filter((id) => ideas.has(id)).map((id) => ({ kind: 'idea' as const, key: `idea:${id}`, id, idea: ideas.get(id) })));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  if (flips?.length && !done)
    return (
      <>
        <Deck flips={flips} t={t} titleOf={titleOf} onGrade={(grade) => setTally(counted(grade))} onDone={() => setDone(true)} />
        <p className="rs-skip">
          <button type="button" onClick={() => setFlips(null)}>
            {t('换个范围', 'Pick another set')}
          </button>
        </p>
      </>
    );
  return (
    <div className="rs-ideas">
      <p className="rs-meta">
        {t(
          '面试前快速过一遍做过的题：看题目和摘要，说出套路、关键观察和复杂度，再翻面对照思路、要点和自己的笔记。打分后按 1、3、7、21 天回到「今日复习」。',
          'Run through problems you have done before an interview: read the title and excerpt, name the pattern, the key observation and the complexity, then flip to check the approach, takeaway and your note. Graded ideas come back in Due today after 1, 3, 7 and 21 days.',
        )}
      </p>
      {done && (
        <p className="rs-plan" role="status">
          {t(`这一轮：会了 ${tally.know} · 部分会 ${tally.partial} · 不会 ${tally.no}`, `This round: knew ${tally.know} · partly ${tally.partial} · didn't know ${tally.no}`)}
        </p>
      )}
      <label className="rs-field">
        {t('范围', 'Set')}
        <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="all">{t('做过的全部（含标记重做）', 'Everything solved (and marked to redo)')}</option>
          <option value="redo">{t('标记重做', 'Marked to redo')}</option>
          <option value="star">{t('收藏', 'Starred')}</option>
          {stops.map((slug) => (
            <option key={slug} value={`stop:${slug}`}>
              {t(`Line 500 · ${STOP_NAMES[slug][0]}`, `Line 500 · ${STOP_NAMES[slug][1]}`)}
            </option>
          ))}
        </select>
      </label>
      <p className="rs-meta">
        {picked.length > IDEAS_MAX
          ? t(`共 ${picked.length} 道，这一轮先过前 ${IDEAS_MAX} 道。`, `${picked.length} problems; this round takes the first ${IDEAS_MAX}.`)
          : t(`共 ${picked.length} 道。`, `${picked.length} problem${picked.length === 1 ? '' : 's'}.`)}
      </p>
      <Button disabled={!picked.length} onClick={() => void start()}>
        {t('开始', 'Start')}
      </Button>
      {flips && !flips.length && <p className="rs-meta">{t('这些题现在不能复习（可能在进行中的比赛里）。', "These can't be reviewed right now (they may be in a running contest).")}</p>}
    </div>
  );
}

/** A saved excerpt's page: the citation its first quote ends with (components/command-palette.tsx clipQuote). */
export function clipSource(body: string) {
  const cite = /— \[([^\]]*)\]\((\/[^)\s]*)\)/.exec(body);
  return cite ? { title: cite[1], href: cite[2] } : null;
}

function ClipEditor({ userId, target, english }: { userId: string; target: string; english: boolean }) {
  const clip = useNote(userId, target);
  return <ProblemNotes note={clip} english={english} />;
}

type Kinds = { cards: boolean; open: boolean; mcq: boolean; ideas: boolean };
function CardsAndClips({ t, english, userId, titleOf }: { t: T; english: boolean; userId: string; titleOf: (id: string) => string }) {
  const [cards, setCards] = useState<Map<string, Card> | null>(null);
  const [queue, setQueue] = useState<RecallQueue | null>(null);
  const [clips, setClips] = useState<{ target: string; body: string; updatedAt: number }[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [clipOpen, setClipOpen] = useState<string | null>(null);
  const [kinds, setKinds] = useState<Kinds>({ cards: true, open: true, mcq: true, ideas: true });
  const [format, setFormat] = useState<'anki' | 'csv'>('anki');
  const [exporting, setExporting] = useState('');
  useEffect(() => {
    let current = true;
    Promise.all([
      myCards(),
      loadRecall(true, RECALL_CARDS),
      api<{ items: { target: string; body: string; updatedAt: number }[] }>(`oj/notes?prefix=${encodeURIComponent('clip:')}`),
    ])
      .then(([mine, q, clipped]) => {
        if (!current) return;
        setCards(mine);
        setQueue(q.queue);
        setClips(clipped.items);
      })
      .catch((reason: Error) => current && setError(reason.message));
    return () => {
      current = false;
    };
  }, []);

  async function exportRows() {
    const rows: ExportRow[] = [];
    const site = location.origin;
    if (kinds.cards)
      for (const card of cards?.values() ?? [])
        rows.push({ front: card.front, back: card.back + (card.src ? `\n\n${site}${card.src.href}` : ''), tags: [...card.tags, 'cswork-card'] });
    if (kinds.open)
      for (const [target, card] of Object.entries((await loadRecall(true)).queue.items)) {
        const href = recallHref(target);
        rows.push({ front: card[2] || target, back: href ? site + href : '', tags: ['cswork-recall'] });
      }
    if (kinds.mcq) {
      const review = parseMcqReview(await note('mcq:answers'));
      const questions = await mcqQuestions(Object.keys(review), english);
      for (const q of questions) {
        if (mcqRight(q.answer, review[q.id].slice(2))) continue;
        const choices = q.text.choices.map((c, j) => `${'ABCDEF'[j]}. ${c}`).join('\n');
        rows.push({
          front: [q.text.q, q.code, choices].filter(Boolean).join('\n\n'),
          back: `${t('答案：', 'Answer: ')}${q.answer.map((a) => 'ABCDEF'[a]).join(', ')}\n\n${q.text.explain}`,
          tags: ['cswork-mcq', q.topic],
        });
      }
    }
    if (kinds.ideas) {
      const history = (await api<{ items: PracticeHistoryItem[] }>('oj/history')).items.filter((h) => h.acAt.length).map((h) => h.problemId);
      const ideas = await ideasOf(history, english);
      for (const [id, idea] of ideas) {
        const back = [
          idea.hint && `${t('思路：', 'Approach: ')}${idea.hint}`,
          idea.takeaway && `${t('要点：', 'Takeaway: ')}${idea.takeaway}`,
          idea.complexity && `${t('复杂度：', 'Complexity: ')}${idea.complexity.time} / ${idea.complexity.space}`,
          idea.note && `${t('笔记：', 'Note: ')}\n${idea.note}`,
        ].filter(Boolean);
        if (!back.length) continue;
        rows.push({ front: `${titleOf(id)} (${id})\n${site}/?view=problem&problem=${encodeURIComponent(id)}`, back: back.join('\n\n'), tags: ['cswork-idea', ...(idea.stop ? [idea.stop] : [])] });
      }
    }
    return rows;
  }
  async function download() {
    setExporting(t('正在整理…', 'Preparing…'));
    try {
      const rows = await exportRows();
      const text = format === 'anki' ? toAnki(rows) : toCsv(rows);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([text], { type: format === 'anki' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8' }));
      link.download = `cswork-review-${new Date().toISOString().slice(0, 10)}.${format === 'anki' ? 'txt' : 'csv'}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
      setExporting(t(`已导出 ${rows.length} 张。`, `Exported ${rows.length} card${rows.length === 1 ? '' : 's'}.`));
    } catch (reason) {
      setExporting((reason as Error).message || t('导出失败，请稍后再试。', 'The export failed. Try again in a moment.'));
    }
  }

  if (error)
    return (
      <p className="rs-error" role="alert">
        {error}
      </p>
    );
  if (!cards || !queue) return <output className="rs-state">{t('正在加载…', 'Loading…')}</output>;
  const today = mcqDay();
  const status = (id: string) => {
    const entry = queue.items[`card:${id}`];
    if (!entry) return t('新卡，今天复习', 'New, due today');
    const back = recallNext(entry);
    if (back === null) return t('已掌握', 'Mastered');
    return back <= today ? t('今天到期', 'Due today') : t(`${recallDate(back, english ? 'en' : 'zh')} 复习`, `Back on ${recallDate(back, english ? 'en' : 'zh')}`);
  };
  const editor = editing !== null && (
    <CardEditor
      id={editing || undefined}
      initial={editing ? cards.get(editing)! : { front: '', back: '' }}
      onClose={() => setEditing(null)}
      onSaved={(id, card) => setCards((m) => new Map(m).set(id, card))}
      onDeleted={(id) =>
        setCards((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        })
      }
    />
  );
  return (
    <div className="rs-manage">
      <section aria-labelledby="rs-cards-title">
        <div className="rs-section-head">
          <h2 id="rs-cards-title">{t(`我的卡片（${cards.size} / ${CARD_MAX}）`, `My cards (${cards.size} of ${CARD_MAX})`)}</h2>
          <Button size="sm" disabled={cards.size >= CARD_MAX} onClick={() => setEditing('')}>
            {t('新建卡片', 'New card')}
          </Button>
        </div>
        {cards.size ? (
          <ul className="rs-list">
            {[...cards].map(([id, card]) => (
              <li key={id}>
                <button type="button" className="rs-link" onClick={() => setEditing(id)}>
                  {card.front}
                </button>
                <span>
                  {[status(id), ...card.tags.map((tag) => `#${tag}`)].join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rs-meta">
            {t(
              '还没有卡片。点「新建卡片」，或在课程、题库、系统设计和知识点页选中文字后点「做成卡片」。',
              'No cards yet. Click New card, or select text on a lesson, library, system design or topic page and click Make a card.',
            )}
          </p>
        )}
      </section>
      <section aria-labelledby="rs-clips-title">
        <h2 id="rs-clips-title">{t('摘录', 'Excerpts')}</h2>
        {clips.length ? (
          <ul className="rs-list">
            {clips.map((clip) => {
              const source = clipSource(clip.body);
              return (
                <li key={clip.target} className="rs-clip">
                  <span className="rs-clip-head">
                    {source ? <a href={source.href}>{source.title || source.href}</a> : <strong>{clip.target.slice(5)}</strong>}
                    <button type="button" className="rs-link" aria-expanded={clipOpen === clip.target} onClick={() => setClipOpen(clipOpen === clip.target ? null : clip.target)}>
                      {clipOpen === clip.target ? t('收起', 'Close') : t('编辑', 'Edit')}
                    </button>
                  </span>
                  {clipOpen === clip.target ? (
                    <ClipEditor userId={userId} target={clip.target} english={english} />
                  ) : (
                    <span className="rs-snippet">
                      {clip.body
                        .replace(/^> — \[.*$/gm, '')
                        .replace(/^> ?/gm, '')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 160)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rs-meta">{t('还没有摘录。在课程、题库、系统设计和知识点页选中文字，点「存到笔记」。', 'No excerpts yet. Select text on a lesson, library, system design or topic page and click Save to notes.')}</p>
        )}
      </section>
      <section aria-labelledby="rs-export-title" className="rs-export">
        <h2 id="rs-export-title">{t('导出到 Anki 或表格', 'Export to Anki or a spreadsheet')}</h2>
        <fieldset>
          <legend>{t('导出哪些', 'What to export')}</legend>
          {(
            [
              ['cards', '自建卡片', 'My cards'],
              ['open', '自评题（标题和链接）', 'Self-graded questions (title and link)'],
              ['mcq', '选择题错题（题干、答案、解析）', 'Missed multiple-choice questions (question, answer, explanation)'],
              ['ideas', '做过的题的思路（链接、思路、要点、笔记）', 'Ideas of solved problems (link, approach, takeaway, note)'],
            ] as const
          ).map(([key, zh, en]) => (
            <label key={key}>
              <input type="checkbox" checked={kinds[key]} onChange={(event) => setKinds({ ...kinds, [key]: event.target.checked })} /> {t(zh, en)}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>{t('格式', 'Format')}</legend>
          <label>
            <input type="radio" name="rs-format" checked={format === 'anki'} onChange={() => setFormat('anki')} />{' '}
            {t('Anki 导入文件（.txt，文件 → 导入）', 'Anki import file (.txt, File → Import)')}
          </label>
          <label>
            <input type="radio" name="rs-format" checked={format === 'csv'} onChange={() => setFormat('csv')} /> CSV
          </label>
        </fieldset>
        <Button disabled={!Object.values(kinds).some(Boolean) || exporting === t('正在整理…', 'Preparing…')} onClick={() => void download()}>
          {t('下载', 'Download')}
        </Button>
        <p className="rs-meta" role="status">
          {exporting}
        </p>
      </section>
      {editor}
    </div>
  );
}
