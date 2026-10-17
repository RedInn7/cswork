import '../library/library.css';
import './frontend.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { requestLocale } from '@/lib/server/locale';

/** /frontend and its JS problems: the public library's shell. */
export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library fejs-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / frontend</span>
        </Link>
        <Link href="/frontend" prefetch={false}>
          {zh ? '前端练习首页' : 'Frontend practice'}
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/frontend" prefetch={false}>
          {zh ? 'JS 手写题' : 'JS problems'}
        </Link>
        <Link href="/oa/mcq?topic=js" prefetch={false}>
          {zh ? 'JavaScript 选择题' : 'JavaScript MCQ'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料库' : 'Library'}
        </Link>
        <Link href="/privacy#privacy-practice-tracks" prefetch={false}>
          {zh ? '隐私' : 'Privacy'}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
