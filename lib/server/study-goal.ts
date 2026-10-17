import type { Person } from './auth';
import { HttpError } from './http';

/**
 * GET oj/study-goal (GET only; oj-api routes every method here): limit(p,'study-goal-read',60);
 * only {paused:true} while runningContestProblems(p.id) is not empty (a running contest or skill test).
 */
// ponytail: stub, habits-study-goals implements it in this file.
export async function handleStudyGoal(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '判题接口不存在');
}
