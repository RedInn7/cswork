import { z } from 'zod';
import type { LeetcodeRegion } from '@/lib/leetcode-sync-types';
import { HttpError } from './http';

export type LeetcodeCredentials = { session: string; csrfToken: string };
export type LeetcodePageRecord = {
  externalId: string;
  slug: string;
  title: string;
  language: string;
  submittedAt: number;
  accepted: boolean;
};
export type LeetcodePage = {
  records: LeetcodePageRecord[];
  hasNext: boolean;
  lastKey: string;
};
export type LeetcodeProvider = {
  identity(
    region: LeetcodeRegion,
    credentials: LeetcodeCredentials,
  ): Promise<string>;
  page(
    region: LeetcodeRegion,
    credentials: LeetcodeCredentials,
    offset: number,
    lastKey: string,
  ): Promise<LeetcodePage>;
};
export const leetcodeOrigin = (region: LeetcodeRegion) =>
  region === 'cn' ? 'https://leetcode.cn' : 'https://leetcode.com';
const MAX_RESPONSE = 2 * 1024 * 1024;
const username = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9_.-]+$/);

/** Fixed upstreams only. Credentials exist in this request closure, never in a job or DB. */
export function createLeetcodeProvider(
  fetcher: typeof fetch = fetch,
  parentSignal?: AbortSignal,
): LeetcodeProvider {
  async function request(
    region: LeetcodeRegion,
    credentials: LeetcodeCredentials,
    path: string,
    query?: string,
  ) {
    const base = leetcodeOrigin(region);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetcher(base + path, {
        method: query ? 'POST' : 'GET',
        redirect: 'error',
        signal: parentSignal
          ? AbortSignal.any([controller.signal, parentSignal])
          : controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Cookie: `LEETCODE_SESSION=${credentials.session}; csrftoken=${credentials.csrfToken}`,
          'X-CSRFToken': credentials.csrfToken,
          Origin: base,
          Referer: `${base}/submissions/`,
        },
        ...(query ? { body: JSON.stringify({ query, variables: {} }) } : {}),
      });
      if (response.status === 401)
        throw new HttpError(401, 'LeetCode 登录已失效，请重新提供登录凭据');
      if (response.status === 403)
        throw new HttpError(
          502,
          'LeetCode 拒绝访问或要求浏览器验证，请稍后重试；本站不会绕过验证',
        );
      if (response.status === 429)
        throw new HttpError(429, 'LeetCode 请求过于频繁，请稍后继续同步');
      if (!response.ok)
        throw new HttpError(502, 'LeetCode 暂时无法访问，请稍后继续同步');
      if (!response.headers.get('content-type')?.includes('application/json'))
        throw new HttpError(502, 'LeetCode 返回了验证页面，未导入本页记录');
      if (Number(response.headers.get('content-length')) > MAX_RESPONSE)
        throw new HttpError(502, 'LeetCode 响应过大，已停止本页同步');
      if (!response.body) throw new HttpError(502, 'LeetCode 响应为空');
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let size = 0,
        text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE) {
          await reader.cancel();
          throw new HttpError(502, 'LeetCode 响应过大，已停止本页同步');
        }
        text += decoder.decode(value, { stream: true });
      }
      if (parentSignal?.aborted || controller.signal.aborted)
        throw new HttpError(502, '同步请求已中断，可稍后继续');
      try {
        return JSON.parse(text + decoder.decode()) as unknown;
      } catch {
        throw new HttpError(502, 'LeetCode 返回格式无效，未导入本页记录');
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // Never pass an upstream error or URL/body to logging: it may contain credentials.
      throw new HttpError(502, 'LeetCode 连接失败或超时，请稍后继续同步');
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async identity(region, credentials) {
      // Observed in the official CN frontend globalData operation, 2026-10-07.
      const value = await request(
        region,
        credentials,
        '/graphql/',
        'query globalData { userStatus { isSignedIn username } }',
      );
      const parsed = z
        .object({
          data: z.object({
            userStatus: z.object({
              isSignedIn: z.boolean(),
              username: z.string().nullable(),
            }),
          }),
        })
        .safeParse(value);
      if (!parsed.success)
        throw new HttpError(502, 'LeetCode 账号接口格式发生变化，已停止同步');
      if (!parsed.data.data.userStatus.isSignedIn)
        throw new HttpError(401, 'LeetCode 登录已失效，请重新登录');
      const name = username.safeParse(parsed.data.data.userStatus.username);
      if (!name.success) throw new HttpError(502, '无法确认 LeetCode 账号身份');
      return name.data;
    },
    async page(region, credentials, offset, lastKey) {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: '20',
        lastkey: lastKey,
      });
      const value = await request(
        region,
        credentials,
        `/api/submissions/?${params}`,
      );
      const parsed = z
        .object({
          submissions_dump: z
            .array(
              z.object({
                id: z.union([
                  z.string().regex(/^\d{1,30}$/),
                  z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
                ]),
                title_slug: z
                  .string()
                  .min(1)
                  .max(200)
                  .regex(/^[a-zA-Z0-9-]+$/),
                title: z.string().min(1).max(500),
                lang: z.string().min(1).max(60),
                timestamp: z.union([
                  z.string().regex(/^\d{1,12}$/),
                  z.number().int().nonnegative(),
                ]),
                status_display: z.string().min(1).max(100),
              }),
            )
            .max(20),
          has_next: z.boolean(),
          last_key: z.string().max(4096).optional(),
        })
        .safeParse(value);
      if (!parsed.success)
        throw new HttpError(
          502,
          'LeetCode 提交接口格式发生变化，未导入本页记录',
        );
      const data = parsed.data;
      if (
        data.has_next &&
        (!data.submissions_dump.length ||
          !data.last_key ||
          data.last_key === lastKey)
      )
        throw new HttpError(
          502,
          'LeetCode 分页标记异常，未将不完整记录标记为完成',
        );
      const ids = new Set<string>();
      const records = data.submissions_dump.map((row) => {
        const externalId = String(row.id),
          seconds = Number(row.timestamp);
        if (
          !Number.isSafeInteger(seconds) ||
          seconds < 1 ||
          seconds * 1000 > Date.now() + 86400000 ||
          ids.has(externalId)
        )
          throw new HttpError(502, 'LeetCode 提交记录异常，已停止本页同步');
        ids.add(externalId);
        return {
          externalId,
          slug: row.title_slug,
          title: row.title,
          language: row.lang,
          submittedAt: seconds * 1000,
          accepted: ['Accepted', '通过'].includes(row.status_display),
        };
      });
      return { records, hasNext: data.has_next, lastKey: data.last_key ?? '' };
    },
  };
}
