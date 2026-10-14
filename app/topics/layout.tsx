import '../library/library.css';
import './topics.css';
import '../lc-rating.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { requestLocale } from '@/lib/server/locale';

export default async function TopicsLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library topics-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '模板' : 'templates'}</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '打开 500 路题单' : 'Open the Line 500 list'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/topics" prefetch={false}>
          {zh ? '全部模板' : 'All templates'}
        </Link>
        <Link href="/oa" prefetch={false}>
          {zh ? '公司 OA' : 'Company OAs'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料库' : 'Library'}
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
