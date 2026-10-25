import '../library/library.css';
import './system-design.css';
// The chapter discussion's community posts (components/solution-posts.tsx) take the site's tokens.
import '../community-posts.css';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { DailyGoal } from '@/components/daily-goal';
import { requestLocale } from '@/lib/server/locale';

// ponytail: taken down 2026-10, code kept; delete this line to reopen (and the sitemap/nav entries).
const RETIRED = true;

export default async function SystemDesignLayout({ children }: { children: React.ReactNode }) {
  if (RETIRED) notFound();
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library sd-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '系统设计' : 'system design'}</span>
        </Link>
        <DailyGoal />
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/system-design" prefetch={false}>
          {zh ? '课程目录' : 'All chapters'}
        </Link>
        <Link href="/categories/system-design" prefetch={false}>
          {zh ? '系统设计面试题' : 'System design questions'}
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
