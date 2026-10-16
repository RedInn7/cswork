import type { Person } from './auth';
import { HttpError } from './http';

/** POST oj/ai/round-review: AI review of an AI-assisted round or take-home (project-practice-v2), on the AI pair's budget. Not open yet. */
export async function handleRoundReview(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '未开放');
}
