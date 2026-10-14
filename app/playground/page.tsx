import '../library/library.css';
import '../editor.css';
import './playground.css';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { LibraryPageView } from '../library/page-view';
import { PlaygroundView } from './view';

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? '代码沙盒 · cswork' : 'Code playground · cswork',
      description: zh
        ? '不挑题目，直接写 Python、C++、Java、Go，带自定义输入运行，链接一键分享。'
        : 'Write Python, C++, Java or Go with your own input, run it, and share it as a link.',
      path: '/playground',
    }),
    // Shared links carry someone's code in the fragment: nothing here is a landing page.
    robots: { index: false, follow: false },
  };
}

/** /playground: a scratch editor on the judge's custom-input runner (lib/server/oj-submissions.ts). */
export default async function PlaygroundPage() {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <PlaygroundView
        signedIn={!!viewer}
        verified={!!viewer && (viewer.verified || viewer.role === 'teacher')}
      />
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </>
  );
}
