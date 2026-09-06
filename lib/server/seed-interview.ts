import { sqlite } from '@/db/sqlite';
import { createHash } from 'node:crypto';
import previousHashes from '@/content/interview-v1-hashes.json';

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
  if (
    db.prepare('SELECT id FROM courses WHERE id=?').get(INTERVIEW_COURSE_ID)
  ) {
    upgradeInterview(chapters, bodies, previousHashes);
    return;
  }
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
      '数组、字符串、搜索、图与动态规划。每篇包含推导、图解、代码和可判题练习。',
      '2.0.0',
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
        '2.0.0',
        now,
      );
      db.prepare(
        'INSERT INTO revisions(id,lesson_id,version,body,created_at) VALUES(?,?,?,?,?)',
      ).run(`initial:${chapter.id}`, chapter.id, '2.0.0', body, now);
    }
  }).immediate();
}

/** Upgrade only the original, unedited v1 package; keep learner progress and CMS edits. */
export function upgradeInterview(
  chapters: Chapter[],
  bodies: Record<string, string>,
  expectedHashes: Record<string, string>,
) {
  const db = sqlite();
  const course = db
    .prepare('SELECT version FROM courses WHERE id=?')
    .get(INTERVIEW_COURSE_ID) as { version: string } | undefined;
  if (course?.version !== '1.0.0') return;
  for (const chapter of chapters) {
    if (!bodies[`/content/lectures/${chapter.id}.md`]?.trim())
      throw new Error(`Missing interview chapter: ${chapter.id}`);
  }
  db.transaction(() => {
    const version = db
      .prepare('SELECT version FROM courses WHERE id=?')
      .get(INTERVIEW_COURSE_ID) as { version: string };
    if (version.version !== '1.0.0') return;
    const now = Date.now();
    for (const chapter of chapters) {
      const current = db
        .prepare(
          'SELECT body,version,revision FROM lessons WHERE id=? AND course_id=?',
        )
        .get(chapter.id, INTERVIEW_COURSE_ID) as
        | { body: string; version: string; revision: number }
        | undefined;
      if (
        !current ||
        current.version !== '1.0.0' ||
        current.revision !== 1 ||
        createHash('sha256').update(current.body).digest('hex') !==
          expectedHashes[chapter.id]
      )
        continue;
      const body = bodies[`/content/lectures/${chapter.id}.md`];
      db.prepare(
        'INSERT INTO revisions(id,lesson_id,version,body,created_at) VALUES(?,?,?,?,?)',
      ).run(`interview-v2:${chapter.id}`, chapter.id, '2.0.0', body, now);
      db.prepare(
        "UPDATE lessons SET body=?,version='2.0.0',revision=revision+1,updated_at=? WHERE id=?",
      ).run(body, now, chapter.id);
    }
    db.prepare(
      "UPDATE courses SET version='2.0.0',revision=revision+1 WHERE id=?",
    ).run(INTERVIEW_COURSE_ID);
    db.prepare('UPDATE courses SET summary=? WHERE id=? AND summary=?').run(
      '数组、字符串、搜索、图与动态规划。每篇包含推导、图解、代码和可判题练习。',
      INTERVIEW_COURSE_ID,
      '从核心原理、交互演示到例题与课后训练，建立能讲清楚、写正确、验证边界的解题能力。',
    );
  }).immediate();
}
