import { z } from 'zod';
import {
  leetcodeTemplates,
  leetcodeContract,
  leetcodeParams,
  leetcodeConstraints,
  leetcodeReturnType,
} from './leetcode-mode';
import { checkConstraints, splitFields } from '@/lib/testcase-fields';
import {
  changePracticeRound,
  practiceRoundState,
  isSelectedProblem,
} from './practice-rounds';
import type { Person } from './auth';
import { handleEditorIntelligence } from './editor-intelligence';
import { judgeFeed } from './judge-feed';
import { requestPrecompile } from './oj-precompile';
import { currentDrills, handleOaLibrary } from './oa-library';
import { handleMockOa } from './mock-oa';
import { handleSkillTests } from './skill-tests';
import { handleSpeedrun } from './speedrun';
import { oaEnglishStatement } from './oa-judge';
import { handleLeetcodeSync } from './leetcode-sync';
import { handleMyPractice, problemVote, readJson } from './my-practice';
import { handleAiTutor, isAiRoute } from './ai-tutor';
import { handleAiInterview } from './ai-interviewer';
import { handleAiAsk } from './ai-ask';
import { handleAiResume } from './ai-resume';
import { handleAiPair } from './ai-rounds';
import { PROJECT_MAX_BYTES } from '@/lib/ai-coding';
import { problemStats } from './problem-stats';
import { handleDrafts, handleLearnerCloud, handleMockHistory } from './learner-cloud';
import { handleSolutionPosts } from './solution-posts';
import { handleExperienceSubmissions } from './experience-submissions';
import { handleStudyGroups } from './study-groups';
import { handleMockPeer } from './mock-peer';
import { handleNewsletter } from './newsletter';
import { handleFollows } from './follows';
import { handleApplications } from './applications';
import { handleNotify } from './reminders';
import { handleDirectMessages } from './direct-messages';
import { handleWorkVerify } from './work-verify';
import { sourceDates } from './company-insights';
import { handleContests, inRunningContest, refuseInContest } from './contests';
import { handleDuels } from './duels';
import { handleApiTokens } from './api-tokens';
import { dailyProblem } from './daily-problem';
import { curatedByNumber, curatedHint } from '@/lib/ling-curated';
import { companyTagIndex } from '@/lib/company-tags';
import { windowCounts } from '@/lib/report-windows';
import { hiddenCompanies } from './env';
import {
  getStudyLibrary,
  getStudySourceStatement,
  levelPicks,
  lingHints,
  listLibrary,
  similarProblems,
} from './study-library';
import { lcRating } from './lc-ratings';
import { lingEditorial } from './ling-editorials';
import { awardAccepted, handlePoints } from './points';
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
  canSeeProblem,
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
  createPlaygroundRun,
  createProjectRun,
  createReferenceRun,
  createSubmission,
  submissionDetail,
  waitForSubmission,
  settleSubmission,
  submissionHistory,
  submissionRow,
  failedJudgeIds,
  cancelSubmission,
  ojStatus,
  MAX_CODE_BYTES,
  MAX_STDIN_BYTES,
} from './oj-submissions';
/**
 * Points for an accepted formal submission whenever its verdict reaches a client (submit,
 * watch or detail): idempotent, so every path may call it; a failure never costs the verdict.
 * Kept here, not in oj-submissions, so the judge worker bundle stays free of it.
 */
async function withPoints<T extends { id: string; status: string; mode: string }>(detail: T) {
  if (detail.status === 'accepted' && detail.mode === 'judge') {
    const row = submissionRow(detail.id);
    if (row)
      await awardAccepted(row).catch((error: unknown) =>
        console.error('points', error instanceof Error ? error.name : 'unknown'),
      );
  }
  return detail;
}
export async function handleOj(
  request: Request,
  p: Person | null,
  path: string[],
) {
  const url = new URL(request.url),
    [resource, id, action, operation] = path;
  // An OA editorial is closed while its problem is in the reader's running contest, like Line 500's;
  // so are its drills, each the reference solution a line or three off.
  if (resource === 'oa-library' && ['solution', 'drill', 'review'].includes(action)) refuseInContest(p, id);
  if (resource === 'oa-library')
    return handleOaLibrary(request, p, path.slice(1));
  if (resource === 'mock-oa' && id === 'history' && !action) return handleMockHistory(request, p);
  if (resource === 'mock-oa') return handleMockOa(request, p, path.slice(1));
  if (resource === 'skills') return handleSkillTests(request, p, path.slice(1));
  if (resource === 'lists' || resource === 'profile' || resource === 'reports')
    return handleLearnerCloud(request, p, path);
  if (resource === 'experiences') return handleExperienceSubmissions(request, p, path.slice(1));
  if (resource === 'groups') return handleStudyGroups(request, p, path);
  if (resource === 'peer') return handleMockPeer(request, p, path.slice(1));
  if (resource === 'newsletter') return handleNewsletter(request, p, path.slice(1));
  if (resource === 'follows') return handleFollows(request, p, path.slice(1));
  if (resource === 'applications') return handleApplications(request, p, path.slice(1));
  if (resource === 'notify') return handleNotify(request, p, path.slice(1));
  if (resource === 'dm') return handleDirectMessages(request, p, path.slice(1));
  if (resource === 'work') return handleWorkVerify(request, p, path.slice(1));
  // The weekly, standings and the rating board read signed out; the handler checks the rest.
  if (resource === 'contests' && id === 'duel') return handleDuels(request, p, path);
  if (resource === 'contests') return handleContests(request, p, path);
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
    // In this learner's running contest the hints stay server-side, like the editorial.
    const live = p ? inRunningContest(p.id, id) : false;
    const hint = live ? null : curatedHint(id);
    const tags = companyTagIndex(hiddenCompanies());
    const dated = sourceDates();
    // Per round like Solved, over all history rather than the first page; 2 opens hint 3.
    const failed = hint && p ? failedJudgeIds(p.id, id, round?.id) : [];
    return json({
      ...problem,
      // The package's own hints too, in every language; copies, never the cached problem.
      ...(live && {
        hints: [],
        translations:
          problem.translations &&
          Object.fromEntries(Object.entries(problem.translations).map(([k, v]) => [k, v && { ...v, hints: [] }])),
      }),
      codingModes: templates ? ['leetcode', 'acm'] : ['acm'],
      leetcodeTemplates: templates,
      leetcodeInputHelp: leetcodeContract(id)?.customInputHelp || null,
      leetcodeParams: leetcodeParams(id),
      // What a run prints (a void in-place problem: its parameter), so trees and lists are drawn.
      leetcodeReturnType: leetcodeReturnType(id),
      leetcodeConstraints: leetcodeConstraints(id),
      sourceStatement: getStudySourceStatement(id),
      curatedHint: hint,
      // Contest rating (zerotrac), null outside rated contests.
      rating: lcRating(id),
      // Each company's reports by age; the report slugs stay on the server.
      companies: (tags.get(id) ?? []).map(({ sources, ...tag }) => ({ ...tag, windows: windowCounts(sources, dated, Date.now()) })),
      hintEarned: failed.length > 0,
      // Ids, not a count: the client unions them with live verdicts so none counts twice.
      failedSubmissionIds: failed,
      // Observation, invariant, steps: the client opens them one at a time (components/hint-ladder.tsx).
      lingHints: live ? null : lingHints(id),
      // Whether a Line 500 editorial exists (null: none) and its code passed the judge. The editorial
      // itself is GET problems/<id>/editorial, fetched once the learner unlocks it.
      lingEditorialVerified: lingEditorial(id)?.verified ?? null,
      // Its Line 500 stop, so the hint ladder can link the stop's animation (/topics/<stop>).
      stop: curatedByNumber.get(Number(/^lc-(\d+)$/.exec(id)?.[1]))?.sectionSlug ?? null,
      // A nicety under the statement: it never fails the problem itself.
      similar: await similarProblems(id, p?.id, tags).catch(() => []),
      practiceRound: round,
      maxCodeBytes: MAX_CODE_BYTES,
      maxStdinBytes: MAX_STDIN_BYTES,
      judgeAvailable: ojStatus().available,
      languageVersions: ojStatus().languageVersions,
    });
  }
  if (request.method === 'GET' && resource === 'problems' && id && action === 'editorial' && !operation) {
    requirePerson(p);
    await limit(p, 'oj-read', 240);
    const editorial = lingEditorial(id);
    if (!editorial) throw new HttpError(404, '题解不存在');
    // Never while the problem is in this learner's running contest; then the statement's own gate.
    refuseInContest(p, id);
    await getPublishedProblem(p, id);
    return json(editorial);
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
  if (request.method === 'GET' && resource === 'daily' && !id) {
    // Today's problem for MCP clients; the site gets it from the bootstrap.
    await limitReader(request, p, 'library-read', 120);
    return json({ daily: await dailyProblem() });
  }
  if (request.method === 'GET' && resource === 'feed' && !id) {
    // Public judge status board: submission metadata only, rate limited per client.
    await limitReader(request, p, 'judge-feed-read', 120);
    return json(judgeFeed(p, url.searchParams));
  }
  // Threads, answers and comments read signed out; the handler checks the rest.
  if (['posts', 'post-comments', 'group-messages', 'direct-messages'].includes(resource))
    return handleSolutionPosts(request, p, path);
  requirePerson(p);
  if (resource === 'tokens') return handleApiTokens(request, p, path.slice(1));
  if (resource === 'cloud' && id === 'drafts' && !operation)
    return handleDrafts(request, p, action);
  if (resource === 'leetcode-sync')
    return handleLeetcodeSync(request, p, path.slice(1));
  if (!id && (resource === 'history' || resource === 'notes' || resource === 'marks'))
    return handleMyPractice(request, p, resource);
  if (resource === 'ai' && id && isAiRoute(id) && !action)
    return handleAiTutor(request, p, id);
  if (
    resource === 'ai' &&
    (id === 'interview' || id === 'interview-step' || id === 'interview-report' || id === 'interview-calibration') &&
    !action
  )
    return handleAiInterview(request, p, id);
  // Questions answered from the site's own pages (lib/server/ai-ask.ts).
  if (resource === 'ai' && id === 'ask' && !action) return handleAiAsk(request, p);
  // The resume review on /career/resume (lib/server/ai-resume.ts).
  if (resource === 'ai' && id === 'resume' && !action) return handleAiResume(request, p);
  // The AI pair of the AI-assisted round (lib/server/ai-rounds.ts).
  if (resource === 'ai' && id === 'pair' && !action) return handleAiPair(request, p);
  if (resource === 'points' && !action) return handlePoints(request, p, id);
  if (request.method === 'GET') {
    if (resource === 'library') {
      await limit(p, 'library-read', 120);
      return json(
        id ? getStudyLibrary(id, p.id) : listLibrary(url.searchParams, p.id),
      );
    }
    if (resource === 'recommend' && !id) {
      await limit(p, 'library-read', 120);
      return json(levelPicks(p.id));
    }
    if (resource === 'practice-rounds' && !id) {
      await limit(p, 'library-read', 120);
      return json(practiceRoundState(p.id));
    }
    if (resource === 'status') return json(ojStatus());
    if (resource === 'problem-stats' && id && !action) {
      await limit(p, 'oj-read', 240);
      // Same gate as the statement: owner-only course exercises stay invisible.
      if (!/^[\w-]{1,100}$/.test(id) || !(await canSeeProblem(p, id)))
        throw new HttpError(404, '题目不存在');
      const runtime = Number(url.searchParams.get('runtimeMs') ?? NaN);
      const memory = Number(url.searchParams.get('memoryKb') ?? NaN);
      return json({
        ...problemStats(
          id,
          url.searchParams.get('language'),
          Number.isFinite(runtime) ? runtime : null,
          Number.isFinite(memory) ? memory : null,
        ),
        // The viewer's own vote, outside the shared cache.
        vote: problemVote(p.id, id),
      });
    }
    if (resource === 'submissions') {
      if (id && url.searchParams.get('wait') === '1') {
        await limit(p, 'oj-watch', 360);
        const after = url.searchParams.get('after') || '';
        if (after.length > 160) throw new HttpError(400, '无效的进度标记');
        return json(await withPoints(await waitForSubmission(p, id, after, request.signal)));
      }
      await limit(p, 'oj-read', 240);
      return json(
        id
          ? await withPoints(await submissionDetail(p, id))
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
  if (resource === 'problems' && id && action === 'expected' && !operation) {
    // A custom case's expected output from the verified editorial's best approach: closed,
    // like the editorial, while the problem is in this learner's running contest.
    const editorial = lingEditorial(id);
    if (!editorial?.verified) throw new HttpError(404, '这道题没有可用的参考解');
    refuseInContest(p, id);
    const data = await readJson(request, 200000);
    // An input outside the statement's bounds would get a misleading "expected" output.
    const params = leetcodeParams(id),
      bounds = leetcodeConstraints(id),
      d = data as { stdin?: unknown; codingMode?: unknown } | null;
    if (params && bounds && (d?.codingMode ?? 'leetcode') === 'leetcode' && typeof d?.stdin === 'string') {
      const fields = splitFields(d.stdin, params.length);
      const broken = fields && checkConstraints(fields, params, bounds).find(Boolean);
      if (broken) throw new HttpError(422, broken[0]);
    }
    const created = await createReferenceRun(p, id, data, editorial.approaches.at(-1)!.python);
    // Watched like a run: GET submissions/<id>?wait=1; its code never comes back.
    return json(await settleSubmission(p, created.id, request.signal), 201);
  }
  if (resource === 'playground' && id === 'run' && !action) {
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 800000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    // Same owner-checked detail and watch protocol as a custom-input run.
    const created = await createPlaygroundRun(p, data);
    return json(await settleSubmission(p, created.id, request.signal), 201);
  }
  if (resource === 'ai-assisted' && id === 'run' && !action) {
    // An AI-assisted round run: the playground's watch protocol, its report on the detail.
    const created = await createProjectRun(p, await readJson(request, PROJECT_MAX_BYTES * 2 + 10_000));
    return json(await settleSubmission(p, created.id, request.signal), 201);
  }
  if (resource === 'submissions' && !id) {
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 800000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    // A drill submission or run (fixing a planted bug) starts from the reference: never inside a
    // running contest, and only on a problem with live drills (an unlisted judging of any other
    // problem would probe its hidden cases without leaving an attempt).
    const drill = data as { mode?: unknown; problemId?: unknown } | null;
    if ((drill?.mode === 'drill' || drill?.mode === 'drill-run') && typeof drill.problemId === 'string') {
      refuseInContest(p, drill.problemId);
      currentDrills(drill.problemId);
    }
    const created = await createSubmission(p, data);
    // Reuse the owner-checked public projection for both fresh submissions and
    // idempotent replays, after briefly waiting for a fast verdict. Clients
    // watch slower ones without a detail GET; hidden case inputs/outputs never
    // enter the response.
    return json(await withPoints(await settleSubmission(p, created.id, request.signal)), 201);
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
