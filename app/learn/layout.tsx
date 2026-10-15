import '../library/library.css';
import '../system-design/system-design.css';
import './learn.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { requestLocale } from '@/lib/server/locale';

/** The beginner crash courses (/learn, /learn/<course>, /learn/<course>/<chapter>) on the system design course's sheets. */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library sd-public learn-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/learn" prefetch={false}>
          cswork<span> / {zh ? '入门速成课' : 'beginner courses'}</span>
        </Link>
        <Link href="/certify" prefetch={false}>
          {zh ? '学完考个认证' : 'Then take a skill exam'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/learn" prefetch={false}>
          {zh ? '全部速成课' : 'All crash courses'}
        </Link>
        <Link href="/system-design" prefetch={false}>
          {zh ? '系统设计课' : 'System design course'}
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '题库' : 'Problem bank'}
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
