import '@/app/oa-drills.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { DrillDone } from '@/components/code-review-drill';
import { oaCompanyName, oaProblemPath } from '@/lib/oa-company-brands';
import { topicName } from '@/lib/route-stops';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { oaReadyProblems } from '@/lib/server/oa-judge';
import { oaDrillIndex, oaLibrary } from '@/lib/server/oa-library';
import { oaTopic } from '@/lib/server/oa-topics';

/** Rows shown at once; the company and topic filters narrow the rest. */
const SHOWN = 60;

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? 'OA 调试与代码评审练习 · CSWork' : 'OA debugging and code-review drills · CSWork',
      description: zh
        ? '在真实 OA 题的代码里找出并修好埋入的 bug，或者只读代码、标出有问题的行。'
        : 'Find and fix a planted bug in real OA solutions, or read the code and flag the faulty lines.',
      path: '/oa/drills',
    }),
    // Members only: the drills are the reference solutions a line or three off.
    robots: { index: false, follow: false },
  };
}

type Props = { searchParams: Promise<{ company?: string; topic?: string }> };

/** /oa/drills: OA problems with debugging drills, by company and topic, signed in only. */
export default async function OaDrillsPage({ searchParams }: Props) {
  const locale = await requestLocale(),
    zh = locale === 'zh';
  const { company = '', topic = '' } = await searchParams;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const intro = (
    <>
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '调试与评审练习' : 'Debugging drills'}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{zh ? 'OA 调试 · 代码评审' : 'OA DEBUGGING · CODE REVIEW'}</p>
        <h1>{zh ? '这段代码有 bug，找出来。' : 'This code has a bug. Find it.'}</h1>
        <p>
          {zh
            ? '每段代码都是一道 OA 题的正确解，只被改坏了一到三行。修 bug：改动不超过限定行数并通过全部测试；代码评审：只读代码，标出有问题的行。练习不计积分，也不算作通过这道题。'
            : "Each program is a correct solution to an OA problem with one to three lines broken. Fix it: pass every test while changing no more than the allowed lines. Review it: read the code and flag the faulty lines. Drills earn no points and don't mark the problem solved."}
        </p>
      </div>
    </>
  );
  if (!viewer)
    return (
      <>
        {intro}
        <p className="public-library-empty">
          {zh ? '登录后即可练习。' : 'Sign in to practise.'} <a href="/?view=account">{zh ? '登录' : 'Sign in'} →</a>
        </p>
      </>
    );
  const ready = await oaReadyProblems();
  const rows = [...oaDrillIndex()].flatMap(([id, drills]) => {
    const found = ready.has(id) ? oaLibrary().problem(id) : undefined;
    return found ? [{ id, drills, title: found.item.title, company: found.company, topics: oaTopic(id)?.t ?? [] }] : [];
  });
  const tally = (keys: string[]) => {
    const counts = new Map<string, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const companies = tally(rows.map((r) => r.company.slug));
  const names = new Map(rows.map((r) => [r.company.slug, oaCompanyName(r.company.slug, r.company.name, locale)]));
  const inCompany = rows.filter((r) => !company || r.company.slug === company);
  const topics = tally(inCompany.flatMap((r) => r.topics));
  const shown = inCompany.filter((r) => !topic || r.topics.includes(topic));
  const href = (next: { company?: string; topic?: string }) => {
    const query = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/oa/drills${query ? `?${query}` : ''}`;
  };
  return (
    <>
      {intro}
      <nav className="oa-drills-filters" aria-label={zh ? '筛选' : 'Filters'}>
        <p>
          <span>{zh ? '公司' : 'Company'}</span>
          <a href={href({})} aria-current={!company ? 'page' : undefined}>
            {zh ? '全部' : 'All'} <small>{rows.length}</small>
          </a>
          {companies.slice(0, 40).map(([slug, n]) => (
            <a key={slug} href={href({ company: slug })} aria-current={company === slug ? 'page' : undefined}>
              {names.get(slug)} <small>{n}</small>
            </a>
          ))}
        </p>
        <p>
          <span>{zh ? '知识点' : 'Topic'}</span>
          <a href={href({ company })} aria-current={!topic ? 'page' : undefined}>
            {zh ? '全部' : 'All'}
          </a>
          {topics.slice(0, 30).map(([slug, n]) => (
            <a key={slug} href={href({ company, topic: slug })} aria-current={topic === slug ? 'page' : undefined}>
              {topicName(slug, zh)} <small>{n}</small>
            </a>
          ))}
        </p>
      </nav>
      <ul className="oa-drills-list">
        {shown.slice(0, SHOWN).map((row) => (
          <li key={row.id}>
            <div>
              <a href={oaProblemPath(row.company.slug, row.id)}>{row.title}</a>
              <small>
                {names.get(row.company.slug)}
                {row.topics.length > 0 && ` · ${row.topics.map((t) => topicName(t, zh)).join(' / ')}`}
              </small>
            </div>
            <DrillDone id={row.id} drills={row.drills} zh={zh} />
            <p className="oa-drills-actions">
              <span>{zh ? '修 bug' : 'Fix'}</span>
              {row.drills.map((n, i) => (
                <a
                  key={n}
                  href={`/?${new URLSearchParams({ view: 'problem', problem: row.id, drill: String(n) })}`}
                  aria-label={zh ? `修 bug：第 ${i + 1} 段代码` : `Fix the bug in program ${i + 1}`}
                >
                  {i + 1}
                </a>
              ))}
              <a href={`/oa/drills/review/${encodeURIComponent(row.id)}`}>{zh ? '代码评审' : 'Code review'}</a>
            </p>
          </li>
        ))}
      </ul>
      {shown.length > SHOWN && (
        <p className="oa-drills-note">
          {zh
            ? `共 ${shown.length} 道，这里列出前 ${SHOWN} 道；按公司或知识点筛选可以看到其余的。`
            : `${shown.length} problems; the first ${SHOWN} are listed. Filter by company or topic to see the rest.`}
        </p>
      )}
    </>
  );
}
