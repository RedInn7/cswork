'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '@/lib/types';
import '@/app/course-rating.css';

type Rating = { avg: number | null; count: number; mine: number | null; canRate: boolean };
/** Arrow keys check every radio on the way: only the pick that stays this long is saved. */
export const RATING_SAVE_DELAY = 600;

/** "★4.6 (23)": shown once a course has enough ratings for an average (lib/server/course-ratings.ts). */
export function RatingSummary({ avg, count, zh }: { avg?: number | null; count?: number; zh: boolean }) {
  if (avg === null || avg === undefined || !count) return null;
  return (
    <span className="course-rating-summary">
      <span aria-hidden="true">★{avg.toFixed(1)}</span> <span aria-hidden="true">({count})</span>
      {/* Read as text: a plain span's aria-label is ignored by screen readers. */}
      <span className="sr-only">{zh ? `平均 ${avg} 星，${count} 人评分` : `${avg} out of 5 stars from ${count} ratings`}</span>
    </span>
  );
}

/**
 * The course's average and, for a verified learner who has started it, their own 1–5 stars.
 * Stars only: no review text. A pick is saved once it settles (RATING_SAVE_DELAY).
 */
export function CourseRating({ courseId, zh }: { courseId: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const name = useId();
  const [rating, setRating] = useState<Rating | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    let live = true;
    api<Rating>(`course-ratings?course=${encodeURIComponent(courseId)}`).then(
      (value) => live && setRating(value),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [courseId]);
  if (!rating) return null;
  const rate = async (stars: number) => {
    try {
      setRating(await api<Rating>('course-ratings', { course: courseId, stars }));
      setStatus(t('评分已保存', 'Rating saved'));
    } catch (e) {
      setStatus((e as Error).message);
    }
    setPick(null);
  };
  const choose = (stars: number) => {
    setPick(stars);
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void rate(stars), RATING_SAVE_DELAY);
  };
  return (
    <div className="course-rating">
      <RatingSummary avg={rating.avg} count={rating.count} zh={zh} />
      {rating.canRate && (
        <fieldset className="course-rating-stars">
          <legend>{rating.mine ? t('你的评分', 'Your rating') : t('给这门课打分', 'Rate this course')}</legend>
          {[1, 2, 3, 4, 5].map((stars) => (
            <label key={stars} className="course-rating-star">
              <input
                type="radio"
                name={name}
                value={stars}
                checked={(pick ?? rating.mine) === stars}
                onChange={() => choose(stars)}
              />
              <span aria-hidden="true" className="course-rating-glyph" />
              <span className="sr-only">{t(`${stars} 星`, `${stars} star${stars === 1 ? '' : 's'}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <output className="course-rating-status">{status}</output>
    </div>
  );
}
