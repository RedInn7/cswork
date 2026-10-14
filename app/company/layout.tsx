import '../library/library.css';
import '../oa/oa.css';
import './company.css';
import '../company-stats.css';
import '../experience-submissions.css';
import Link from 'next/link';
import { PaletteButton } from '@/components/command-palette';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { requestLocale } from '@/lib/server/locale';

/** Company pages share the OA shell: library chrome, Line 500 signals. */
export default async function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library oa-public company-hub" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '公司' : 'companies'}</span>
        </Link>
        <PaletteButton className="public-library-search" />
        <Link href="/?view=experiences" prefetch={false}>
          {zh ? '打开练习工作台' : 'Open practice workspace'}{' '}
          <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/oa" prefetch={false}>
          {zh ? '全部公司 OA' : 'All company OAs'}
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
