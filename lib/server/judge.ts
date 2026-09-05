// Compatibility for old submission links and teacher workbench previews.
import type { Person } from './auth';
import type { Language } from '@/lib/problems';
import { createSubmission } from './oj-submissions';
export { judgeReady, submissionDetail as result } from './oj-submissions';
export function submit(p: Person, problemId: string, language: Language, code: string) {
  return createSubmission(p, { problemId, language, code, mode: 'judge', idempotencyKey: crypto.randomUUID() });
}
