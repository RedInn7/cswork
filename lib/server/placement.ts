import type { Person } from './auth';
import { HttpError } from './http';

/** GET/POST oj/speedrun/placement: the pattern-recognition placement quiz (level-placement). Not open yet. */
export async function handlePlacement(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '未开放');
}
