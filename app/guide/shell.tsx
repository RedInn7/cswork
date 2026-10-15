import Link from 'next/link';

/** The public shell of the career guide and the resume review: Line 500's navy board look. */
export function GuideShell({ zh, children }: { zh: boolean; children: React.ReactNode }) {
  return (
    <div className="mock-public guide-public" lang={zh ? 'zh-CN' : 'en'}>
      <header className="mock-public-header">
        <Link className="mock-public-brand" href="/" prefetch={false}>
          cswork<span> / {zh ? '求职指南' : 'career guide'}</span>
        </Link>
        <nav className="guide-top-links" aria-label={zh ? '求职指南' : 'Career guide'}>
          <Link href="/guide" prefetch={false}>
            {zh ? '全部章节' : 'All chapters'}
          </Link>
          <Link href="/career/resume" prefetch={false}>
            {zh ? '简历 AI 点评' : 'AI resume review'}
          </Link>
          <Link href="/career/visa-timeline" prefetch={false}>
            {zh ? '身份时间线' : 'Visa timeline'}
          </Link>
        </nav>
      </header>
      <main className="mock-public-main" id="main-content">
        {children}
      </main>
      <footer className="mock-public-footer">
        <Link href="/?view=problems" prefetch={false}>
          {zh ? '算法题库' : 'Problem bank'}
        </Link>
        <Link href="/mock-interview" prefetch={false}>
          {zh ? '模拟面试' : 'Mock interviews'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
