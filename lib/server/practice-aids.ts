import type { Person } from './auth';
import { HttpError } from './http';

/** POST oj/problems/<id>/aids: a hint or solve-time event for the assisted-solve record (practice-assisted-solve). Not open yet. */
export async function handlePracticeAids(_request: Request, _p: Person, _problemId: string): Promise<Response> {
  throw new HttpError(404, '未开放');
}
