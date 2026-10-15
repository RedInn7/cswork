'use client';
import { useEffect, useState } from 'react';
import { MCQ_SECTIONS, mcqRight, type McqQuestion, type McqSection } from '@/lib/mock-oa';
import { McqItem, MCQ_SECTION_NAMES, MCQ_TOPIC_NAMES, type McqText } from '@/components/oa-mcq';

/** A question in the page's language only. */
export type PracticeItem = Pick<McqQuestion, 'id' | 'section' | 'topic' | 'code' | 'answer'> & {
  text: McqText;
};
type Answers = Record<string, number[]>;
const KEY = 'cswork:oa-mcq:v1';

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

/**
 * OA multiple-choice practice: filter by section and topic, submit a question to see the
 * answer and why. Submitted answers stay in this browser only.
 */
export function McqPractice({ items, zh }: { items: PracticeItem[]; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const [section, setSection] = useState<McqSection | ''>('');
  const [topic, setTopic] = useState('');
  const [done, setDone] = useState<Answers>({});
  const [drafts, setDrafts] = useState<Answers>({});
  const [stored, setStored] = useState(true);
  useEffect(() => {
    try {
      // After mount, so the server and first client render agree (no storage on the server).
      // oxlint-disable-next-line react/react-compiler -- one read of browser storage per mount.
      setDone(parseAnswers(localStorage.getItem(KEY)));
    } catch {
      setStored(false);
    }
  }, []);
  const keep = (next: Answers) => {
    setDone(next);
    try {
      if (Object.keys(next).length) localStorage.setItem(KEY, JSON.stringify(next));
      else localStorage.removeItem(KEY);
    } catch {
      setStored(false);
    }
  };
  const inSection = items.filter((q) => !section || q.section === section);
  const topics = [...new Set(inSection.map((q) => q.topic))];
  const shown = inSection.filter((q) => !topic || q.topic === topic);
  const answered = shown.filter((q) => done[q.id]);
  const right = answered.filter((q) => mcqRight(q.answer, done[q.id])).length;
  const chip = (pressed: boolean, label: string, count: number, onClick: () => void) => (
    <button key={label} type="button" aria-pressed={pressed} onClick={onClick}>
      {label}
      <small>{count}</small>
    </button>
  );
  return (
    <>
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
      </div>
      <div className="oa-mcq-score">
        <output aria-live="polite">
          {answered.length
            ? t(
                `已答 ${answered.length} / ${shown.length} · 答对 ${right}`,
                `${answered.length} of ${shown.length} answered · ${right} correct`,
              )
            : t(`${shown.length} 道题`, `${shown.length} questions`)}
        </output>
        {Object.keys(done).length > 0 && (
          <button type="button" className="oa-mcq-reset" onClick={() => keep({})}>
            {t('清空作答记录', 'Clear my answers')}
          </button>
        )}
      </div>
      <ol className="oa-mcq-list">
        {shown.map((q, i) => {
          const submitted = done[q.id];
          const draft = drafts[q.id] ?? [];
          return (
            <li key={q.id}>
              <McqItem
                q={q}
                text={q.text}
                n={i + 1}
                zh={zh}
                picks={submitted ?? draft}
                onPick={(picks) => setDrafts((d) => ({ ...d, [q.id]: picks }))}
                reveal={!!submitted}
              >
                <div className="oa-mcq-actions">
                  {/* One button that changes label, so focus stays put after submitting. */}
                  <button
                    type="button"
                    className={submitted ? 'is-quiet' : undefined}
                    aria-disabled={(!submitted && !draft.length) || undefined}
                    onClick={() => {
                      if (submitted) {
                        keep(Object.fromEntries(Object.entries(done).filter(([id]) => id !== q.id)));
                        setDrafts((d) => ({ ...d, [q.id]: [] }));
                      } else if (draft.length) keep({ ...done, [q.id]: draft });
                    }}
                  >
                    {submitted ? t('重做这题', 'Try again') : t('提交', 'Submit')}
                  </button>
                </div>
              </McqItem>
            </li>
          );
        })}
      </ol>
      <p className="oa-mcq-note">
        {stored
          ? t(
              '作答记录只保存在这台设备的浏览器里，不会上传。',
              'Your answers stay in this browser on this device and are never uploaded.',
            )
          : t(
              '浏览器存储不可用，刷新后作答记录会丢失。',
              'Browser storage is unavailable, so your answers will be gone after a reload.',
            )}
      </p>
    </>
  );
}
