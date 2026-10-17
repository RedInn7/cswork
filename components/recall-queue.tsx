'use client';
import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { MCQ_MASTERED, MCQ_REVIEW_DAYS, mcqDay } from '@/lib/mock-oa';
import { api } from '@/lib/types';
import { RECALL_CARDS, RECALL_IDEAS, dropMastered, dueRecall, recallBoxes, recallHref, recallNext, type RecallQueue as Queue } from '@/lib/recall';
import { loadRecall, recallDate, updateRecall } from './recall-rate';
import { Button } from './ui/button';
import type { Navigate } from './learning';
import '@/app/learner-cloud.css';

/** The learner's self-graded cards and how many are due today; null until loaded. */
export function useRecallQueue(signedIn: boolean) {
  const [queue, setQueue] = useState<Queue | null>(null);
  useEffect(() => {
    let current = true;
    void loadRecall(signedIn).then((loaded) => current && setQueue(loaded.queue));
    return () => {
      current = false;
    };
  }, [signedIn]);
  return { queue, setQueue, due: queue ? dueRecall(queue, mcqDay()).length : 0 };
}

/**
 * My progress → Due for review: open questions graded with "knew it / partly / didn't"
 * (components/recall-rate.tsx) that are due today, linked back to their question, with the
 * cards per box. Mastered cards can be cleared. Nothing shows without cards.
 */
export function RecallQueue({
  recall: { queue, setQueue },
  signedIn,
  navigate,
  english,
}: {
  recall: ReturnType<typeof useRecallQueue>;
  signedIn: boolean;
  navigate: Navigate;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [failed, setFailed] = useState(false);
  if (!queue || !Object.keys(queue.items).length) return null;
  const today = mcqDay();
  const due = dueRecall(queue, today);
  const boxes = recallBoxes(queue);
  const upcoming = Object.values(queue.items).flatMap((card) => recallNext(card) ?? []);
  const soonest = upcoming.length ? Math.min(...upcoming) : null;
  return (
    <section className="cloud-mocks recall-queue" aria-labelledby="recall-queue-title">
      <div className="cloud-head">
        <h2 id="recall-queue-title">{t('开放题自评复习', 'Self-graded questions')}</h2>
        <p>
          {MCQ_REVIEW_DAYS.map((days, box) => t(`${days} 天格 `, `${days}-day box `) + boxes[box]).join(' · ')}
          {' · '}
          {t('已掌握 ', 'Mastered ')}
          <b>{boxes[MCQ_MASTERED]}</b>
        </p>
        {boxes[MCQ_MASTERED] > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void updateRecall(signedIn, dropMastered).then((next) => {
                setFailed(!next);
                if (next) setQueue(next);
              })
            }
          >
            {t(`清空已掌握（${boxes[MCQ_MASTERED]}）`, `Clear mastered (${boxes[MCQ_MASTERED]})`)}
          </Button>
        )}
      </div>
      {failed && (
        <p className="recall-none" role="alert">
          {t('没能保存，请稍后再试。', "Couldn't save. Try again in a moment.")}
        </p>
      )}
      {due.length ? (
        <ul className="study-list progress-list">
          {due.map(([target, card]) => {
            const href = recallHref(target) ?? '/';
            const content = href.startsWith('/?') ? new URLSearchParams(href.slice(2)) : null;
            const late = today - card[1] - MCQ_REVIEW_DAYS[card[0]];
            return (
              <li key={target}>
                <a
                  className="study-row progress-row"
                  href={href}
                  onClick={(event) => {
                    // A content question opens in the app; modified clicks and chapters are plain links.
                    if (!content || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    navigate('content', { type: content.get('type') ?? '', slug: content.get('slug') ?? '' });
                  }}
                >
                  <span className="study-progress">
                    <MessageSquareText size={16} aria-hidden="true" />
                  </span>
                  <span className="study-row-main">
                    <strong>{card[2] || target}</strong>
                    <span className="study-row-secondary progress-detail">
                      {[
                        t(`第 ${card[0] + 1}/${MCQ_MASTERED} 次复习`, `Review ${card[0] + 1} of ${MCQ_MASTERED}`),
                        late > 0 ? t(`逾期 ${late} 天`, `${late} day${late > 1 ? 's' : ''} overdue`) : t('今天到期', 'Due today'),
                      ].join(' · ')}
                    </span>
                  </span>
                  <span className="study-level">{content ? t('题库', 'Library') : t('系统设计', 'System design')}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="recall-none">
          {t('今天没有到期的自评题。', 'No self-graded questions due today.')}
          {soonest !== null &&
            t(`下一道在 ${recallDate(soonest, 'zh')}。`, ` The next one is due ${recallDate(soonest, 'en')}.`)}
        </p>
      )}
    </section>
  );
}

/**
 * My progress → Due for review: the way into the review session (components/review-session.tsx),
 * saying how many self-made cards and problem ideas it has due, counted as the session does: a
 * card never graded is due, a graded one follows its box.
 */
export function ReviewSessionLink({ signedIn, navigate, english }: { signedIn: boolean; navigate: Navigate; english: boolean }) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [due, setDue] = useState(0);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    const today = mcqDay();
    void Promise.all([
      loadRecall(true, RECALL_CARDS),
      loadRecall(true, RECALL_IDEAS),
      api<{ items: { target: string }[] }>(`oj/notes?prefix=${encodeURIComponent('card:')}`),
    ])
      .then(([cards, ideas, { items }]) => {
        const graded = new Set(dueRecall(cards.queue, today).map(([key]) => key));
        const n = items.filter(({ target }) => !cards.queue.items[target] || graded.has(target)).length;
        if (current) setDue(n + dueRecall(ideas.queue, today).length);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [signedIn]);
  return (
    <p className="recall-none">
      {/* oxlint-disable-next-line next/no-html-link-for-pages -- an SPA view of the home page. */}
      <a
        href="/?view=review-session"
        onClick={(event) => {
          if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          navigate('review-session');
        }}
      >
        {due
          ? t(`另有 ${due} 张卡到期 → 今日复习`, `${due} more card${due > 1 ? 's' : ''} due → Review session`)
          : t('开始今日复习：卡片、选择题和编程题放在一个队列里 →', 'Start the review session: cards, multiple-choice and coding in one queue →')}
      </a>
    </p>
  );
}
