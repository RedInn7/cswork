import '../mock-oa/mock-oa-public.css';
import './ai-assisted.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** The AI-assisted round's public pages: Line 500's navy board, wide enough for the workspace. */
export default async function AiAssistedLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="mock-public ai-round" lang={zh ? 'zh-CN' : 'en'}>
      <header className="mock-public-header">
        <Link className="mock-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? 'AI 辅助编程轮' : 'AI-assisted round'}</span>
        </Link>
        <Link href="/ai-assisted" prefetch={false}>
          {zh ? '全部练习' : 'All projects'}
        </Link>
      </header>
      <main className="mock-public-main" id="main-content">
        {children}
      </main>
      <footer className="mock-public-footer">
        <Link href="/take-home" prefetch={false}>
          {zh ? '带回家作业' : 'Take-home projects'}
        </Link>
        <Link href="/mock-interview" prefetch={false}>
          {zh ? '模拟面试' : 'Mock interviews'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料' : 'Interview library'}
        </Link>
        <Link href="/privacy#privacy-ai-round" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
