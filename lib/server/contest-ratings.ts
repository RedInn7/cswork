import { sqlite } from '@/db/sqlite';

/** A learner's rated weeklies, oldest first: the profile's rating curve and contest badges. */
export function ratingHistory(userId: string) {
  return (
    sqlite()
      .prepare(
        `SELECT c.id,c.starts_at AS at,r.before,r.after,r.rank,r.entrants,r.solved,c.problem_ids_json AS ids
        FROM contest_ratings r JOIN contest_rooms c ON c.id=r.room_id WHERE r.user_id=? ORDER BY c.starts_at`,
      )
      .all(userId) as {
      id: string;
      at: number;
      before: number;
      after: number;
      rank: number;
      entrants: number;
      solved: number;
      ids: string;
    }[]
  ).map(({ ids, id, ...r }) => ({ ...r, week: Number(id.slice(7)), total: (JSON.parse(ids) as string[]).length }));
}
