import book from '@/lib/content/track-editorials/book.json';
import core from '@/lib/content/track-editorials/core.json';
import ml from '@/lib/content/track-editorials/ml.json';
import pandas from '@/lib/content/track-editorials/pandas.json';
import rest from '@/lib/content/track-editorials/rest.json';
import sql from '@/lib/content/track-editorials/sql.json';
import type { TrackEditorial } from '@/lib/oj-client';

// Editorials of the non-LeetCode tracks (bk-, sql-, pd-, rest-, core-, ml-). Server-only like the
// Line 500 ones; each approach's code is a verified reference solution, in the languages it has.
const editorials = { ...book, ...core, ...ml, ...pandas, ...rest, ...sql } as Record<string, TrackEditorial>;

/** A track problem's editorial, null when none is written yet. */
export const trackEditorial = (problemId: string) =>
  Object.hasOwn(editorials, problemId) ? editorials[problemId] : null;
