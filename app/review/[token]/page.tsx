import '../../lists/lists.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CodeReview } from '@/components/code-review';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  // No canonical or Open Graph URL: the path is the secret. Never indexed, never sent on as a referrer.
  return {
    title: zh ? '代码评审 · cswork' : 'Code review · cswork',
    description: zh ? '一份提交的私密评审链接。' : 'A private review link for one submission.',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

/** /review/<token|id>: a private code review link (components/code-review.tsx, lib/server/code-reviews.ts). */
export default async function ReviewPage({ params }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const { token } = await params;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <div className="lists-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '代码评审' : 'code review'}</span>
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        {viewer ? (
          <CodeReview token={token} />
        ) : (
          <p className="cr-state">
            {zh ? '登录后再打开这条链接，就能看到代码和评论。' : 'Sign in, then open this link again to read the code and its comments.'}{' '}
            <Link href="/?view=account" prefetch={false}>
              {zh ? '登录' : 'Sign in'} →
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}
