import { randomInt } from 'node:crypto';
import { z } from 'zod';
import lcMapFile from '@/lib/content/company-lc-map.json';
import { curatedByNumber } from '@/lib/ling-curated';
import {
  drawMock,
  LADDER,
  REPORT_SLACK,
  scoreMock,
  seededRandom,
  slotOf,
  summarizeAttempts,
  type MockSource,
  type PoolItem,
  type Scoring,
} from '@/lib/mock-oa';
import type { Person } from './auth';
import { hiddenCompanies } from './env';
import {
  boundedText,
  HttpError,
  json,
  limit,
  limitReader,
  requirePerson,
  rows,
} from './http';
import { MOCK_PRESETS_UPDATED, shownMockPresets } from './mock-oa-presets';
import { oaLibrary } from './oa-library';
import { oaTopic } from './oa-topics';
import { listProblemSummaries } from './oj-problems';

/** Content company slug → judgeable LeetCode ids (lib/content/company-lc-map.json). */
const lcMap = new Map(
  Object.entries(
    (lcMapFile as { companies: Record<string, { id: string }[]> }).companies,
  ).map(([slug, list]) => [
    slug,
    list.map((entry) => entry.id).filter((id) => /^lc-\d{1,6}$/.test(id)),
  ]),
);

export type MockCatalogue = {
  oa: Map<string, PoolItem[]>;
  lc: Map<string, PoolItem>;
};
/**
 * Published, verified problems anyone may judge, grouped for the pools. OA problems
 * take the estimated difficulty and topics (lib/content/oa-topics.json) and leave
 * out concept, SQL and other non-coding questions; one without an estimate keeps its
 * package label as a loose fit. A LeetCode problem's topic is its Line 500 stop.
 */
export function mockCatalogue(
  problems: readonly { id: string; difficulty?: string }[],
): MockCatalogue {
  const oa = new Map<string, PoolItem[]>(),
    lc = new Map<string, PoolItem>();
  for (const p of problems) {
    const number = /^lc-(\d{1,6})$/.exec(p.id)?.[1];
    if (number) {
      const stop = curatedByNumber.get(Number(number))?.sectionSlug;
      lc.set(p.id, {
        id: p.id,
        difficulty: slotOf(p.difficulty),
        loose: false,
        ...(stop && { topics: [stop] }),
      });
    }
    const company = /^oa-(.+)-\d+$/.exec(p.id)?.[1];
    if (!company) continue;
    const meta = oaTopic(p.id);
    if (meta && meta.k !== 'coding') continue;
    oa.set(company, [
      ...(oa.get(company) ?? []),
      meta
        ? { id: p.id, difficulty: meta.d, loose: false, topics: meta.t }
        : { id: p.id, difficulty: slotOf(p.difficulty), loose: true },
    ]);
  }
  return { oa, lc };
}

/**
 * (A) OA problems of the aliases' companies ∪ (B) their mapped LeetCode problems
 * that are judgeable here. No aliases means the whole catalogue (custom mode).
 */
export function mockPool(
  catalogue: MockCatalogue,
  aliases: readonly string[] | null,
  source: MockSource,
  hidden: ReadonlySet<string> = hiddenCompanies(),
  map: ReadonlyMap<string, readonly string[]> = lcMap,
): PoolItem[] {
  const shown = aliases?.filter((a) => !hidden.has(a));
  if (shown && !shown.length) return [];
  const items = new Map<string, PoolItem>();
  if (source !== 'lc')
    for (const [company, list] of catalogue.oa)
      if (!hidden.has(company) && (!shown || shown.includes(company)))
        for (const item of list) items.set(item.id, item);
  if (source !== 'oa') {
    const ids = shown
      ? shown.flatMap((a) => map.get(a) ?? [])
      : [...catalogue.lc.keys()];
    for (const id of ids) {
      const item = catalogue.lc.get(id);
      if (item) items.set(id, item);
    }
  }
  return [...items.values()];
}

// ponytail: one catalogue snapshot for 5 minutes; publishes show up after that.
let cached: { at: number; value: Promise<MockCatalogue> } | null = null;
function catalogue() {
  if (!cached || Date.now() - cached.at > 300000) {
    const value = listProblemSummaries(null).then(mockCatalogue);
    cached = { at: Date.now(), value };
    value.catch(() => {
      if (cached?.value === value) cached = null;
    });
  }
  return cached.value;
}

function catalogNames() {
  try {
    return new Map(
      oaLibrary()
        .list(new URLSearchParams())
        .companies.map((c) => [c.slug, c.name]),
    );
  } catch {
    return new Map<string, string>();
  }
}

/** Presets with live pool sizes, plus other companies a custom mock can draw from. */
export async function mockPresetsWithPools() {
  const cat = await catalogue(),
    shown = shownMockPresets(),
    hidden = hiddenCompanies();
  const companies = shown.map((c) => {
    const oa = mockPool(cat, c.aliases, 'oa').length,
      lc = mockPool(cat, c.aliases, 'lc').length;
    return { ...c, pool: { oa, lc, total: oa + lc } };
  });
  const taken = new Set(shown.flatMap((c) => [c.slug, ...c.aliases]));
  const names = catalogNames();
  const others = [...new Set([...cat.oa.keys(), ...lcMap.keys()])]
    .filter((slug) => !taken.has(slug) && !hidden.has(slug))
    .map((slug) => {
      const oa = mockPool(cat, [slug], 'oa').length,
        lc = mockPool(cat, [slug], 'lc').length;
      return { slug, name: names.get(slug) ?? slug, pool: { oa, lc, total: oa + lc } };
    })
    .filter((c) => c.pool.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    updated: MOCK_PRESETS_UPDATED,
    companies,
    others,
    all: {
      oa: mockPool(cat, null, 'oa').length,
      lc: mockPool(cat, null, 'lc').length,
    },
  };
}

/** Server-rendered pages: each shown preset's pool size, or null when the catalogue is unavailable. */
export async function mockPoolSizes() {
  try {
    const cat = await catalogue();
    return new Map(
      shownMockPresets().map((c) => [c.slug, mockPool(cat, c.aliases, 'mixed').length]),
    );
  } catch {
    // The pages still describe the formats without live counts.
    return null;
  }
}

const companySlug = z.string().regex(/^[a-z0-9-]{1,80}$/);
const problemId = z.string().regex(/^(?:oa-[a-z0-9-]{1,180}|lc-\d{1,6})$/);
const drawSchema = z
  .object({
    company: companySlug.optional(),
    custom: z
      .object({
        company: companySlug.optional(),
        questions: z.number().int().min(1).max(4),
        minutes: z.number().int().min(15).max(180),
        slots: z.array(z.enum(['easy', 'medium', 'hard'])).max(4).optional(),
        source: z.enum(['mixed', 'oa', 'lc']).default('mixed'),
      })
      .strict()
      .optional(),
    exclude: z.array(z.string().max(200)).max(200).default([]),
  })
  .strict()
  .refine((d) => !d.company !== !d.custom);

export async function drawMockOa(p: Person, input: unknown) {
  const d = drawSchema.parse(input);
  const hidden = hiddenCompanies(),
    shown = shownMockPresets(hidden);
  const slug = d.company ?? d.custom?.company ?? null;
  const preset = slug
    ? shown.find((c) => c.slug === slug || c.aliases.includes(slug))
    : undefined;
  if (slug && (hidden.has(slug) || (d.company && !preset)))
    throw new HttpError(404, '没有这家公司的模拟 OA');
  const custom = d.custom;
  const questions = custom ? custom.questions : preset!.questions;
  const slots = custom
    ? custom.slots?.length === questions
      ? custom.slots
      : LADDER[questions]
    : preset!.slots;
  const source: MockSource = custom ? custom.source : 'mixed';
  const pool = mockPool(
    await catalogue(),
    preset ? preset.aliases : slug ? [slug] : null,
    source,
    hidden,
  );
  const solved = new Set(
    (
      await rows<{ problem_id: string }>(
        "SELECT DISTINCT problem_id FROM submissions WHERE user_id=? AND mode='judge' AND status='accepted'",
        p.id,
      )
    ).map((r) => r.problem_id),
  );
  const ids = drawMock({
    pool,
    slots,
    solved,
    exclude: new Set(d.exclude),
    topics: preset?.topics,
    random: seededRandom(randomInt(2 ** 31)),
  });
  if (!ids)
    throw new HttpError(409, '这家公司的可判题还不够，换一家公司或减少题量');
  return {
    ids,
    company: preset?.slug ?? slug,
    name: preset?.name ?? (slug ? (catalogNames().get(slug) ?? slug) : null),
    platform: preset?.platform ?? null,
    preset: !custom,
    questions,
    minutes: custom ? custom.minutes : preset!.minutes,
    slots,
    scoring: preset?.scoring ?? 'tests',
    source,
    // The client keeps the offset: submissions are timed by this clock.
    now: Date.now(),
  };
}

/** Attempts, best result and first AC per question in the exam window, plus the score. */
export async function mockReport(p: Person, params: URLSearchParams) {
  const ids = (params.get('ids') || '').split(',').filter(Boolean),
    from = Number(params.get('from')),
    to = Number(params.get('to'));
  if (
    !ids.length ||
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => problemId.safeParse(id).success) ||
    !Number.isSafeInteger(from) ||
    !Number.isSafeInteger(to) ||
    to <= from ||
    to - from > 4 * 3600000
  )
    throw new HttpError(400, '模拟考试参数无效');
  const scoring: Scoring = params.get('scoring') === 'gca' ? 'gca' : 'tests';
  const slots = (params.get('slots') || '')
    .split(',')
    .map((s) => slotOf(s) ?? 'medium');
  const found = await rows<{
    problem_id: string;
    status: string;
    passed: number;
    total: number;
    created_at: number;
  }>(
    `SELECT problem_id,status,passed,total,created_at FROM submissions WHERE user_id=? AND mode='judge' AND created_at BETWEEN ? AND ? AND problem_id IN (${ids.map(() => '?').join(',')}) ORDER BY created_at`,
    p.id,
    from,
    to,
    ...ids,
  );
  const items = ids.map((id) => ({
    id,
    // First-AC times count from the real start, not the slack-widened window.
    ...summarizeAttempts(
      found.filter((s) => s.problem_id === id),
      from + REPORT_SLACK,
    ),
  }));
  return {
    items,
    score: scoreMock(
      items.map((i) => i.best),
      scoring,
      ids.map((_, i) => slots[i] ?? 'medium'),
    ),
    scoring,
    pending: items.some((i) => i.pending),
  };
}

export async function handleMockOa(
  request: Request,
  p: Person | null,
  path: string[],
) {
  const [action, ...extra] = path;
  if (extra.length) throw new HttpError(404, '模拟 OA 接口不存在');
  // Formats and pool sizes are public; drawing and reports need an account.
  if (request.method === 'GET' && action === 'presets') {
    await limitReader(request, p, 'mock-oa-read', 60);
    return json(await mockPresetsWithPools());
  }
  requirePerson(p);
  if (request.method === 'GET' && action === 'report') {
    await limit(p, 'mock-oa-report', 120);
    return json(await mockReport(p, new URL(request.url).searchParams));
  }
  if (request.method === 'POST' && action === 'draw') {
    await limit(p, 'mock-oa-draw', 20);
    let data: unknown;
    try {
      data = JSON.parse(await boundedText(request, 20000));
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(400, '无效的 JSON');
    }
    return json(await drawMockOa(p, data));
  }
  throw new HttpError(404, '模拟 OA 接口不存在');
}
