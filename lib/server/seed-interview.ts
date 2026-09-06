import { sqlite } from '@/db/sqlite';

export const INTERVIEW_COURSE_ID = 'sde-interview-foundations';
type Chapter = {
  id: string;
  title: string;
  summary: string;
  section: string;
  position: number;
};

/** Install once atomically; subsequent boots preserve all instructor edits. */
export function seedInterview(
  chapters: Chapter[],
  bodies: Record<string, string>,
) {
  const db = sqlite();
  if (db.prepare('SELECT id FROM courses WHERE id=?').get(INTERVIEW_COURSE_ID))
    return;
  for (const chapter of chapters) {
    if (!bodies[`/content/lectures/${chapter.id}.md`]?.trim())
      throw new Error(`Missing interview chapter: ${chapter.id}`);
  }
  db.transaction(() => {
    // Another process may have installed the course while we waited for the lock.
    if (
      db.prepare('SELECT id FROM courses WHERE id=?').get(INTERVIEW_COURSE_ID)
    )
      return;
    const now = Date.now();
    db.prepare(
      'INSERT INTO courses(id,title,summary,version,published,position) VALUES(?,?,?,?,1,1)',
    ).run(
      INTERVIEW_COURSE_ID,
      '北美 SDE 面试 · 算法知识图解',
      '从核心原理、交互演示到例题与课后训练，建立能讲清楚、写正确、验证边界的解题能力。',
      '1.0.0',
    );
    for (const chapter of chapters) {
      const body = bodies[`/content/lectures/${chapter.id}.md`];
      db.prepare(
        'INSERT INTO lessons(id,course_id,title,summary,section,position,body,version,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
      ).run(
        chapter.id,
        INTERVIEW_COURSE_ID,
        chapter.title,
        chapter.summary,
        chapter.section,
        chapter.position,
        body,
        '1.0.0',
        now,
      );
      db.prepare(
        'INSERT INTO revisions(id,lesson_id,version,body,created_at) VALUES(?,?,?,?,?)',
      ).run(`initial:${chapter.id}`, chapter.id, '1.0.0', body, now);
    }
  }).immediate();
}
