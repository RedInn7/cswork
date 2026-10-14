import '../lists/lists.css';
import '../library/library.css';
import '../discuss.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';
import { JoinCommunity } from './parts';

/** Discussion pages (/discuss, /discuss/<id>): crawlable reading on the classic lists' shell. */
export default async function DiscussLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public discuss-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/discuss" prefetch={false}>
          cswork<span> / {zh ? '讨论区' : 'discuss'}</span>
        </Link>
        <Link href="/?view=discuss" prefetch={false}>
          {zh ? '在 CSWork 里发帖' : 'Post on CSWork'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        {children}
      </main>
      <footer className="lists-public-footer">
        <Link href="/library" prefetch={false}>
          {zh ? '资料库' : 'Library'}
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
