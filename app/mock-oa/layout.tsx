import './mock-oa-public.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** Crawlable mock OA pages: each company's real format, with the way into the timed mock. */
export default async function MockOaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="mock-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="mock-public-header">
        <Link className="mock-public-brand" href="/" prefetch={false}>
          cswork<span> / mock oa</span>
        </Link>
        <Link href="/?view=mock" prefetch={false}>
          {zh ? '打开模拟 OA' : 'Open Mock OA'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="mock-public-main" id="main-content">
        {children}
      </main>
      <footer className="mock-public-footer">
        <Link href="/mock-oa" prefetch={false}>
          {zh ? '全部公司' : 'All companies'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料' : 'Interview library'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
