import type { Person } from './auth';
import { HttpError } from './http';

/** POST oj/ai/jd: a job description's readiness checklist (jd-readiness). Not open yet. */
export async function handleAiJd(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '未开放');
}
