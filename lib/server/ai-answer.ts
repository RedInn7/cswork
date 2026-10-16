import type { Person } from './auth';
import { HttpError } from './http';

/** POST oj/ai/grade: AI feedback on a written interview answer or STAR story (ai-answer-feedback). Not open yet. */
export async function handleAiGrade(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '未开放');
}
