import '../library/library.css';
import './oa.css';
import Link from 'next/link';
import { Suspense } from 'react';
import { LibraryPageView } from '../library/page-view';
import { requestLocale } from '@/lib/server/locale';

export default async function OaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library oa-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / OA</span>
        </Link>
        <Link href="/?view=problems&library=oa" prefetch={false}>
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
        <Link href="/oa/sims" prefetch={false}>
          {zh ? '操作系统与网络模拟器' : 'OS and networking simulators'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料库' : 'Library'}
        </Link>
        <Link href="/topics" prefetch={false}>
          {zh ? '代码模板速查' : 'Code templates'}
        </Link>
        <Link href="/interview-platforms" prefetch={false}>
          {zh ? '面试平台规则' : 'Interview platforms'}
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
