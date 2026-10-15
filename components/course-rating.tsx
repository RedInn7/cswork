'use client';
import { useEffect, useId, useState } from 'react';
import { api } from '@/lib/types';
import '@/app/course-rating.css';

type Rating = { avg: number | null; count: number; mine: number | null; canRate: boolean };

/** "★4.6 (23)": shown once a course has enough ratings for an average (lib/server/course-ratings.ts). */
export function RatingSummary({ avg, count, zh }: { avg?: number | null; count?: number; zh: boolean }) {
  if (avg === null || avg === undefined || !count) return null;
  return (
    <span className="course-rating-summary" aria-label={zh ? `平均 ${avg} 星，${count} 人评分` : `${avg} out of 5 stars from ${count} ratings`}>
      <span aria-hidden="true">★{avg.toFixed(1)}</span> <span aria-hidden="true">({count})</span>
    </span>
  );
}

/**
 * The course's average and, for a verified learner who has started it, their own 1–5 stars.
 * Stars only: no review text. Changing the pick saves it at once.
 */
export function CourseRating({ courseId, zh }: { courseId: string; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const name = useId();
  const [rating, setRating] = useState<Rating | null>(null);
  const [status, setStatus] = useState('');
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
    setStatus('');
    try {
      setRating(await api<Rating>('course-ratings', { course: courseId, stars }));
      setStatus(t('评分已保存', 'Rating saved'));
    } catch (e) {
      setStatus((e as Error).message);
    }
  };
  return (
    <div className="course-rating">
      <RatingSummary avg={rating.avg} count={rating.count} zh={zh} />
      {rating.canRate && (
        <fieldset className="course-rating-stars">
          <legend>{rating.mine ? t('你的评分', 'Your rating') : t('给这门课打分', 'Rate this course')}</legend>
          {/* Highest first in the DOM so CSS can light a star and every one before it. */}
          {[5, 4, 3, 2, 1].map((stars) => (
            <label key={stars} className="course-rating-star">
              <input
                type="radio"
                name={name}
                value={stars}
                checked={rating.mine === stars}
                onChange={() => void rate(stars)}
              />
              <span aria-hidden="true">★</span>
              <span className="sr-only">{t(`${stars} 星`, `${stars} star${stars === 1 ? '' : 's'}`)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <span className="course-rating-status" role="status">
        {status}
      </span>
    </div>
  );
}
