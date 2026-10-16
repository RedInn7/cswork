import { sqlite } from '@/db/sqlite';
import { curatedByNumber } from '@/lib/ling-curated';
import { firstParagraph, speedrunRound, type SpeedrunPoolItem } from '@/lib/speedrun';
import type { Person } from './auth';
import { json, limitReader } from './http';
import { getStudySourceStatement } from './study-library';

/** Judgeable Line 500 problems: the `ready` test of lib/server/study-library.ts. */
export function speedrunPool(): SpeedrunPoolItem[] {
  const rows = sqlite()
    .prepare(
      `SELECT l.number, l.title_zh AS titleZh, l.title_en AS titleEn, l.judge_problem_id AS id
       FROM study_library l JOIN oj_problems p ON p.id=l.judge_problem_id
       WHERE p.published=1 AND l.verified_hash=l.content_hash || ':' || p.current_version_id`,
    )
    .all() as { number: number; titleZh: string; titleEn: string; id: string }[];
  return rows.flatMap((row) => {
    const entry = curatedByNumber.get(row.number);
    return entry
      ? [{ ...row, section: entry.sectionSlug, reason: entry.reason, reasonEn: entry.reasonEn }]
      : [];
  });
}

/** GET /api/oj/speedrun: one round. Titles and reasons are public (the Line 500 list shows
 * them); statement excerpts need an account, like the Line 500 detail (GET /api/oj/library/<id>). */
export async function handleSpeedrun(request: Request, p: Person | null) {
  await limitReader(request, p, 'speedrun-read', 60);
  const questions = speedrunRound(speedrunPool()).map((q) => {
    const source = p ? getStudySourceStatement(q.id) : null;
    return source
      ? {
          ...q,
          excerptZh: firstParagraph(source.descriptionZh),
          excerptEn: firstParagraph(source.descriptionEn),
        }
      : q;
  });
  return json({ questions });
}
