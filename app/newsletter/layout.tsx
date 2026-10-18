import '../lists/lists.css';
import './newsletter.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** The weekly newsletter's public pages (/newsletter, /newsletter/<week>) on the classic lists' shell. */
export default async function NewsletterLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public newsletter-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/newsletter" prefetch={false}>
          cswork<span> / {zh ? '周报' : 'weekly'}</span>
        </Link>
        <Link href="/" prefetch={false}>
          {zh ? '去 CSWork 练题' : 'Practice on CSWork'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        {children}
      </main>
      <footer className="lists-public-footer">
        <Link href="/daily" prefetch={false}>
          {zh ? '每日一题' : 'Daily problem'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '资料库' : 'Library'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
