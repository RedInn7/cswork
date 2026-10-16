import type { Person } from './auth';
import { HttpError } from './http';

/** POST oj/problems/<id>/stress: a stress test of the learner's code against the reference on generated cases (reference-runs-oa-stress). Not open yet. */
export async function handleStress(_request: Request, _p: Person, _problemId: string): Promise<Response> {
  throw new HttpError(404, '未开放');
}
