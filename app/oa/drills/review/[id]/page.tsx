import '@/app/oa-drills.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CodeReviewDrill } from '@/components/code-review-drill';
import { oaProblemPath } from '@/lib/oa-company-brands';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { oaDrillIndex, oaLibrary } from '@/lib/server/oa-library';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ n?: string }> };

const load = async (id: string) => {
  const drills = oaDrillIndex().get(id),
    found = oaLibrary().problem(id);
  if (!drills || !found) notFound();
  return { drills, ...found };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await load((await params).id);
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? `代码评审练习：${item.title} · CSWork` : `Code review drill: ${item.title} · CSWork`,
      description: zh ? '只读代码，标出有 bug 的行。' : 'Read the code and flag the lines with the bug.',
      path: `/oa/drills/review/${encodeURIComponent(item.id)}`,
    }),
    robots: { index: false, follow: false },
  };
}

/** /oa/drills/review/<id>: read a planted-bug program and flag its faulty lines (signed in). */
export default async function CodeReviewPage({ params, searchParams }: Props) {
  const { item, company, drills } = await load((await params).id);
  const zh = (await requestLocale()) === 'zh';
  const asked = Number((await searchParams).n);
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <Link href="/oa/drills" prefetch={false}>
          {zh ? '调试与评审练习' : 'Debugging drills'}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '代码评审' : 'Code review'}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{zh ? '代码评审练习' : 'CODE REVIEW DRILL'}</p>
        <h1>{item.title}</h1>
        <p>
          {zh
            ? '下面是这道题的一份解答，其中有一到三行写错了。点选你认为有问题的行（可以附一句说明），然后提交查看结果。'
            : 'Below is a solution to this problem with one to three lines wrong. Flag the lines you think are faulty (a note is optional), then submit to see how you did.'}{' '}
          <a href={oaProblemPath(company.slug, item.id)}>{zh ? '先读题面' : 'Read the statement first'}</a>
        </p>
      </div>
      {viewer ? (
        <CodeReviewDrill id={item.id} drills={drills} first={drills.includes(asked) ? asked : drills[0]} zh={zh} />
      ) : (
        <p className="public-library-empty">
          {zh ? '登录后即可练习。' : 'Sign in to practise.'} <Link href="/?view=account" prefetch={false}>
            {zh ? '登录' : 'Sign in'} →
          </Link>
        </p>
      )}
    </>
  );
}
