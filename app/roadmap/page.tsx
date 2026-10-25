import '../library/library.css';
import './roadmap.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { RolePath } from '@/components/role-path';
import { GUIDE_CHAPTERS, guidePath } from '@/lib/career-guide';
import mcqBank from '@/lib/content/oa-mcq.json';
import { CS_NODES } from '@/lib/cs-track';
import { ROLE_KEYS, ROLES, ROUTE_ID, isRole } from '@/lib/content/role-paths';
import { curatedEntries } from '@/lib/ling-curated';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { beginnerCourse, learnKey } from '@/lib/server/beginner-courses';
import { requestLocale } from '@/lib/server/locale';
import { resolveRolePath, routeCatalog } from '@/lib/server/role-paths';
import { LibraryPageView } from '../library/page-view';
import { RoadmapTracks, type CsTrackData } from './tracks';

const COPY = {
  zh: {
    title: `面试路线图：算法知识点依赖图、系统设计、行为面试与 CS 基础 | ${SITE_NAME}`,
    description:
      '四条轨道看清准备顺序：35 个算法知识点的先修关系图，系统设计从答题框架到案例、LLD、并发和 ML 系统设计的章节，行为面试的准备入口，以及操作系统、计算机网络等 8 个 CS 基础科目。登录后显示自己的进度。',
    eyebrow: '路线图 · 编码 / 系统设计 / 行为面试 / CS 基础',
    heading: '先学什么、再学什么，一张图看清。',
    crumb: '路线图',
  },
  en: {
    title: `Interview Roadmap: Topic Prerequisites, System Design, Behavioral & CS Fundamentals | ${SITE_NAME}`,
    description:
      'Four tracks in study order: a prerequisite graph of 35 algorithm topics, the system design chapters from the framework to case studies, low-level design, concurrency and ML system design, where to prepare behavioral rounds, and eight CS fundamentals subjects from operating systems to networking. Sign in to see your progress.',
    eyebrow: 'ROADMAP · CODING / SYSTEM DESIGN / BEHAVIORAL / CS',
    heading: 'What to learn first, and what comes next.',
    crumb: 'Roadmap',
  },
};

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
  // The CS track: each subject's question count and its crash course's chapters.
  const mcqTotals: Record<string, number> = {};
  for (const q of mcqBank.questions) if (CS_NODES.some((node) => node.id === q.topic)) mcqTotals[q.topic] = (mcqTotals[q.topic] ?? 0) + 1;
  const csCourses: CsTrackData['courses'] = {};
  for (const node of CS_NODES) {
    const course = node.course ? beginnerCourse(node.course) : undefined;
    if (course)
      csCourses[course.slug] = { title: zh ? course.titleZh : course.titleEn, keys: course.chapters.map((c) => learnKey(course.slug, c.slug)) };
  }
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
          steps={role ? resolveRolePath(role, zh) : []}
          route={route}
          catalog={route ? routeCatalog(zh) : undefined}
        />
        <RoadmapTracks
          english={!zh}
          totals={totals}
          // The system design course is taken down (app/system-design/layout.tsx): no track, no chapter links.
          sd={[]}
          guide={GUIDE_CHAPTERS.filter((chapter) => BEHAVIORAL.includes(chapter.slug)).map((chapter) => ({
            title: chapter.title[zh ? 0 : 1],
            summary: chapter.summary[zh ? 0 : 1],
            href: guidePath(chapter.slug),
          }))}
          cs={{ totals: mcqTotals, courses: csCourses }}
        />
      </main>
      <footer className="public-library-footer">
        <Link href="/topics" prefetch={false}>
          {zh ? '模板速查' : 'Templates'}
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
