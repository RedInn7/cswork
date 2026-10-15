import { sqlite } from '@/db/sqlite';
import { duelBand, roomWeek, START_RATING } from '@/lib/contest';

/** A learner's rated weeklies and starters, oldest first: the profile's rating curve and contest badges. */
export function ratingHistory(userId: string) {
  return (
    sqlite()
      .prepare(
        `SELECT c.id,c.kind,c.starts_at AS at,r.before,r.after,r.rank,r.entrants,r.solved,c.problem_ids_json AS ids
        FROM contest_ratings r JOIN contest_rooms c ON c.id=r.room_id WHERE r.user_id=? ORDER BY c.starts_at`,
      )
      .all(userId) as {
      id: string;
      kind: 'weekly' | 'starter';
      at: number;
      before: number;
      after: number;
      rank: number;
      entrants: number;
      solved: number;
      ids: string;
    }[]
  ).map(({ ids, id, ...r }) => ({ ...r, week: roomWeek(id)!, total: (JSON.parse(ids) as string[]).length }));
}

/**
 * A learner's duel rating: after their latest ranked duel, START_RATING before the first. Latest
 * by rowid: settlement order, which a shared or earlier-read created_at can't tell.
 */
export const duelRating = (userId: string) =>
  (sqlite()
    .prepare(
      `SELECT CASE WHEN a_user=@u THEN a_after ELSE b_after END FROM duel_results WHERE a_user=@u OR b_user=@u
      ORDER BY rowid DESC LIMIT 1`,
    )
    .pluck()
    .get({ u: userId }) as number | undefined) ?? START_RATING;

/** Ranked duel record: wins, losses, draws, the current and the longest winning streak, the band. */
export function duelRecord(userId: string) {
  const winners = sqlite()
    .prepare('SELECT winner FROM duel_results WHERE a_user=@u OR b_user=@u ORDER BY rowid')
    .pluck()
    .all({ u: userId }) as (string | null)[];
  let wins = 0,
    losses = 0,
    streak = 0,
    best = 0;
  for (const winner of winners) {
    if (winner === userId) {
      wins++;
      best = Math.max(best, ++streak);
    } else {
      if (winner) losses++;
      streak = 0;
    }
  }
  const rating = duelRating(userId);
  return {
    rating,
    band: duelBand(rating),
    played: winners.length,
    wins,
    losses,
    draws: winners.length - wins - losses,
    streak,
    best,
  };
}
