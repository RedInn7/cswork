import '../library/library.css';
import './projects.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { requestLocale } from '@/lib/server/locale';
import { LibraryPageView } from '../library/page-view';

/** The resume projects' public pages on the public library shell. */
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library projects-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '简历项目' : 'projects'}</span>
        </Link>
        <Link href="/roadmap" prefetch={false}>
          {zh ? '按岗位的路线' : 'Paths by role'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/projects" prefetch={false}>
          {zh ? '全部项目' : 'All projects'}
        </Link>
        <Link href="/take-home" prefetch={false}>
          {zh ? '带回家作业' : 'Take-home'}
        </Link>
        <Link href="/system-design" prefetch={false}>
          {zh ? '系统设计' : 'System design'}
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
