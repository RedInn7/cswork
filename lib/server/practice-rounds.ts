import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import { curatedEntries } from '@/lib/ling-curated';
import { HttpError } from './http';
const selectedNumbers = JSON.stringify(curatedEntries.map((e) => e.number));
export function isSelectedProblem(problemId: string) {
  return Boolean(
    sqlite()
      .prepare(
        'SELECT 1 FROM study_library WHERE judge_problem_id=? AND number IN (SELECT value FROM json_each(?))',
      )
      .get(problemId, selectedNumbers),
  );
}
// Call inside the submission transaction as well: a queued verdict retains its original round.
export function ensurePracticeRound(userId: string): string {
  const db = sqlite();
  return db.transaction(() => {
    const active = db
      .prepare('SELECT id FROM practice_rounds WHERE user_id=? AND active=1')
      .get(userId) as { id: string } | undefined;
    if (active) return active.id;
    const id = randomUUID();
    db.prepare(
      'INSERT INTO practice_rounds(id,user_id,number,created_at,active) VALUES(?,?,1,?,1)',
    ).run(id, userId, Date.now());
    // Legacy imports before the user's first visit belong to round one only.
    db.prepare(
      `UPDATE submissions SET practice_round_id=? WHERE user_id=? AND practice_round_id IS NULL AND mode='judge'
      AND problem_id IN (SELECT judge_problem_id FROM study_library WHERE number IN (SELECT value FROM json_each(?)))`,
    ).run(id, userId, selectedNumbers);
    return id;
  })();
}
export function practiceRoundState(userId: string) {
  const activeRoundId = ensurePracticeRound(userId);
  const rounds = sqlite()
    .prepare(
      `SELECT r.id,r.number,r.created_at AS createdAt,
    (SELECT COUNT(DISTINCT s.problem_id) FROM submissions s WHERE s.practice_round_id=r.id AND s.user_id=r.user_id AND s.mode='judge' AND s.status='accepted'
      AND s.problem_id IN (SELECT judge_problem_id FROM study_library WHERE number IN (SELECT value FROM json_each(?)))) AS solved
    FROM practice_rounds r WHERE r.user_id=? ORDER BY r.number`,
    )
    .all(selectedNumbers, userId) as {
    id: string;
    number: number;
    createdAt: number;
    solved: number;
  }[];
  const current = rounds.find((r) => r.id === activeRoundId)!;
  return {
    rounds,
    activeRoundId,
    currentRound: {
      id: current.id,
      number: current.number,
      createdAt: current.createdAt,
    },
  };
}
const command = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('create'),
      idempotencyKey: z.string().regex(/^[a-zA-Z0-9_-]{16,100}$/),
    })
    .strict(),
  z
    .object({
      action: z.literal('activate'),
      roundId: z.string().min(1).max(100),
    })
    .strict(),
]);
export function changePracticeRound(userId: string, value: unknown) {
  const data = command.parse(value),
    db = sqlite();
  return db.transaction(() => {
    ensurePracticeRound(userId);
    let id: string;
    if (data.action === 'activate') {
      const row = db
        .prepare('SELECT id FROM practice_rounds WHERE user_id=? AND id=?')
        .get(userId, data.roundId) as { id: string } | undefined;
      if (!row) throw new HttpError(404, '刷题轮次不存在');
      id = row.id;
    } else {
      const prior = db
        .prepare(
          'SELECT id FROM practice_rounds WHERE user_id=? AND idempotency_key=?',
        )
        .get(userId, data.idempotencyKey) as { id: string } | undefined;
      // A replay must not undo a later explicit round switch.
      if (prior) return practiceRoundState(userId);
      const { number } = db
        .prepare(
          'SELECT MAX(number)+1 AS number FROM practice_rounds WHERE user_id=?',
        )
        .get(userId) as { number: number };
      id = randomUUID();
      db.prepare(
        'INSERT INTO practice_rounds(id,user_id,number,created_at,active,idempotency_key) VALUES(?,?,?,?,0,?)',
      ).run(id, userId, number, Date.now(), data.idempotencyKey);
    }
    db.prepare(
      'UPDATE practice_rounds SET active=0 WHERE user_id=? AND active=1',
    ).run(userId);
    db.prepare(
      'UPDATE practice_rounds SET active=1 WHERE user_id=? AND id=?',
    ).run(userId, id);
    return practiceRoundState(userId);
  })();
}
