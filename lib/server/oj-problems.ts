import { createHash } from 'node:crypto';
import { ojImportSchema, OJ_MAX_IMPORT_BYTES } from '@/lib/oj-types';
import { problems } from '@/lib/problems';
import type {
  OjProblemPackage,
  OjProblemSpec,
  OjJudgeSnapshot,
  OjPublicProblem,
  OjTeacherProblem,
  OjProblemVersion,
} from '@/lib/oj-types';
import { createOjSeedPackages } from '../../scripts/seed-oj-data.mjs';
import type { Person } from './auth';
import { database } from './env';
import {
  oaJudgeRegistry,
  requireOaJudgeReady,
  assertOaVersionReady,
} from './oa-judge';
import {
  HttpError,
  one,
  rows,
  requireCourse,
  requireTeacher,
  auditStatement,
} from './http';

export {
  ojImportSchema,
  OJ_MAX_IMPORT_BYTES,
  OJ_MAX_CASE_BYTES,
  OJ_MAX_CASES,
} from '@/lib/oj-types';

export function validateProblemPackage(value: unknown): OjProblemPackage {
  // Bound the full serialized document in addition to each independently bounded field.
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new HttpError(400, '题目文件不是有效 JSON');
  }
  if (
    !serialized ||
    Buffer.byteLength(serialized, 'utf8') > OJ_MAX_IMPORT_BYTES
  )
    throw new HttpError(
      413,
      `题目文件最多 ${OJ_MAX_IMPORT_BYTES / 1024 / 1024} MiB`,
    );
  return ojImportSchema.parse(value);
}
export function problemChecksum(payload: OjProblemPackage) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

type ProblemRow = {
  id: string;
  course_id: string;
  lesson_id: string;
  current_version_id: string | null;
  published: number;
  created_at: number;
  updated_at: number;
};
type VersionRow = {
  id: string;
  problem_id: string;
  revision: number;
  spec_json: string;
  checksum: string;
  created_by: string;
  created_at: number;
};
/** Published drafts keep their row and revision (optimistic-lock continuity) but drop the duplicated package. */
export const PUBLISHED_DRAFT_PAYLOAD = 'null';

type DraftRow = {
  problem_id: string;
  payload_json: string;
  revision: number;
  updated_by: string;
  updated_at: number;
};
type CaseRow = {
  id: string;
  version_id: string;
  ordinal: number;
  input: string;
  expected_output: string;
  hidden: number;
  weight: number;
  name: string;
};

async function validateLinks(payload: OjProblemPackage) {
  const lesson = await one<{ course_id: string }>(
    'SELECT course_id FROM lessons WHERE id=?',
    payload.problem.lessonId,
  );
  if (!lesson || lesson.course_id !== payload.problem.courseId)
    throw new HttpError(400, '关联章节必须属于所选课程');
}

/** Trusted judge worker only. Never send this return value to a student-facing response. */
export async function loadJudgeSnapshot(
  versionId: string,
): Promise<OjJudgeSnapshot> {
  const v = await one<VersionRow>(
    'SELECT * FROM oj_problem_versions WHERE id=?',
    versionId,
  );
  if (!v) throw new HttpError(404, '题目版本不存在');
  const cases = await rows<CaseRow>(
    'SELECT * FROM oj_test_cases WHERE version_id=? ORDER BY ordinal',
    versionId,
  );
  const spec = JSON.parse(v.spec_json) as OjProblemSpec;
  const singletonWitness =
    v.problem_id === 'oa-pure-storage-8' &&
    spec.id === v.problem_id &&
    spec.checker === 'oa-binary-search-witness' &&
    cases.length === 1 &&
    cases[0].hidden === 0 &&
    cases[0].input === '';
  if (cases.length < 2 && !singletonWitness)
    throw new HttpError(503, '题目测试数据尚未就绪');
  const snapshot: OjJudgeSnapshot = {
    problemId: v.problem_id,
    versionId: v.id,
    revision: v.revision,
    checksum: v.checksum,
    spec,
    cases: cases.map((c) => ({
      id: c.id,
      ordinal: c.ordinal,
      name: c.name,
      input: c.input,
      expectedOutput: c.expected_output,
      hidden: !!c.hidden,
      weight: c.weight,
    })),
  };
  const payload: OjProblemPackage = {
    schemaVersion: 1,
    problem: snapshot.spec,
    cases: snapshot.cases.map(
      ({ name, input, expectedOutput, hidden, weight }) => ({
        name,
        input,
        expectedOutput,
        hidden,
        weight,
      }),
    ),
  };
  if (problemChecksum(payload) !== snapshot.checksum)
    throw new HttpError(503, '题目数据完整性检查未通过，请联系老师');
  return snapshot;
}

/**
 * A library entry is judgeable only while its source and published version match
 * the validated import. Match its canonical ID too: clearing the association
 * must not turn an existing library question into an unrestricted course one.
 * IS NOT makes missing hashes/associations fail closed without affecting normal
 * course questions that have no matching library entry.
 */
const libraryJudgeGate = `NOT EXISTS (
  SELECT 1 FROM study_library l
  WHERE (l.judge_problem_id=p.id OR l.id=p.id)
    AND (l.judge_problem_id IS NOT p.id
      OR l.verified_hash IS NOT (l.content_hash || ':' || p.current_version_id))
)`;

/** Compilation needs an authorized version and interface, never hidden test data. */
export async function getCompileProblem(p: Person, problemId: string) {
  await requireOaJudgeReady(problemId);
  const problem = await one<ProblemRow>(
    `SELECT p.* FROM oj_problems p WHERE p.id=? AND p.published=1 AND ${libraryJudgeGate}`,
    problemId,
  );
  if (!problem?.current_version_id)
    throw new HttpError(404, '题目不存在或尚未发布');
  await requireCourse(p, problem.course_id);
  const version = await one<{ spec_json: string; checksum: string }>(
    'SELECT spec_json,checksum FROM oj_problem_versions WHERE id=?',
    problem.current_version_id,
  );
  if (!version) throw new HttpError(404, '题目版本不存在');
  assertOaVersionReady(problemId, version.checksum, version.spec_json);
  return {
    versionId: problem.current_version_id,
    spec: JSON.parse(version.spec_json) as OjProblemSpec,
  };
}

/** Submission creation checks the version's own course permission before snapshotting. */
export async function getJudgeProblem(p: Person, problemId: string) {
  await requireOaJudgeReady(problemId);
  const problem = await one<ProblemRow>(
    `SELECT p.* FROM oj_problems p WHERE p.id=? AND p.published=1 AND ${libraryJudgeGate}`,
    problemId,
  );
  if (!problem?.current_version_id)
    throw new HttpError(404, '题目不存在或尚未发布');
  await requireCourse(p, problem.course_id);
  const snapshot = await loadJudgeSnapshot(problem.current_version_id);
  assertOaVersionReady(
    problemId,
    snapshot.checksum,
    JSON.stringify(snapshot.spec),
  );
  return snapshot;
}

async function publicProblem(version: VersionRow): Promise<OjPublicProblem> {
  const spec = JSON.parse(version.spec_json) as OjProblemSpec;
  // This query deliberately never loads hidden inputs or outputs into public serialization.
  const samples = await rows<{
    name: string;
    input: string;
    expectedOutput: string;
  }>(
    'SELECT name,input,expected_output AS expectedOutput FROM oj_test_cases WHERE version_id=? AND hidden=0 ORDER BY ordinal',
    version.id,
  );
  const counts = await one<{ count: number; weight: number }>(
    'SELECT COUNT(*) AS count,COALESCE(SUM(weight),0) AS weight FROM oj_test_cases WHERE version_id=?',
    version.id,
  );
  return {
    ...spec,
    versionId: version.id,
    version: version.revision,
    checksum: version.checksum,
    sampleIn: samples[0]?.input || '',
    sampleOut: samples[0]?.expectedOutput || '',
    samples,
    caseCount: counts?.count || 0,
    totalWeight: counts?.weight || 0,
  };
}

/** Public catalogue: statements and declared samples are public, hidden cases never are. */
export async function listPublishedProblems(): Promise<OjPublicProblem[]> {
  const versions = await rows<VersionRow>(
    `SELECT v.* FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.published=1 AND ${libraryJudgeGate} ORDER BY p.created_at,p.id`,
  );
  const trusted = oaJudgeRegistry();
  return Promise.all(
    versions
      .filter(
        (version) =>
          !version.problem_id.startsWith('oa-') ||
          trusted.isReady({
            id: version.problem_id,
            checksum: version.checksum,
            spec_json: version.spec_json,
          }),
      )
      .map(publicProblem),
  );
}

/** OA statements are public: anyone may read them; submitting still checks course access. */
export async function getPublicOaProblem(problemId: string) {
  if (!problemId.startsWith('oa-')) throw new HttpError(404, '题目不存在或尚未发布');
  await requireOaJudgeReady(problemId);
  const pr = await one<ProblemRow>(
    `SELECT p.* FROM oj_problems p WHERE p.id=? AND p.published=1 AND ${libraryJudgeGate}`,
    problemId,
  );
  if (!pr?.current_version_id) throw new HttpError(404, '题目不存在或尚未发布');
  const v = await one<VersionRow>(
    'SELECT * FROM oj_problem_versions WHERE id=?',
    pr.current_version_id,
  );
  if (!v) throw new HttpError(404, '题目版本不存在');
  assertOaVersionReady(problemId, v.checksum, v.spec_json);
  return publicProblem(v);
}

export async function getPublishedProblem(p: Person, problemId: string) {
  await requireOaJudgeReady(problemId);
  const pr = await one<ProblemRow>(
    `SELECT p.* FROM oj_problems p WHERE p.id=? AND p.published=1 AND ${libraryJudgeGate}`,
    problemId,
  );
  if (!pr?.current_version_id) throw new HttpError(404, '题目不存在或尚未发布');
  await requireCourse(p, pr.course_id);
  const v = await one<VersionRow>(
    'SELECT * FROM oj_problem_versions WHERE id=?',
    pr.current_version_id,
  );
  if (!v) throw new HttpError(404, '题目版本不存在');
  assertOaVersionReady(problemId, v.checksum, v.spec_json);
  return publicProblem(v);
}

export async function listTeacherProblems(p: Person) {
  requireTeacher(p);
  return rows<{
    id: string;
    courseId: string;
    lessonId: string;
    title: string;
    published: number;
    currentVersionId: string | null;
    version: number | null;
    draftRevision: number | null;
    updatedAt: number;
  }>(
    `SELECT p.id,p.course_id AS courseId,p.lesson_id AS lessonId,p.published,p.current_version_id AS currentVersionId,p.updated_at AS updatedAt,v.revision AS version,CASE WHEN d.payload_json<>'null' THEN d.revision END AS draftRevision,COALESCE(json_extract(d.payload_json,'$.problem.title'),json_extract(v.spec_json,'$.title'),p.id) AS title FROM oj_problems p LEFT JOIN oj_problem_versions v ON v.id=p.current_version_id LEFT JOIN oj_problem_drafts d ON d.problem_id=p.id ORDER BY p.updated_at DESC,p.id`,
  );
}

export async function getTeacherProblem(
  p: Person,
  problemId: string,
): Promise<OjTeacherProblem> {
  requireTeacher(p);
  const pr = await one<ProblemRow>(
    'SELECT * FROM oj_problems WHERE id=?',
    problemId,
  );
  if (!pr) throw new HttpError(404, '题目不存在');
  const draft = await one<DraftRow>(
    'SELECT * FROM oj_problem_drafts WHERE problem_id=?',
    problemId,
  );
  const versions = await rows<OjProblemVersion>(
    `SELECT v.id,v.revision,v.checksum,v.created_at AS createdAt,v.created_by AS createdBy,COUNT(c.id) AS caseCount,COALESCE(SUM(c.hidden),0) AS hiddenCount,COALESCE(SUM(c.weight),0) AS totalWeight FROM oj_problem_versions v LEFT JOIN oj_test_cases c ON c.version_id=v.id WHERE v.problem_id=? GROUP BY v.id ORDER BY v.revision DESC`,
    problemId,
  );
  const current = pr.current_version_id
    ? await one<VersionRow>(
        'SELECT * FROM oj_problem_versions WHERE id=?',
        pr.current_version_id,
      )
    : null;
  const payload = draft
    ? (JSON.parse(draft.payload_json) as OjProblemPackage | null)
    : null;
  const publishedSnapshot =
    !payload && current ? await loadJudgeSnapshot(current.id) : null;
  const publishedPayload: OjProblemPackage | null = publishedSnapshot
    ? {
        schemaVersion: 1,
        problem: publishedSnapshot.spec,
        cases: publishedSnapshot.cases.map(
          ({ name, input, expectedOutput, hidden, weight }) => ({
            name,
            input,
            expectedOutput,
            hidden,
            weight,
          }),
        ),
      }
    : null;
  return {
    id: pr.id,
    courseId: pr.course_id,
    lessonId: pr.lesson_id,
    currentVersionId: pr.current_version_id,
    published: !!pr.published,
    title:
      payload?.problem.title ||
      (current
        ? (JSON.parse(current.spec_json) as OjProblemSpec).title
        : pr.id),
    updatedAt: pr.updated_at,
    draft:
      draft && payload
        ? {
            revision: draft.revision,
            updatedAt: draft.updated_at,
            payload,
            hasChanges:
              !current || current.checksum !== problemChecksum(payload),
          }
        : null,
    publishedPayload,
    versions,
  };
}

/** expectedRevision=null means create a draft; updates must provide the last seen revision. */
export async function saveProblemDraft(
  p: Person,
  value: unknown,
  expectedRevision: number | null,
) {
  requireTeacher(p);
  if (
    expectedRevision !== null &&
    (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
  )
    throw new HttpError(400, '草稿版本无效');
  const payload = validateProblemPackage(value);
  await validateLinks(payload);
  const pr = await one<ProblemRow>(
    'SELECT * FROM oj_problems WHERE id=?',
    payload.problem.id,
  );
  if (!pr && expectedRevision !== null)
    throw new HttpError(409, '题目尚未创建，请先载入正确草稿');
  if (pr && pr.course_id !== payload.problem.courseId)
    throw new HttpError(409, '已创建题目不能更换所属课程，请使用新题目 ID');
  const db = database(),
    now = Date.now(),
    serialized = JSON.stringify(payload);
  const write =
    expectedRevision === null
      ? db
          .prepare(
            "INSERT INTO oj_problem_drafts(problem_id,payload_json,revision,updated_by,updated_at) SELECT ?,?,1,?,? FROM oj_problems WHERE id=? AND course_id=? ON CONFLICT(problem_id) DO UPDATE SET payload_json=excluded.payload_json,revision=oj_problem_drafts.revision+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at WHERE oj_problem_drafts.payload_json='null' RETURNING revision",
          )
          .bind(
            payload.problem.id,
            serialized,
            p.id,
            now,
            payload.problem.id,
            payload.problem.courseId,
          )
      : db
          .prepare(
            'UPDATE oj_problem_drafts SET payload_json=?,revision=revision+1,updated_by=?,updated_at=? WHERE problem_id=? AND revision=? RETURNING revision',
          )
          .bind(serialized, p.id, now, payload.problem.id, expectedRevision);
  const results = db.batch([
    db
      .prepare(
        'INSERT INTO oj_problems(id,course_id,lesson_id,published,created_at,updated_at) VALUES(?,?,?,0,?,?) ON CONFLICT(id) DO NOTHING',
      )
      .bind(
        payload.problem.id,
        payload.problem.courseId,
        payload.problem.lessonId,
        now,
        now,
      ),
    write,
  ]);
  if (!(results[1] as { revision: number }[]).length)
    throw new HttpError(409, '草稿已被更新，请重新载入后保存');
  auditStatement(p, 'oj.draft.save', payload.problem.id).run();
  return getTeacherProblem(p, payload.problem.id);
}

export async function publishProblemDraft(
  p: Person,
  problemId: string,
  expectedRevision: number,
) {
  requireTeacher(p);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new HttpError(400, '草稿版本无效');
  const draft = await one<DraftRow>(
    'SELECT * FROM oj_problem_drafts WHERE problem_id=?',
    problemId,
  );
  if (
    !draft ||
    draft.revision !== expectedRevision ||
    draft.payload_json === PUBLISHED_DRAFT_PAYLOAD
  )
    throw new HttpError(409, '草稿已被更新，请重新载入后发布');
  const payload = validateProblemPackage(JSON.parse(draft.payload_json));
  await validateLinks(payload);
  const current = await one<{ checksum: string }>(
    'SELECT v.checksum FROM oj_problems p JOIN oj_problem_versions v ON v.id=p.current_version_id WHERE p.id=?',
    problemId,
  );
  const checksum = problemChecksum(payload);
  if (current?.checksum === checksum)
    throw new HttpError(409, '草稿与当前发布版本相同，无需重复发布');
  const db = database(),
    versionId = crypto.randomUUID(),
    now = Date.now();
  const results = db.batch([
    db
      .prepare(
        'INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) SELECT ?,d.problem_id,COALESCE((SELECT MAX(revision) FROM oj_problem_versions WHERE problem_id=d.problem_id),0)+1,?,?,?,? FROM oj_problem_drafts d WHERE d.problem_id=? AND d.revision=? AND d.payload_json=? RETURNING id',
      )
      .bind(
        versionId,
        JSON.stringify(payload.problem),
        checksum,
        p.id,
        now,
        problemId,
        expectedRevision,
        draft.payload_json,
      ),
    ...payload.cases.map((c, ordinal) =>
      db
        .prepare(
          'INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=?)',
        )
        .bind(
          crypto.randomUUID(),
          versionId,
          ordinal,
          c.input,
          c.expectedOutput,
          Number(c.hidden),
          c.name,
          c.weight,
          versionId,
        ),
    ),
    db
      .prepare(
        'UPDATE oj_problems SET current_version_id=?,lesson_id=?,published=1,updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=?)',
      )
      .bind(versionId, payload.problem.lessonId, now, problemId, versionId),
    db
      .prepare(
        `UPDATE oj_problem_drafts SET payload_json='${PUBLISHED_DRAFT_PAYLOAD}',revision=revision+1,updated_by=?,updated_at=? WHERE problem_id=? AND revision=? AND EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=?)`,
      )
      .bind(p.id, now, problemId, expectedRevision, versionId),
    db
      .prepare(
        'INSERT INTO audit(id,actor_id,action,target_id,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=?)',
      )
      .bind(
        crypto.randomUUID(),
        p.id,
        'oj.problem.publish',
        versionId,
        now,
        versionId,
      ),
  ]);
  if (!(results[0] as { id: string }[]).length)
    throw new HttpError(409, '草稿已被更新，请重新载入后发布');
  return { versionId, problem: await getTeacherProblem(p, problemId) };
}

export async function copyProblemVersion(
  p: Person,
  problemId: string,
  versionId: string,
  expectedRevision: number | null,
) {
  requireTeacher(p);
  const snapshot = await loadJudgeSnapshot(versionId);
  if (snapshot.problemId !== problemId)
    throw new HttpError(404, '题目版本不存在');
  const payload: OjProblemPackage = {
    schemaVersion: 1,
    problem: snapshot.spec,
    cases: snapshot.cases.map(
      ({ name, input, expectedOutput, hidden, weight }) => ({
        name,
        input,
        expectedOutput,
        hidden,
        weight,
      }),
    ),
  };
  return saveProblemDraft(p, payload, expectedRevision);
}

/** Idempotent initial import; an existing problem (including a teacher draft) is untouched. */
export async function ensureOjSeed() {
  const db = database();
  const existing = new Set(
    (await rows<{ id: string }>('SELECT id FROM oj_problems')).map((p) => p.id),
  );
  if (problems.every((p) => existing.has(p.id))) return;
  for (const value of createOjSeedPackages(problems)) {
    if (existing.has(value.problem.id)) continue;
    const payload = validateProblemPackage(value),
      now = Date.now(),
      versionId = `initial:${payload.problem.id}:1`;
    const identity = crypto.randomUUID();
    // The unique bootstrap marker makes concurrent seed transactions harmless without replacing edits.
    db.batch([
      db
        .prepare(
          'INSERT INTO oj_problems(id,course_id,lesson_id,current_version_id,published,created_at,updated_at) VALUES(?,?,?,NULL,0,?,?) ON CONFLICT(id) DO NOTHING',
        )
        .bind(
          payload.problem.id,
          payload.problem.courseId,
          payload.problem.lessonId,
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO oj_problem_versions(id,problem_id,revision,spec_json,checksum,created_by,created_at) SELECT ?,?,1,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM oj_problem_versions WHERE problem_id=?) AND NOT EXISTS(SELECT 1 FROM oj_problem_drafts WHERE problem_id=?)',
        )
        .bind(
          versionId,
          payload.problem.id,
          JSON.stringify(payload.problem),
          problemChecksum(payload),
          identity,
          now,
          payload.problem.id,
          payload.problem.id,
        ),
      ...payload.cases.map((c, ordinal) =>
        db
          .prepare(
            'INSERT INTO oj_test_cases(id,version_id,ordinal,input,expected_output,hidden,name,weight) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=? AND created_by=?)',
          )
          .bind(
            `${versionId}:${ordinal}`,
            versionId,
            ordinal,
            c.input,
            c.expectedOutput,
            Number(c.hidden),
            c.name,
            c.weight,
            versionId,
            identity,
          ),
      ),
      db
        .prepare(
          'UPDATE oj_problems SET current_version_id=?,published=1 WHERE id=? AND EXISTS(SELECT 1 FROM oj_problem_versions WHERE id=? AND created_by=?)',
        )
        .bind(versionId, payload.problem.id, versionId, identity),
    ]);
  }
}
