import { randomInt } from 'node:crypto';
import { z } from 'zod';
import presetsFile from '@/lib/content/mock-oa-presets.json';
import lcMapFile from '@/lib/content/company-lc-map.json';
import {
  drawMock,
  LADDER,
  scoreMock,
  seededRandom,
  slotOf,
  summarizeAttempts,
  type MockSource,
  type PoolItem,
  type Scoring,
  type Slot,
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
import { oaLibrary } from './oa-library';
import { listProblemSummaries } from './oj-problems';

export type MockPreset = Omit<
  (typeof presetsFile)['companies'][number],
  'slots' | 'scoring'
> & { slots: Slot[]; scoring: Scoring };
const presets = presetsFile.companies as MockPreset[];
/** Content company slug → judgeable LeetCode ids (lib/content/company-lc-map.json). */
const lcMap = new Map(
  Object.entries(
    (lcMapFile as { companies: Record<string, { id: string }[]> }).companies,
  ).map(([slug, list]) => [
    slug,
    list.map((entry) => entry.id).filter((id) => /^lc-\d{1,6}$/.test(id)),
  ]),
);

/** Hidden companies (HIDDEN_COMPANIES) never appear, as presets or as aliases. */
export function shownMockPresets(hidden = hiddenCompanies()): MockPreset[] {
  return presets
    .filter((c) => !hidden.has(c.slug))
    .map((c) => ({ ...c, aliases: c.aliases.filter((a) => !hidden.has(a)) }))
    .filter((c) => c.aliases.length);
}

export type MockCatalogue = {
  oa: Map<string, PoolItem[]>;
  lc: Map<string, PoolItem>;
};
/** Published, verified problems anyone may judge, grouped for the pools. */
export function mockCatalogue(
  problems: readonly { id: string; difficulty?: string }[],
): MockCatalogue {
  const oa = new Map<string, PoolItem[]>(),
    lc = new Map<string, PoolItem>();
  for (const p of problems) {
    const item = { id: p.id, difficulty: slotOf(p.difficulty), oa: false };
    if (/^lc-\d{1,6}$/.test(p.id)) lc.set(p.id, item);
    const company = /^oa-(.+)-\d+$/.exec(p.id)?.[1];
    if (company)
      oa.set(company, [...(oa.get(company) ?? []), { ...item, oa: true }]);
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
    .map((slug) => ({
      slug,
      name: names.get(slug) ?? slug,
      pool: mockPool(cat, [slug], 'mixed').length,
    }))
    .filter((c) => c.pool > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    version: presetsFile.version,
    updated: presetsFile.updated,
    companies,
    others,
    all: {
      oa: mockPool(cat, null, 'oa').length,
      lc: mockPool(cat, null, 'lc').length,
    },
  };
}

/** Server-rendered company pages: the preset and its pool size, or null. */
export async function mockPresetPage(slug: string) {
  const preset = shownMockPresets().find((c) => c.slug === slug);
  if (!preset) return null;
  let pool: number | null = null;
  try {
    pool = mockPool(await catalogue(), preset.aliases, 'mixed').length;
  } catch {
    /* The page still describes the format without a live count. */
  }
  return { preset, pool };
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
    ...summarizeAttempts(
      found.filter((s) => s.problem_id === id),
      from,
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
