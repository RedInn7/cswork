import './lists.css';
import Link from 'next/link';
import { JoinCommunity } from '../community-link';
import { requestLocale } from '@/lib/server/locale';

/** Crawlable classic list mappings: which problems of each list are judgeable here. */
export default async function ListsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/" prefetch={false}>
          cswork<span> / lists</span>
        </Link>
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '打开题库' : 'Open the problem bank'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        {children}
      </main>
      <footer className="lists-public-footer">
        <Link href="/lists" prefetch={false}>
          {zh ? '全部经典题单' : 'All classic lists'}
        </Link>
        <Link href="/mock-oa" prefetch={false}>
          {zh ? '模拟 OA' : 'Mock OA'}
        </Link>
        <Link href="/lists/community" prefetch={false}>
          {zh ? '题单广场' : 'Community lists'}
        </Link>
        <JoinCommunity zh={zh} />
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
