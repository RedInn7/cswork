import { z } from 'zod';
import { leetcodeTemplates, leetcodeContract } from './leetcode-mode';
import {
  changePracticeRound,
  practiceRoundState,
  isSelectedProblem,
} from './practice-rounds';
import type { Person } from './auth';
import { handleEditorIntelligence } from './editor-intelligence';
import { judgeFeed } from './judge-feed';
import { requestPrecompile } from './oj-precompile';
import { handleOaLibrary } from './oa-library';
import { handleMockOa } from './mock-oa';
import { handleSpeedrun } from './speedrun';
import { oaEnglishStatement } from './oa-judge';
import { handleLeetcodeSync } from './leetcode-sync';
import { handleMyPractice } from './my-practice';
import { curatedHint } from '@/lib/ling-curated';
import { companyTagIndex } from '@/lib/company-tags';
import { hiddenCompanies } from './env';
import {
  getStudyLibrary,
  getStudySourceStatement,
  listLibrary,
} from './study-library';
import { classicList } from '@/lib/classic-lists';
import { requireCourseOwner } from './course-visibility';
import {
  boundedText,
  HttpError,
  json,
  limit,
  limitReader,
  requirePerson,
  requireTeacher,
} from './http';
import {
  getPublishedProblem,
  getPublicOaProblem,
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
  waitForSubmission,
  settleSubmission,
  submissionHistory,
  hintEarned,
  cancelSubmission,
  ojStatus,
  MAX_CODE_BYTES,
  MAX_STDIN_BYTES,
} from './oj-submissions';
export async function handleOj(
  request: Request,
  p: Person | null,
  path: string[],
) {
  const url = new URL(request.url),
    [resource, id, action, operation] = path;
  if (resource === 'oa-library')
    return handleOaLibrary(request, p, path.slice(1));
  if (resource === 'mock-oa') return handleMockOa(request, p, path.slice(1));
  if (request.method === 'GET' && resource === 'speedrun' && !id)
    return handleSpeedrun(request, p);
  if (request.method === 'GET' && resource === 'problems' && id && !action) {
    // OA statements are public; other problems keep the course entitlement gate.
    const oa = id.startsWith('oa-');
    if (oa) await limitReader(request, p, 'oa-library-read', 120);
    else requirePerson(p);
    // Entitlement, publication and validation gates apply before source text
    // is read. Full statements supplement, never replace, the judge protocol.
    const problem = oa
      ? await getPublicOaProblem(id)
      : await getPublishedProblem(p!, id);
    // OA English statements live beside the verified package; merge for display only.
    const english = oa && !problem.translations?.en ? oaEnglishStatement(id) : undefined;
    if (english) problem.translations = { ...problem.translations, en: english };
    const templates = leetcodeTemplates(id);
    const round =
      p && isSelectedProblem(id) ? practiceRoundState(p.id).currentRound : null;
    const hint = curatedHint(id);
    return json({
      ...problem,
      codingModes: templates ? ['leetcode', 'acm'] : ['acm'],
      leetcodeTemplates: templates,
      leetcodeInputHelp: leetcodeContract(id)?.customInputHelp || null,
      sourceStatement: getStudySourceStatement(id),
      curatedHint: hint,
      companies: companyTagIndex(hiddenCompanies()).get(id) ?? [],
      // Per round like Solved, over all history rather than the first page.
      hintEarned: hint && p ? hintEarned(p.id, id, round?.id) : false,
      practiceRound: round,
      maxCodeBytes: MAX_CODE_BYTES,
      maxStdinBytes: MAX_STDIN_BYTES,
      judgeAvailable: ojStatus().available,
      languageVersions: ojStatus().languageVersions,
    });
  }
  if (
    request.method === 'GET' &&
    resource === 'library' &&
    !id &&
    // Signed out, only the curated landing list and the classic lists are open; the full catalogue stays for members.
    (p ||
      ['', 'ling-selected-500'].includes(url.searchParams.get('collection') || '') ||
      !!classicList(url.searchParams.get('collection')))
  ) {
    // The landing problem list is browsable signed out; statements still need an account.
    await limitReader(request, p, 'library-read', 120);
    return json(listLibrary(url.searchParams, p?.id));
  }
  if (request.method === 'GET' && resource === 'feed' && !id) {
    // Public judge status board: submission metadata only, rate limited per client.
    await limitReader(request, p, 'judge-feed-read', 120);
    return json(judgeFeed(p, url.searchParams));
  }
  requirePerson(p);
  if (resource === 'leetcode-sync')
    return handleLeetcodeSync(request, p, path.slice(1));
  if (!id && (resource === 'history' || resource === 'notes' || resource === 'marks'))
    return handleMyPractice(request, p, resource);
  if (request.method === 'GET') {
    if (resource === 'library') {
      await limit(p, 'library-read', 120);
      return json(
        id ? getStudyLibrary(id) : listLibrary(url.searchParams, p.id),
      );
    }
    if (resource === 'practice-rounds' && !id) {
      await limit(p, 'library-read', 120);
      return json(practiceRoundState(p.id));
    }
    if (resource === 'status') return json(ojStatus());
    if (resource === 'submissions') {
      if (id && url.searchParams.get('wait') === '1') {
        await limit(p, 'oj-watch', 360);
        const after = url.searchParams.get('after') || '';
        if (after.length > 160) throw new HttpError(400, '无效的进度标记');
        return json(await waitForSubmission(p, id, after, request.signal));
      }
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
      requireCourseOwner(p); // Problem packages include course exercises.
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
  if (resource === 'precompile' && !id) {
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 800000));
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(400, '无效的 JSON');
    }
    return json(await requestPrecompile(p, data), 202);
  }
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
    const created = await createSubmission(p, data);
    // Reuse the owner-checked public projection for both fresh submissions and
    // idempotent replays, after briefly waiting for a fast verdict. Clients
    // watch slower ones without a detail GET; hidden case inputs/outputs never
    // enter the response.
    return json(await settleSubmission(p, created.id, request.signal), 201);
  }
  if (resource === 'admin' && id === 'problems') {
    requireTeacher(p);
    requireCourseOwner(p);
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
