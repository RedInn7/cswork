import type { Person } from './auth';
import { HttpError } from './http';

/** Private code review links (private-code-review): POST reviews, GET reviews/<token>, POST reviews/<token>/comments, DELETE reviews/<id>; `path` is what follows oj/reviews. Not open yet. */
export async function handleCodeReviews(_request: Request, _p: Person, _path: string[]): Promise<Response> {
  throw new HttpError(404, '未开放');
}
