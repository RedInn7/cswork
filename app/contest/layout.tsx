import '../lists/lists.css';
import '../lc-rating.css';
import './contest.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';
import { JoinCommunity } from '../discuss/community-link';

/** Contest pages (/contest, /contest/<id>, /contest/leaderboard): the departure board on the classic lists' shell. */
export default async function ContestLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="lists-public contest-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="lists-public-header">
        <Link className="lists-public-brand" href="/contest" prefetch={false}>
          cswork<span> / {zh ? '竞赛' : 'contests'}</span>
        </Link>
        <nav className="contest-nav" aria-label={zh ? '竞赛' : 'Contests'}>
          <Link href="/contest/leaderboard" prefetch={false}>
            {zh ? 'Rating 排行榜' : 'Rating board'}
          </Link>
          <Link href="/leaderboard" prefetch={false}>
            {zh ? '练习排行榜' : 'Practice board'}
          </Link>
          <Link href="/?view=problems" prefetch={false}>
            {zh ? '回到题库' : 'Problem bank'} <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>
      <main className="lists-public-main" id="main-content">
        {children}
      </main>
      <footer className="lists-public-footer">
        <Link href="/mock-oa" prefetch={false}>
          {zh ? '模拟 OA' : 'Mock OA'}
        </Link>
        <Link href="/daily" prefetch={false}>
          {zh ? '每日一题' : 'Daily problem'}
        </Link>
        <Link href="/discuss" prefetch={false}>
          {zh ? '讨论区' : 'Discuss'}
        </Link>
        <JoinCommunity zh={zh} />
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
