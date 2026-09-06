import { z } from 'zod';
import { leetcodeTemplates, leetcodeContract } from './leetcode-mode';
import {
  changePracticeRound,
  practiceRoundState,
  isSelectedProblem,
} from './practice-rounds';
import type { Person } from './auth';
import { handleEditorIntelligence } from './editor-intelligence';
import {
  getStudyLibrary,
  getStudySourceStatement,
  listStudyLibrary,
} from './study-library';
import { boundedText, HttpError, json, limit, requireTeacher } from './http';
import {
  getPublishedProblem,
  listTeacherProblems,
  getTeacherProblem,
  saveProblemDraft,
  publishProblemDraft,
  copyProblemVersion,
  OJ_MAX_IMPORT_BYTES,
} from './oj-problems';
import {
  createSubmission,
  submissionDetail,
  submissionHistory,
  cancelSubmission,
  ojStatus,
  MAX_CODE_BYTES,
  MAX_STDIN_BYTES,
} from './oj-submissions';
export async function handleOj(request: Request, p: Person, path: string[]) {
  const url = new URL(request.url),
    [resource, id, action, operation] = path;
  if (request.method === 'GET') {
    if (resource === 'library') {
      await limit(p, 'library-read', 120);
      return json(
        id ? getStudyLibrary(id) : listStudyLibrary(url.searchParams, p.id),
      );
    }
    if (resource === 'practice-rounds' && !id) {
      await limit(p, 'library-read', 120);
      return json(practiceRoundState(p.id));
    }
    if (resource === 'status') return json(ojStatus());
    if (resource === 'problems' && id) {
      // Entitlement, publication and validation gates apply before source text
      // is read. Full statements supplement, never replace, the judge protocol.
      const problem = await getPublishedProblem(p, id);
      const templates = leetcodeTemplates(id);
      return json({
        ...problem,
        codingModes: templates ? ['leetcode', 'acm'] : ['acm'],
        leetcodeTemplates: templates,
        leetcodeInputHelp: leetcodeContract(id)?.customInputHelp || null,
        sourceStatement: getStudySourceStatement(id),
        practiceRound: isSelectedProblem(id)
          ? practiceRoundState(p.id).currentRound
          : null,
        maxCodeBytes: MAX_CODE_BYTES,
        maxStdinBytes: MAX_STDIN_BYTES,
        judgeAvailable: ojStatus().available,
        languageVersions: ojStatus().languageVersions,
      });
    }
    if (resource === 'submissions') {
      await limit(p, 'oj-read', 240);
      return json(
        id
          ? await submissionDetail(p, id)
          : submissionHistory(
              p,
              url.searchParams.get('problemId'),
              url.searchParams.get('cursor'),
            ),
      );
    }
    if (resource === 'admin' && id === 'problems') {
      requireTeacher(p);
      return json(
        action
          ? await getTeacherProblem(p, action)
          : await listTeacherProblems(p),
      );
    }
  }
  if (request.method !== 'POST') throw new HttpError(404, '判题接口不存在');
  if (resource === 'intelligence' && (!id || id === 'close') && !action)
    return handleEditorIntelligence(request, p, id === 'close');
  await limit(p, 'oj-write', 40);
  if (resource === 'practice-rounds' && !id) {
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 2000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    return json(changePracticeRound(p.id, data));
  }
  if (resource === 'submissions' && id && action === 'cancel')
    return json(await cancelSubmission(p, id));
  if (resource === 'submissions' && !id) {
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 800000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    return json(await createSubmission(p, data), 201);
  }
  if (resource === 'admin' && id === 'problems') {
    requireTeacher(p);
    let data: unknown;
    try {
      data = JSON.parse(
        await boundedText(
          request,
          action === 'save' && !operation ? OJ_MAX_IMPORT_BYTES + 1000 : 150000,
        ),
      );
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的题目 JSON');
    }
    if (action === 'save') {
      const d = z
        .object({
          payload: z.unknown(),
          expectedRevision: z.number().int().nonnegative().nullable(),
        })
        .strict()
        .parse(data);
      return json(await saveProblemDraft(p, d.payload, d.expectedRevision));
    }
    if (action && operation === 'publish') {
      const d = z
        .object({ expectedRevision: z.number().int().positive() })
        .strict()
        .parse(data);
      return json(await publishProblemDraft(p, action, d.expectedRevision));
    }
    if (action && operation === 'restore') {
      const d = z
        .object({
          versionId: z.string().min(1).max(100),
          expectedRevision: z.number().int().nonnegative().nullable(),
        })
        .strict()
        .parse(data);
      return json(
        await copyProblemVersion(p, action, d.versionId, d.expectedRevision),
      );
    }
  }
  throw new HttpError(404, '判题接口不存在');
}
