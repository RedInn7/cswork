import '../mock-oa/mock-oa-public.css';
import '../ai-assisted/ai-assisted.css';
import '../oa/ica/ica.css';
import Link from 'next/link';
import { requestLocale } from '@/lib/server/locale';

/** The take-home assignments' public pages: the AI-assisted round's board and workspace, without its AI pair. */
export default async function TakeHomeLayout({ children }: { children: React.ReactNode }) {
  const zh = (await requestLocale()) === 'zh';
  return (
    <div className="mock-public ai-round" lang={zh ? 'zh-CN' : 'en'}>
      <header className="mock-public-header">
        <Link className="mock-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '带回家作业' : 'Take-home'}</span>
        </Link>
        <Link href="/take-home" prefetch={false}>
          {zh ? '全部作业' : 'All assignments'}
        </Link>
      </header>
      <main className="mock-public-main" id="main-content">
        {children}
      </main>
      <footer className="mock-public-footer">
        <Link href="/ai-assisted" prefetch={false}>
          {zh ? 'AI 辅助编程轮' : 'AI-assisted round'}
        </Link>
        <Link href="/oa/ica" prefetch={false}>
          {zh ? 'ICA 式练习' : 'ICA-style practice'}
        </Link>
        <Link href="/privacy#privacy-ai-round" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
