import '../lists/lists.css';
import './u.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** Learner pages (/u/<handle>, /u/lists/<id>): the classic lists' Line 500 shell. */
export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public learner-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '学习者' : 'learners'}</span>
        </Link>
        <Link href="/?view=problems&utm_source=profile" prefetch={false}>
          {zh ? '在 CSWork 刷题' : 'Practice on CSWork'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="lists-public-main" id="main-content">
        {children}
      </main>
      <footer className="lists-public-footer">
        <Link href="/lists" prefetch={false}>
          {zh ? '经典题单' : 'Classic lists'}
        </Link>
        <Link href="/mock-oa" prefetch={false}>
          {zh ? '模拟 OA' : 'Mock OA'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
