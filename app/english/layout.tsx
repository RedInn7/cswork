import '../library/library.css';
import './english.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** Interview English (/english, /english/<unit>) on the public library shell. */
export default async function EnglishLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="public-library eng-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '面试英语' : 'interview English'}</span>
        </Link>
        <Link href="/mock-interview" prefetch={false}>
          {zh ? '来一场模拟面试' : 'Run a mock interview'} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        {children}
      </main>
      <footer className="public-library-footer">
        <Link href="/english" prefetch={false}>
          {zh ? '全部单元' : 'All units'}
        </Link>
        <Link href="/system-design" prefetch={false}>
          {zh ? '系统设计课' : 'System design course'}
        </Link>
        <Link href="/mock-interview" prefetch={false}>
          {zh ? '模拟面试' : 'Mock interview'}
        </Link>
        <Link href="/privacy#privacy-practice-tracks" prefetch={false}>
          {zh ? '隐私' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
