import type { Person } from './auth';
import { HttpError } from './http';

/**
 * GET oj/notes/<sub> (oj-api routes every method here; anything but these GETs stays 404):
 * - tags: limit(p,'note-tags',30).
 * - backlinks: limit(p,'note-backlinks',60), then refuseInContest(p, problem): closed while the
 *   problem is in a running contest or skill test.
 * - stop: limit(p,'my-practice-read',120); skips runningContestProblems(p.id), read once per request.
 */
// ponytail: stub, notes-structure implements it in this file.
export async function handleNoteSub(_request: Request, _p: Person, _sub: string): Promise<Response> {
  throw new HttpError(404, '判题接口不存在');
}
