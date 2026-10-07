import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite } from '@/db/sqlite';
import type {
  LeetcodeAcceptedRecord,
  LeetcodeSyncRun,
  LeetcodeSyncState,
} from '@/lib/leetcode-sync-types';
import type { Person } from './auth';
import {
  createLeetcodeProvider,
  leetcodeOrigin,
  type LeetcodeCredentials,
  type LeetcodeProvider,
} from './leetcode-provider';
import { boundedText, HttpError, json, limit } from './http';

type RunRow = {
  id: string;
  user_id: string;
  region: 'cn' | 'us';
  external_username: string;
  round_id: string;
  status: LeetcodeSyncRun['status'];
  offset: number;
  last_key: string;
  pages: number;
  scanned: number;
  accepted: number;
  matched: number;
  unmatched: number;
  error: string | null;
  idempotency_key: string;
  created_at: number;
  updated_at: number;
};
const publicRun = (r: RunRow): LeetcodeSyncRun => ({
  id: r.id,
  region: r.region,
  username: r.external_username,
  roundId: r.round_id,
  status: r.status,
  scanned: r.scanned,
  accepted: r.accepted,
  matched: r.matched,
  unmatched: r.unmatched,
  pages: r.pages,
  error: r.error,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
function owned(userId: string, id: string): RunRow {
  const row = sqlite()
    .prepare('SELECT * FROM leetcode_sync_runs WHERE user_id=? AND id=?')
    .get(userId, id) as RunRow | undefined;
  if (!row) throw new HttpError(404, '同步任务不存在');
  return row;
}
function requireRound(userId: string, roundId: string) {
  if (
    !sqlite()
      .prepare('SELECT 1 FROM practice_rounds WHERE user_id=? AND id=?')
      .get(userId, roundId)
  )
    throw new HttpError(404, '刷题轮次不存在');
}
const credential = z
  .string()
  .min(1)
  .max(8192)
  .regex(/^[A-Za-z0-9._~%+=\/-]+$/);
const credentials = {
  session: credential,
  csrfToken: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9]+$/),
};
const command = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('start'),
      region: z.enum(['cn', 'us']),
      roundId: z.string().min(1).max(100),
      idempotencyKey: z.string().uuid(),
      ...credentials,
    })
    .strict(),
  z
    .object({
      action: z.literal('continue'),
      runId: z.string().uuid(),
      ...credentials,
    })
    .strict(),
  z.object({ action: z.literal('cancel'), runId: z.string().uuid() }).strict(),
]);

export function leetcodeSyncState(userId: string, page = 1): LeetcodeSyncState {
  const db = sqlite();
  page = Math.max(1, Math.min(100000, Math.trunc(page) || 1));
  const counts = db
    .prepare(`SELECT COUNT(*) AS accepted,
    SUM(EXISTS(SELECT 1 FROM study_library l WHERE l.slug=r.slug)) AS matched
    FROM leetcode_accepted_records r WHERE r.user_id=?`)
    .get(userId) as { accepted: number; matched: number | null };
  const records = db
    .prepare(`SELECT r.id,r.region,r.external_username AS username,r.external_submission_id AS externalId,
    r.slug,r.title,r.language,r.submitted_at AS submittedAt,r.source_url AS sourceUrl,
    (SELECT l.id FROM study_library l WHERE l.slug=r.slug) AS matchedProblemId
    FROM leetcode_accepted_records r WHERE r.user_id=? ORDER BY r.submitted_at DESC,r.id DESC LIMIT 30 OFFSET ?`)
    .all(userId, (page - 1) * 30) as LeetcodeAcceptedRecord[];
  const runs = (
    db
      .prepare(
        'SELECT * FROM leetcode_sync_runs WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 30',
      )
      .all(userId) as RunRow[]
  ).map(publicRun);
  return {
    runs,
    records,
    page,
    pageSize: 30,
    total: counts.accepted,
    hasMore: page * 30 < counts.accepted,
    summary: {
      accepted: counts.accepted,
      matched: counts.matched ?? 0,
      unmatched: counts.accepted - (counts.matched ?? 0),
    },
  };
}

async function processPage(
  userId: string,
  run: RunRow,
  secret: LeetcodeCredentials,
  provider: LeetcodeProvider,
) {
  if (run.status === 'complete' || run.status === 'truncated')
    return publicRun(run);
  try {
    const identity = await provider.identity(run.region, secret);
    if (identity !== run.external_username)
      throw new HttpError(
        409,
        '当前 LeetCode 账号与该同步任务不一致，请使用原账号继续',
      );
    const page = await provider.page(
      run.region,
      secret,
      run.offset,
      run.last_key,
    );
    return sqlite().transaction(() => {
      const db = sqlite(),
        current = owned(userId, run.id);
      // Concurrent retries may fetch the same page, but only one commits. Cancellation wins.
      if (
        current.updated_at !== run.updated_at ||
        current.offset !== run.offset ||
        current.status !== run.status
      )
        return publicRun(current);
      requireRound(userId, run.round_id);
      const seen = db.prepare(
        'SELECT 1 FROM leetcode_sync_seen WHERE run_id=? AND external_submission_id=?',
      );
      if (page.records.some((r) => seen.get(run.id, r.externalId)))
        throw new HttpError(
          409,
          'LeetCode 分页出现重复，可能同步时提交了新代码；请新建同步任务重试，已有记录会自动去重',
        );
      let accepted = 0,
        matched = 0;
      const now = Math.max(Date.now(), run.updated_at + 1);
      for (const record of page.records) {
        db.prepare(
          'INSERT INTO leetcode_sync_seen(run_id,external_submission_id) VALUES(?,?)',
        ).run(run.id, record.externalId);
        if (!record.accepted) continue;
        accepted++;
        if (
          db
            .prepare('SELECT 1 FROM study_library WHERE slug=?')
            .get(record.slug)
        )
          matched++;
        const sourceUrl = `${leetcodeOrigin(run.region)}/submissions/detail/${record.externalId}/`;
        db.prepare(`INSERT INTO leetcode_accepted_records(id,user_id,region,external_username,external_submission_id,slug,title,language,submitted_at,source_url,imported_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,region,external_username,external_submission_id) DO NOTHING`).run(
          randomUUID(),
          userId,
          run.region,
          run.external_username,
          record.externalId,
          record.slug,
          record.title,
          record.language,
          record.submittedAt,
          sourceUrl,
          now,
        );
        const saved = db
          .prepare(
            'SELECT id,slug FROM leetcode_accepted_records WHERE user_id=? AND region=? AND external_username=? AND external_submission_id=?',
          )
          .get(
            userId,
            run.region,
            run.external_username,
            record.externalId,
          ) as { id: string; slug: string };
        if (saved.slug !== record.slug)
          throw new HttpError(502, 'LeetCode 提交编号与题目不一致，已停止同步');
        db.prepare(
          'INSERT INTO leetcode_round_records(user_id,round_id,record_id,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING',
        ).run(userId, run.round_id, saved.id, now);
      }
      const status = !page.hasNext
        ? 'complete'
        : run.pages + 1 >= 2000
          ? 'truncated'
          : 'running';
      const error =
        status === 'truncated'
          ? '已达到单次同步 40,000 条提交上限，历史记录尚未全部同步'
          : null;
      db.prepare(
        `UPDATE leetcode_sync_runs SET status=?,offset=?,last_key=?,pages=pages+1,scanned=scanned+?,accepted=accepted+?,matched=matched+?,unmatched=unmatched+?,error=?,updated_at=? WHERE id=? AND user_id=?`,
      ).run(
        status,
        run.offset + page.records.length,
        page.lastKey,
        page.records.length,
        accepted,
        matched,
        accepted - matched,
        error,
        now,
        run.id,
        userId,
      );
      return publicRun(owned(userId, run.id));
    })();
  } catch (error) {
    const safe =
      error instanceof HttpError
        ? error
        : new HttpError(502, '同步失败，请稍后继续');
    sqlite()
      .prepare(
        "UPDATE leetcode_sync_runs SET status='failed',error=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=? AND offset=? AND status=?",
      )
      .run(
        safe.message,
        Math.max(Date.now(), run.updated_at + 1),
        run.id,
        userId,
        run.updated_at,
        run.offset,
        run.status,
      );
    throw safe;
  }
}

/** Exported for integration tests with a mocked upstream; production supplies no override. */
export async function changeLeetcodeSync(
  userId: string,
  value: unknown,
  provider: LeetcodeProvider = createLeetcodeProvider(),
) {
  const data = command.parse(value),
    db = sqlite();
  if (data.action === 'cancel') {
    const run = owned(userId, data.runId);
    if (run.status !== 'complete' && run.status !== 'truncated')
      db.prepare(
        "UPDATE leetcode_sync_runs SET status='cancelled',error=NULL,updated_at=? WHERE user_id=? AND id=?",
      ).run(Math.max(Date.now(), run.updated_at + 1), userId, run.id);
    return { run: publicRun(owned(userId, run.id)) };
  }
  if (data.action === 'continue')
    return {
      run: await processPage(userId, owned(userId, data.runId), data, provider),
    };
  requireRound(userId, data.roundId);
  const prior = db
    .prepare(
      'SELECT * FROM leetcode_sync_runs WHERE user_id=? AND idempotency_key=?',
    )
    .get(userId, data.idempotencyKey) as RunRow | undefined;
  if (prior) {
    if (prior.region !== data.region || prior.round_id !== data.roundId)
      throw new HttpError(409, '重复请求的站点或刷题轮次不一致');
    if (
      (await provider.identity(data.region, data)) !== prior.external_username
    )
      throw new HttpError(
        409,
        '当前 LeetCode 账号与该同步任务不一致，请使用原账号继续',
      );
    return { run: publicRun(prior) };
  }
  const identity = await provider.identity(data.region, data);
  const id = randomUUID(),
    now = Date.now();
  const inserted = db
    .prepare(`INSERT INTO leetcode_sync_runs(id,user_id,region,external_username,round_id,status,idempotency_key,created_at,updated_at)
    VALUES(?,?,?,?,?,'running',?,?,?) ON CONFLICT(user_id,idempotency_key) DO NOTHING`)
    .run(
      id,
      userId,
      data.region,
      identity,
      data.roundId,
      data.idempotencyKey,
      now,
      now,
    );
  if (!inserted.changes) {
    const existing = db
      .prepare(
        'SELECT * FROM leetcode_sync_runs WHERE user_id=? AND idempotency_key=?',
      )
      .get(userId, data.idempotencyKey) as RunRow;
    if (
      existing.region !== data.region ||
      existing.round_id !== data.roundId ||
      existing.external_username !== identity
    )
      throw new HttpError(409, '重复请求的同步账号或刷题轮次不一致');
    return { run: publicRun(existing) };
  }
  return { run: await processPage(userId, owned(userId, id), data, provider) };
}

export async function handleLeetcodeSync(
  request: Request,
  person: Person,
  path: string[],
) {
  if (path.length) throw new HttpError(404, '同步接口不存在');
  if (request.method === 'GET') {
    await limit(person, 'leetcode-sync-read', 120);
    return json(
      leetcodeSyncState(
        person.id,
        Number(new URL(request.url).searchParams.get('page')) || 1,
      ),
    );
  }
  if (request.method !== 'POST') throw new HttpError(405, '不支持此请求方式');
  await limit(person, 'leetcode-sync-write', 45);
  let value: unknown;
  try {
    value = JSON.parse(await boundedText(request, 12000));
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, '无效的请求内容');
  }
  return json(
    await changeLeetcodeSync(
      person.id,
      value,
      createLeetcodeProvider(fetch, request.signal),
    ),
  );
}
