'use client';
import { useEffect, useRef, useState } from 'react';
import {
  MCQ_MASTERED,
  MCQ_REVIEW_DAYS,
  MCQ_SECTIONS,
  fitMcqReview,
  mcqDay,
  mcqDue,
  mcqRight,
  parseMcqReview,
  reviewMcq,
  type McqQuestion,
  type McqReview,
  type McqSection,
} from '@/lib/mock-oa';
import { NOTE_MAX_BYTES } from '@/lib/practice-review';
import { McqItem, MCQ_SECTION_NAMES, MCQ_TOPIC_NAMES, type McqText } from '@/components/oa-mcq';

/** A question in the page's language only. */
export type PracticeItem = Pick<McqQuestion, 'id' | 'section' | 'topic' | 'code' | 'answer'> & {
  text: McqText;
};
/** A system design chapter's quiz, enough to find its wrong answers: the right choice of each question. */
export type SdQuizKey = { slug: string; title: string; answers: number[] };
type Answers = Record<string, number[]>;
const OLD_KEY = 'cswork:oa-mcq:v1';
const KEY = 'cswork:oa-mcq:v2';
const NOTE = `/api/oj/notes?target=${encodeURIComponent('mcq:answers')}`;

/** Submitted answers by question id, as stored in this browser; anything malformed reads as none. */
export function parseAnswers(raw: string | null): Answers {
  try {
    const value: unknown = JSON.parse(raw || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, picks]) => Array.isArray(picks) && picks.length > 0 && picks.every(Number.isInteger),
      ),
    ) as Answers;
  } catch {
    return {};
  }
}

/** This browser's review; answers saved before spaced review count as answered today. */
function readLocal(items: PracticeItem[]): McqReview {
  try {
    const review = parseMcqReview(localStorage.getItem(KEY));
    const old = parseAnswers(localStorage.getItem(OLD_KEY));
    for (const q of items) if (old[q.id]) review[q.id] ??= reviewMcq(undefined, q.answer, old[q.id], mcqDay());
    return review;
  } catch {
    return {};
  }
}
function writeLocal(review: McqReview) {
  if (Object.keys(review).length) return localStorage.setItem(KEY, JSON.stringify(review));
  localStorage.removeItem(KEY);
  localStorage.removeItem(OLD_KEY);
}
/** Saves the review as the note; an empty body removes it (lib/server/my-practice.ts). */
const putReview = (review: McqReview) =>
  fetch(NOTE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: Object.keys(review).length ? fitMcqReview(review, NOTE_MAX_BYTES) : '' }),
  }).then(
    (response) => response.ok,
    () => false,
  );
/** Wrong answers (1-based) in each chapter quiz; app/system-design/quiz.tsx stores `{ picks }`. */
export function sdMisses(keys: readonly SdQuizKey[], bodies: ReadonlyMap<string, string | null>) {
  return keys.flatMap(({ slug, title, answers }) => {
    try {
      const picks: unknown = JSON.parse(bodies.get(slug) || '{}')?.picks;
      if (!Array.isArray(picks) || picks.length !== answers.length) return [];
      const wrong = answers.flatMap((a, i) => (Number.isInteger(picks[i]) && picks[i] !== a ? [i + 1] : []));
      return wrong.length ? [{ slug, title, wrong }] : [];
    } catch {
      return [];
    }
  });
}

/**
 * OA multiple-choice practice: filter by section and topic, submit a question to see the
 * answer and why. Answered questions come back for review after 1/3/7/21 days (lib/mock-oa.ts
 * reviewMcq). Signed in, the review is the private note `mcq:answers`; signed out it stays in
 * this browser and moves to the account on the next signed-in visit. `sd` adds the system
 * design chapter quizzes' wrong answers to the review filters; `compact` is a short quiz
 * without filters (a topic page).
 */
export function McqPractice({
  items,
  zh,
  sd,
  compact,
}: {
  items: PracticeItem[];
  zh: boolean;
  sd?: SdQuizKey[];
  compact?: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [section, setSection] = useState<McqSection | ''>('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'' | 'wrong' | 'due'>('');
  const [review, setReview] = useState<McqReview>({});
  // This visit only: 'retry' shows an answered question fresh again; 'done' keeps a question
  // just answered in a review filter it no longer matches.
  const [visit, setVisit] = useState<Record<string, 'retry' | 'done'>>({});
  const [drafts, setDrafts] = useState<Answers>({});
  const [where, setWhere] = useState<'loading' | 'account' | 'device'>('loading');
  const [stored, setStored] = useState(true);
  const [saveFailed, setSaveFailed] = useState(false);
  const [sdWrong, setSdWrong] = useState<ReturnType<typeof sdMisses>>([]);
  // Saves go out one at a time, so an older body never lands after a newer one.
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let current = true;
    const local = readLocal(items);
    fetch(NOTE)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const saved = parseMcqReview((await response.json())?.body);
        if (!current) return;
        setWhere('account');
        // Answered while signed out: the account takes them over, on the full page (which
        // knows every question, so nothing in this browser is left behind).
        const moved = compact ? {} : local;
        const merged = { ...moved, ...saved };
        setReview(merged);
        if (Object.keys(moved).length) {
          queue.current = queue.current.then(() => putReview(merged).then((ok) => setSaveFailed(!ok)));
          try {
            writeLocal({});
          } catch {}
        }
        if (!sd?.length) return;
        const notes = await fetch('/api/oj/notes?prefix=sd:').then((r) => (r.ok ? r.json() : null), () => null);
        const rows: { target: string; body: string }[] = Array.isArray(notes?.items) ? notes.items : [];
        if (current) setSdWrong(sdMisses(sd, new Map(rows.map((n) => [n.target.slice(3), n.body]))));
      })
      .catch(() => {
        if (!current) return;
        setWhere('device');
        setReview(local);
        try {
          const bodies = new Map((sd ?? []).map((c) => [c.slug, localStorage.getItem(`cswork:sd-quiz:${c.slug}`)]));
          setSdWrong(sdMisses(sd ?? [], bodies));
        } catch {
          setStored(false);
        }
      });
    return () => {
      current = false;
    };
  }, [items, sd, compact]);

  const keep = (next: McqReview) => {
    setReview(next);
    if (where === 'account') {
      queue.current = queue.current.then(() => putReview(next).then((ok) => setSaveFailed(!ok)));
      return;
    }
    try {
      writeLocal(next);
    } catch {
      setStored(false);
    }
  };
  const today = mcqDay();
  const wrong = (q: PracticeItem) => !!review[q.id] && !mcqRight(q.answer, review[q.id].slice(2));
  const due = (q: PracticeItem) => mcqDue(review[q.id], today);
  const inSection = items.filter((q) => !section || q.section === section);
  const topics = [...new Set(inSection.map((q) => q.topic))];
  const inTopic = inSection.filter((q) => !topic || q.topic === topic);
  const shown = inTopic.filter((q) => !mode || visit[q.id] === 'done' || (mode === 'due' ? due(q) : wrong(q)));
  const answered = shown.filter((q) => review[q.id]);
  const right = answered.filter((q) => !wrong(q)).length;
  const sdCount = sdWrong.reduce((n, c) => n + c.wrong.length, 0);
  const chip = (pressed: boolean, label: string, count: number, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={pressed} onClick={onClick}>
      {label}
      <small>{count}</small>
    </button>
  );
  const show = (next: typeof mode) => {
    setMode(next);
    setVisit({});
  };
  return (
    <>
      {!compact && (
        <div className="oa-mcq-filters">
          <fieldset>
            <legend className="sr-only">{t('题型', 'Section')}</legend>
            {chip(!section, t('全部', 'All'), items.length, () => {
              setSection('');
              setTopic('');
            })}
            {MCQ_SECTIONS.map((s) =>
              chip(section === s, t(...MCQ_SECTION_NAMES[s]), items.filter((q) => q.section === s).length, () => {
                setSection(s);
                setTopic('');
              }),
            )}
          </fieldset>
          <fieldset>
            <legend className="sr-only">{t('知识点', 'Topic')}</legend>
            {chip(!topic, t('全部知识点', 'All topics'), inSection.length, () => setTopic(''))}
            {topics.map((slug) =>
              chip(
                topic === slug,
                MCQ_TOPIC_NAMES[slug] ? t(...MCQ_TOPIC_NAMES[slug]) : slug,
                inSection.filter((q) => q.topic === slug).length,
                () => setTopic(slug),
              ),
            )}
          </fieldset>
          <fieldset>
            <legend className="sr-only">{t('复习', 'Review')}</legend>
            {chip(!mode, t('全部题目', 'Every question'), inTopic.length, () => show(''))}
            {chip(mode === 'wrong', t('只看错题', 'Missed only'), inTopic.filter(wrong).length, () => show('wrong'))}
            {chip(mode === 'due', t('今日复习', 'Due today'), inTopic.filter(due).length + sdCount, () => show('due'))}
          </fieldset>
        </div>
      )}
      <div className="oa-mcq-score">
        <output aria-live="polite">
          {answered.length
            ? t(
                `已答 ${answered.length} / ${shown.length} · 答对 ${right}`,
                `${answered.length} of ${shown.length} answered · ${right} correct`,
              )
            : t(`${shown.length} 道题`, `${shown.length} questions`)}
        </output>
        {!compact && Object.keys(review).length > 0 && (
          <button
            type="button"
            className="oa-mcq-reset"
            onClick={() => {
              keep({});
              setVisit({});
            }}
          >
            {t('清空作答记录', 'Clear my answers')}
          </button>
        )}
      </div>
      {mode && sdWrong.length > 0 && (
        <section className="oa-mcq-sd" aria-labelledby="oa-mcq-sd-title">
          <h2 id="oa-mcq-sd-title">{t('系统设计章节测验里答错的题', 'Missed in system design chapter quizzes')}</h2>
          <ul>
            {sdWrong.map((c) => (
              <li key={c.slug}>
                <a href={`/system-design/${c.slug}#sd-quiz-title`}>{c.title}</a>{' '}
                <small>{c.wrong.map((n) => `Q${n}`).join(zh ? '、' : ', ')}</small>
              </li>
            ))}
          </ul>
          <p>
            {t(
              '回到章节，点「重新作答」把整章测验再做一遍。',
              'Open the chapter and press Start over to take its quiz again.',
            )}
          </p>
        </section>
      )}
      <ol className="oa-mcq-list">
        {shown.map((q, i) => {
          const entry = review[q.id];
          const fresh = visit[q.id] === 'retry' || due(q);
          const revealed = !!entry && !fresh;
          const draft = drafts[q.id] ?? [];
          const back = entry && entry[0] < MCQ_MASTERED ? entry[1] + MCQ_REVIEW_DAYS[entry[0]] - today : 0;
          return (
            <li key={q.id}>
              <McqItem
                q={q}
                text={q.text}
                n={i + 1}
                zh={zh}
                picks={revealed ? entry.slice(2) : draft}
                onPick={(picks) => setDrafts((d) => ({ ...d, [q.id]: picks }))}
                reveal={revealed}
              >
                <div className="oa-mcq-actions">
                  {/* One button that changes label, so focus stays put after submitting. */}
                  <button
                    type="button"
                    className={revealed ? 'is-quiet' : undefined}
                    aria-disabled={(!revealed && (!draft.length || where === 'loading')) || undefined}
                    onClick={() => {
                      if (revealed) {
                        setVisit((v) => ({ ...v, [q.id]: 'retry' }));
                        setDrafts((d) => ({ ...d, [q.id]: [] }));
                      } else if (draft.length && where !== 'loading') {
                        keep({ ...review, [q.id]: reviewMcq(entry, q.answer, draft, today) });
                        setVisit((v) => ({ ...v, [q.id]: 'done' }));
                      }
                    }}
                  >
                    {revealed ? t('重做这题', 'Try again') : t('提交', 'Submit')}
                  </button>
                  {entry && (
                    <small className="oa-mcq-due">
                      {due(q)
                        ? t('今天该复习这题', 'Due for review today')
                        : entry[0] >= MCQ_MASTERED
                          ? t('已掌握', 'Mastered')
                          : t(`${back} 天后复习`, `Back for review in ${back} day${back === 1 ? '' : 's'}`)}
                    </small>
                  )}
                </div>
              </McqItem>
            </li>
          );
        })}
      </ol>
      <p className="oa-mcq-note">
        {!stored
          ? t(
              '浏览器存储不可用，刷新后作答记录会丢失。',
              'Browser storage is unavailable, so your answers will be gone after a reload.',
            )
          : where === 'account'
            ? t(
                '作答记录和复习进度保存在你的账号里。答错的题第二天再出现；答对的隔 3、7、21 天再出现，连续答对就算掌握。',
                'Your answers and review schedule are saved to your account. A missed question comes back the next day; a right one after 3, 7 and 21 days, until it is mastered.',
              )
            : t(
                '作答记录只保存在这台设备的浏览器里；登录后再打开本页，会存进账号。',
                'Your answers stay in this browser on this device; open this page signed in to keep them in your account.',
              )}
        {saveFailed && (
          <span role="alert"> {t('最近一次保存失败，刷新后可能看不到。', 'The last save failed; it may be gone after a reload.')}</span>
        )}
      </p>
    </>
  );
}
