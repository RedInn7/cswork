import { sqlite } from '@/db/sqlite';
import { ICA_LEVELS, icaProblemId } from '@/lib/ai-coding';
import { icaTask } from './ai-tasks';

/**
 * ICA practice progress (/oa/ica): no table of its own. A level is passed once this learner has an
 * accepted project run on it; level n is open once level n−1 is passed. A run's report comes from the
 * learner's own process (lib/server/oj-engine.ts), so a forged one only opens the next statement early.
 */
export function icaPassed(userId: string | null, slug: string): number[] {
  if (!userId) return [];
  const levels = Array.from({ length: ICA_LEVELS }, (_, i) => i + 1);
  const rows = sqlite()
    .prepare(
      `SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='project' AND status='accepted' AND problem_id IN (${levels.map(() => '?').join()})`,
    )
    .all(userId, ...levels.map((n) => icaProblemId(slug, n))) as { problem_id: string }[];
  const ids = new Set(rows.map((r) => r.problem_id));
  return levels.filter((n) => ids.has(icaProblemId(slug, n)));
}

export function icaUnlocked(passed: number[]) {
  let level = 1;
  while (level < ICA_LEVELS && passed.includes(level)) level++;
  return level;
}

/** What a learner may read of a set: the statements and public tests of open levels only; never hidden tests. */
export function icaView(userId: string | null, slug: string) {
  const task = icaTask(slug);
  if (!task) return null;
  const passed = icaPassed(userId, slug);
  const unlocked = icaUnlocked(passed);
  return {
    slug: task.slug,
    passed,
    unlocked,
    levels: task.levels.slice(0, unlocked).map((level, i) => ({
      level: i + 1,
      statement: { zh: level.zh, en: level.en },
      tests: level.tests,
      // Hidden tests a run of this level counts: its own and every earlier level's.
      hiddenTotal: task.levels.slice(0, i + 1).reduce((n, l) => n + l.hiddenTotal, 0),
    })),
  };
}
export type IcaView = NonNullable<ReturnType<typeof icaView>>;
