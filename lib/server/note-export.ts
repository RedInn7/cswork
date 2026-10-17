import type { Person } from './auth';
import { HttpError } from './http';

// oj-api routes every method of oj/notes/export and oj/cheatsheet here; anything but GET stays 404.
// Neither is about one problem, so instead of refuseInContest both answer 403 while
// runningContestProblems(p.id) is not empty (a running contest or skill test).

/** GET oj/notes/export: limit(p,'notes-export',60,3600). */
// ponytail: stub, notes-export-cheatsheet implements it in this file.
export async function handleNoteExport(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '判题接口不存在');
}

/** GET oj/cheatsheet: limit(p,'cheatsheet-read',30). */
// ponytail: stub, notes-export-cheatsheet implements it in this file.
export async function handleCheatsheet(_request: Request, _p: Person): Promise<Response> {
  throw new HttpError(404, '判题接口不存在');
}
