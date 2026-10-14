import catalog from '@/content/interview-catalog.json';
import { sqlite } from '@/db/sqlite';
import type { Person } from './auth';
import { liveLesson } from './lms-common';
import { HttpError } from './http';
import { studyProgress } from './practice-progress';

/** Read-only projection of the same active round used by the problem library. */
export async function getKnowledgeProgress(person: Person, lessonId: string) {
  const chapter = catalog.find((entry) => entry.id === lessonId);
  if (!chapter) throw new HttpError(404, '知识点不存在');
  await liveLesson(person, lessonId);
  const db = sqlite();
  return db.transaction(() => {
    const currentRound = db
      .prepare(
        'SELECT id,number FROM practice_rounds WHERE user_id=? AND active=1',
      )
      .get(person.id) as { id: string; number: number } | undefined;
    const ids = chapter.homeworkProblemIds;
    const practice = studyProgress(person.id, currentRound?.id ?? null);
    const records = db
      .prepare(
        `SELECT l.id AS library_id,l.judge_problem_id AS id,l.number,l.title_zh AS title,l.difficulty,
      EXISTS(SELECT 1 FROM oj_problems p WHERE p.id=l.judge_problem_id AND p.published=1 AND l.verified_hash=l.content_hash || ':' || p.current_version_id) AS available,
      EXISTS(SELECT 1 FROM submissions s WHERE s.user_id=? AND s.problem_id=l.judge_problem_id AND s.mode='judge' AND s.practice_round_id IS ? AND s.status='accepted') AS solved,
      EXISTS(SELECT 1 FROM submissions s WHERE s.user_id=? AND s.problem_id=l.judge_problem_id AND s.mode='judge' AND s.practice_round_id IS ?) AS attempted,
      EXISTS(SELECT 1 FROM submissions s WHERE s.user_id=? AND s.problem_id=l.judge_problem_id AND s.mode='judge' AND s.practice_round_id IS ? AND s.status IN ('pending','submitting','queued','compiling','running','judging','processing')) AS judging
      FROM study_library l WHERE l.judge_problem_id IN (SELECT value FROM json_each(?))`,
      )
      .all(
        person.id,
        currentRound?.id ?? null,
        person.id,
        currentRound?.id ?? null,
        person.id,
        currentRound?.id ?? null,
        JSON.stringify(ids),
      ) as {
      id: string;
      library_id: string;
      number: number;
      title: string;
      difficulty: string;
      available: number;
      solved: number;
      attempted: number;
      judging: number;
    }[];
    const notes =
      (chapter as typeof chapter & { homeworkNotes?: Record<string, string> })
        .homeworkNotes ?? {};
    const items = ids.map((id) => {
      const record = records.find((row) => row.id === id);
      return {
        id,
        number: record?.number ?? Number(id.slice(3)),
        title: record?.title ?? '题目暂不可用',
        difficulty: record?.difficulty ?? '',
        hint: notes[id] ?? '',
        available: Boolean(record?.available),
        judging: Boolean(record?.judging),
        importedSources: record
          ? (practice.get(record.library_id)?.importedSources ?? [])
          : [],
        status: record?.solved
          ? ('solved' as const)
          : record?.attempted
            ? ('attempted' as const)
            : ('not_started' as const),
      };
    });
    return {
      lessonId,
      currentRound: currentRound ?? { id: null, number: 1 },
      completed: items.filter((item) => item.status === 'solved').length,
      importedCompleted: items.filter((item) => item.importedSources.length > 0)
        .length,
      total: items.length,
      items,
    };
  })();
}
