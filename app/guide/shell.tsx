import Link from 'next/link';
import { H1B } from '@/lib/server/h1b';

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
          {/* Production runs without AI: the rule check works either way (and offers the AI review when it is on). */}
          <Link href="/career/resume/builder#resume-check" prefetch={false}>
            {zh ? '简历检查' : 'Resume check'}
          </Link>
          <Link href="/career/resume/builder" prefetch={false}>
            {zh ? '简历生成器' : 'Resume builder'}
          </Link>
          <Link href="/career/jd" prefetch={false}>
            {zh ? 'JD 检查' : 'JD check'}
          </Link>
          <Link href="/career/visa-timeline" prefetch={false}>
            {zh ? '身份时间线' : 'Visa timeline'}
          </Link>
          {/* Hidden until scripts/h1b/build.mjs has filled the data, like the sitemap entry. */}
          {H1B.fiscalYears.length > 0 && (
            <Link href="/career/h1b" prefetch={false}>
              {zh ? 'H-1B 担保' : 'H-1B sponsors'}
            </Link>
          )}
          <Link href="/career/jobs" prefetch={false}>
            {zh ? '在招岗位' : 'Open roles'}
          </Link>
          <Link href="/career/jobs/calendar" prefetch={false}>
            {zh ? '招聘日历' : 'Hiring calendar'}
          </Link>
          <Link href="/career/offers" prefetch={false}>
            {zh ? 'Offer 对比' : 'Offer comparison'}
          </Link>
          <Link href="/career/tracker" prefetch={false}>
            {zh ? '投递追踪' : 'Application tracker'}
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
        {/* The footer, not the top bar (wave 8 critique 5): the resume project library and interview English. */}
        <Link href="/projects" prefetch={false}>
          {zh ? '简历项目' : 'Resume projects'}
        </Link>
        <Link href="/english" prefetch={false}>
          {zh ? '面试英语' : 'Interview English'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私说明' : 'Privacy'}
        </Link>
      </footer>
    </div>
  );
}
