import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { Person } from './auth';
import { HttpError, json, limit, requirePerson } from './http';
import {
  oaJudgeRegistry,
  oaReadyProblemIds,
  oaVerifiedStatement,
} from './oa-judge';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
const schema = z.object({
  schemaVersion: z.literal(1),
  source: z.object({
    repository: z.literal('https://github.com/RedInn7/OA-Master'),
    commit: z.string().regex(/^[a-f0-9]{40}$/),
    origin: z.literal('https://oamaster.com'),
  }),
  companies: z
    .array(
      z.object({
        slug,
        name: z.string().min(1),
        count: z.number().int().nonnegative(),
      }),
    )
    .max(1000),
  items: z
    .array(
      z.object({
        id: z
          .string()
          .regex(/^oa-[a-z0-9-]+$/)
          .max(200),
        companySlug: slug,
        companyName: z.string().min(1),
        number: z.number().int().positive(),
        title: z.string().min(1).max(2000),
        sourceUrl: z.string().url(),
        languages: z.array(z.string().regex(/^[a-z0-9+#-]+$/)),
        statement: z.string(),
        explanation: z.string(),
        solutions: z.array(
          z.object({
            language: z.string().regex(/^[a-z0-9+#-]+$/),
            code: z.string(),
          }),
        ),
        contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    )
    .max(20000),
});
type Item = z.infer<typeof schema>['items'][number];
// These source-bound stages are included in #17's four-part exercise.
// A related exercise is not evidence that the source stage is independently judged.
const stripeStageHashes: Readonly<Record<string, string>> = {
  'oa-stripe-14':
    '855dfabe02ab9c9b98fbfb73cb7b58c86263ea916321ef358c32b5d619b88d29',
  'oa-stripe-15':
    '95cc4e5aa33812323df61f1f3cda5a388c74879ba14b2e47ced3675b0fe9584e',
  'oa-stripe-16':
    '1894d8ab716b9b5bd294c0af79cd87646297de9be5c6ab733a070ec129cb8d79',
};
const stripeCombinedHash =
  '8edcfc526cb4ae5bdd1fd560c5f28fd90879d1108530ddb7f2b1e18a08d6f585';
function summary(item: Item, ready: ReadonlySet<string> = new Set()) {
  // Explicit projection: titles/languages only, never statements or reference code.
  return {
    id: item.id,
    companySlug: item.companySlug,
    companyName: item.companyName,
    number: item.number,
    title: item.title,
    sourceUrl: item.sourceUrl,
    languages: item.languages,
    judgeStatus: ready.has(item.id)
      ? ('ready' as const)
      : ('reading_only' as const),
    ...(ready.has(item.id) ? { judgeProblemId: item.id } : {}),
  };
}

export function createOaLibrary(
  input: unknown,
  options: {
    solution?: (
      id: string,
      sourceContentHash: string,
    ) => {
      explanation: string;
      solutions: { language: string; code: string }[];
    };
  } = {},
) {
  const catalog = schema.parse(input);
  const companies = new Map(
    catalog.companies.map((company) => [company.slug, company]),
  );
  const items = new Map<string, Item>();
  const counts = new Map<string, number>();
  if (companies.size !== catalog.companies.length)
    throw new Error('Duplicate OA company');
  for (const item of catalog.items) {
    const company = companies.get(item.companySlug);
    const url = new URL(item.sourceUrl);
    if (
      !company ||
      company.name !== item.companyName ||
      items.has(item.id) ||
      !item.id.startsWith(`oa-${item.companySlug}-`) ||
      url.origin !== catalog.source.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.pathname !== `/docs/companies/${item.companySlug}`
    )
      throw new Error('Invalid OA catalog identity or source');
    items.set(item.id, item);
    counts.set(item.companySlug, (counts.get(item.companySlug) || 0) + 1);
  }
  for (const company of companies.values())
    if (company.count !== (counts.get(company.slug) || 0))
      throw new Error('OA company count mismatch');
  function find(id: string) {
    const item = items.get(id);
    if (!item) throw new HttpError(404, 'OA 题目不存在');
    return item;
  }
  return {
    list(params: URLSearchParams, ready: ReadonlySet<string> = new Set()) {
      const query = (params.get('q') || '')
        .trim()
        .slice(0, 180)
        .toLocaleLowerCase();
      const company = (params.get('company') || '').slice(0, 160);
      if (company && !companies.has(company))
        throw new HttpError(400, '未知公司');
      const value = params.get('page') || '1';
      const page = /^\d+$/.test(value)
        ? Math.min(10000, Math.max(1, Number(value)))
        : 1;
      const found = catalog.items.filter(
        (item) =>
          (params.get('ready') !== '1' || ready.has(item.id)) &&
          (!company || item.companySlug === company) &&
          (!query ||
            `${item.id} ${item.title} ${item.companyName} ${item.number}`
              .toLocaleLowerCase()
              .includes(query)),
      );
      return {
        items: found
          .slice((page - 1) * 30, page * 30)
          .map((item) => summary(item, ready)),
        total: found.length,
        page,
        pageSize: 30,
        companies: catalog.companies,
        source: {
          name: 'OA Master',
          url: catalog.source.origin,
          commit: catalog.source.commit,
        },
      };
    },
    detail(id: string, ready: ReadonlySet<string> = new Set()) {
      const item = find(id);
      const combined = items.get('oa-stripe-17');
      const relatedPractice =
        !ready.has(id) &&
        stripeStageHashes[id] === item.contentHash &&
        combined?.contentHash === stripeCombinedHash &&
        ready.has(combined.id)
          ? {
              problemId: combined.id,
              title: 'Payment Intent 四阶段综合练习',
              description:
                '本阶段包含在四阶段综合练习中；本阶段未单独评测。综合练习使用带时间戳的命令，需实现第 1–4 阶段的全部规则，请按练习页的输入格式提交。',
            }
          : undefined;
      return {
        ...summary(item, ready),
        statement: item.statement,
        contentHash: item.contentHash,
        ...(relatedPractice ? { relatedPractice } : {}),
      };
    },
    solution(id: string) {
      const item = find(id);
      if (!options.solution)
        throw new HttpError(409, '这道题的题解正在校验，暂未开放');
      return options.solution(id, item.contentHash);
    },
  };
}
let library: ReturnType<typeof createOaLibrary> | undefined;
export function oaLibrary() {
  if (!library) {
    // Private runtime asset, not public/, a client import, or executable MDX.
    const file = resolve('content/oa-master/catalog.json');
    if (statSync(file).size > 64 * 1024 * 1024)
      throw new Error('OA catalog exceeds size budget');
    library = createOaLibrary(JSON.parse(readFileSync(file, 'utf8')), {
      solution: (id, sourceContentHash) =>
        oaJudgeRegistry().solution(id, sourceContentHash),
    });
  }
  return library;
}

export async function handleOaLibrary(
  request: Request,
  person: Person | null,
  path: string[],
) {
  // Same authenticated audience as the existing algorithm library; no public content endpoint.
  requirePerson(person);
  const [id, action, ...extra] = path;
  if (
    request.method !== 'GET' ||
    extra.length ||
    (action && action !== 'solution')
  )
    throw new HttpError(404, 'OA 接口不存在');
  await limit(person, 'oa-library-read', 120);
  const data = oaLibrary();
  // Reference snippets in the imported source are never returned by the live API.
  if (id && action === 'solution') {
    return json(data.solution(id));
  }
  const ready = await oaReadyProblemIds();
  if (id) {
    const detail = data.detail(id, ready);
    if (ready.has(id)) detail.statement = await oaVerifiedStatement(id);
    return json(detail);
  }
  return json(data.list(new URL(request.url).searchParams, ready));
}
