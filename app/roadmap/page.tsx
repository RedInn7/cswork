import '../library/library.css';
import './roadmap.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { RolePath } from '@/components/role-path';
import { GUIDE_CHAPTERS, guidePath } from '@/lib/career-guide';
import { ROLE_KEYS, ROLES, ROUTE_ID, isRole } from '@/lib/content/role-paths';
import { curatedEntries } from '@/lib/ling-curated';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { aiEnabled } from '@/lib/server/ai-tutor';
import { requestLocale } from '@/lib/server/locale';
import { resolveRolePath, routeCatalog } from '@/lib/server/role-paths';
import { sdChapters, sdParts, sdPath } from '@/lib/server/system-design-course';
import { LibraryPageView } from '../library/page-view';
import { RoadmapTracks, type SdPart } from './tracks';

const COPY = {
  zh: {
    title: `面试路线图：算法知识点依赖图、系统设计与行为面试 | ${SITE_NAME}`,
    description:
      '三条轨道看清准备顺序：35 个算法知识点的先修关系图，系统设计从答题框架到案例、LLD、并发和 ML 系统设计的章节，以及行为面试的准备入口。登录后显示自己的进度。',
    eyebrow: '路线图 · 编码 / 系统设计 / 行为面试',
    heading: '先学什么、再学什么，一张图看清。',
    crumb: '路线图',
  },
  en: {
    title: `Interview Roadmap: Topic Prerequisites, System Design & Behavioral | ${SITE_NAME}`,
    description:
      'Three tracks in study order: a prerequisite graph of 35 algorithm topics, the system design chapters from the framework to case studies, low-level design, concurrency and ML system design, and where to prepare behavioral rounds. Sign in to see your progress.',
    eyebrow: 'ROADMAP · CODING / SYSTEM DESIGN / BEHAVIORAL',
    heading: 'What to learn first, and what comes next.',
    crumb: 'Roadmap',
  },
};

// Framework → building blocks → case studies → LLD → concurrency → ML → key technologies → patterns → LLD cases → API. A chapter takes the course
// part it reads in (sdParts), so a new chapter lands beside its neighbours; unknown parts read as cases.
const PART_FROM: Record<string, SdPart> = {
  'ood-interview-approach': 'lld',
  'concurrency-primitives': 'concurrency',
  'ml-design-framework': 'ml',
  'tech-kafka': 'tech',
  'pattern-real-time-updates': 'patterns',
  'lld-case-atm': 'lld-cases',
  'api-rest-vs-rpc-graphql': 'api',
};
const sdPartOf = (slug: string): SdPart =>
  slug === 'framework'
    ? 'framework'
    : slug === 'building-blocks'
      ? 'blocks'
      : PART_FROM[sdParts.find((part) => part.chapters.some((chapter) => chapter.slug === slug))?.from ?? ''] ??
        'cases';
// The behavioral prep chapters of the career guide.
const BEHAVIORAL = ['phone-screen', 'onsite'];

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/roadmap' });
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RoadmapPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  // ?role= picks a role path (lib/content/role-paths.ts), ?route=r-<id> a learner's own route, which
  // alone carries the catalog of every step (tens of KB); the canonical page stays /roadmap.
  const { role: rawRole, route: rawRoute } = await searchParams;
  const route = typeof rawRoute === 'string' && ROUTE_ID.test(rawRoute) ? rawRoute : null;
  const role = !route && isRole(rawRole) ? rawRole : null;
  const totals: Record<string, { solved: number; total: number }> = {};
  for (const entry of curatedEntries)
    (totals[entry.sectionSlug] ??= { solved: 0, total: 0 }).total++;
  return (
    <div className="public-library roadmap-public" lang={zh ? 'zh-CN' : 'en'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: '/roadmap' },
          ]),
        }}
      />
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '路线图' : 'roadmap'}</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '打开 500 路题单' : 'Open the Line 500 list'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <div className="public-library-intro">
          <p className="public-library-eyebrow">{c.eyebrow}</p>
          <h1>{c.heading}</h1>
          <p>{c.description}</p>
        </div>
        <RolePath
          english={!zh}
          role={role}
          roles={ROLE_KEYS.map((key) => ({
            key,
            name: zh ? ROLES[key].zh : ROLES[key].en,
            blurb: zh ? ROLES[key].blurbZh : ROLES[key].blurbEn,
          }))}
          steps={role ? resolveRolePath(role, zh, aiEnabled()) : []}
          route={route}
          catalog={route ? routeCatalog(zh, aiEnabled()) : undefined}
        />
        <RoadmapTracks
          english={!zh}
          totals={totals}
          sd={sdChapters.map((chapter) => ({
            slug: chapter.slug,
            title: zh ? chapter.titleZh : chapter.titleEn,
            href: sdPath(chapter.slug),
            part: sdPartOf(chapter.slug),
          }))}
          guide={GUIDE_CHAPTERS.filter((chapter) => BEHAVIORAL.includes(chapter.slug)).map((chapter) => ({
            title: chapter.title[zh ? 0 : 1],
            summary: chapter.summary[zh ? 0 : 1],
            href: guidePath(chapter.slug),
          }))}
        />
      </main>
      <footer className="public-library-footer">
        <Link href="/topics" prefetch={false}>
          {zh ? '模板速查' : 'Templates'}
        </Link>
        <Link href={sdPath()} prefetch={false}>
          {zh ? '系统设计' : 'System design'}
        </Link>
        <Link href={guidePath()} prefetch={false}>
          {zh ? '求职指南' : 'Career guide'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私' : 'Privacy'}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
