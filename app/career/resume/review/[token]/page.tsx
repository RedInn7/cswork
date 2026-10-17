import '@/app/code-review.css';
import '@/app/resume-review-link.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ResumeReviewPage } from '@/components/resume-review-link';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  // No canonical or Open Graph URL: the path is the secret. Never indexed, never sent on as a referrer.
  return {
    title: zh ? '简历评审 · CSWork' : 'Resume review · CSWork',
    description: zh ? '一份简历的私密评审链接。' : 'A private review link for one resume.',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/** /career/resume/review/<token|id>: a private resume review link (components/resume-review-link.tsx, lib/server/resume-reviews.ts). */
export default async function ResumeReviewLinkPage({ params }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const { token } = await params;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <a href="/career/resume/builder">{zh ? '简历生成器' : 'Resume builder'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '简历评审' : 'Resume review'}</span>
      </nav>
      {viewer ? (
        <ResumeReviewPage token={token} />
      ) : (
        <p className="cr-state">
          {zh ? '登录后再打开这条链接，就能看到简历和批注。' : 'Sign in, then open this link again to read the resume and its comments.'}{' '}
          <Link href="/?view=account" prefetch={false}>
            {zh ? '登录' : 'Sign in'} →
          </Link>
        </p>
      )}
    </>
  );
}
