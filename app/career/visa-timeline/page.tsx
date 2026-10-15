import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { guidePath } from '@/lib/career-guide';
import { requestLocale } from '@/lib/server/locale';
import { VisaTimeline } from '@/components/visa-timeline';
import { H1B } from '@/lib/server/h1b';

const copy = {
  en: {
    title: 'F-1 OPT, STEM OPT and H-1B Timeline Calculator · CSWork',
    description:
      'Enter your program end and OPT dates to see the OPT filing window, unemployment limit, STEM OPT deadline, H-1B registration and cap-gap dates, and days since each green card step. Planning help only, not legal advice.',
    kicker: 'VISA TIMELINE · PLANNING ONLY',
    h1: 'Your F-1, OPT and H-1B dates on one line.',
    lead: 'Enter the dates you know; the windows and deadlines that follow from them appear below, each with the official USCIS page it comes from.',
    noticeTitle: 'Not legal advice',
    notice:
      'For planning only. This page does not constitute legal advice, and it cannot see your SEVIS record, your school’s rules or this year’s USCIS announcements. Go by the official USCIS pages, and confirm every date with your DSO or an immigration attorney before you act.',
    chapter: 'Visa notes in the career guide',
    h1b: 'Which companies sponsor H-1B: approvals by fiscal year',
  },
  zh: {
    title: 'F-1 OPT、STEM OPT 与 H-1B 时间线计算器 · CSWork',
    description:
      '输入项目结束日和 OPT 日期，算出 OPT 申请窗口、失业天数上限、STEM OPT 截止日、H-1B 注册与 cap-gap 日期，以及绿卡各阶段已过天数。仅供规划参考，不构成法律意见。',
    kicker: '身份时间线 · 仅供规划',
    h1: '把 F-1、OPT 和 H-1B 的日子排在一条线上。',
    lead: '填上你知道的日期，下面会列出由此推出的窗口和截止日，每一条都附上 USCIS 官方说明的链接。',
    noticeTitle: '不是法律意见',
    notice:
      '仅供规划参考，不构成法律意见，以 USCIS 官方信息为准。本页看不到你的 SEVIS 记录、学校的规定和 USCIS 当年的公告；行动前请和学校 DSO 或移民律师逐一确认日期。',
    chapter: '求职指南：国际学生签证须知',
    h1b: '哪些公司办 H-1B：各财年批准数',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/visa-timeline' });
}

export default async function VisaTimelinePage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href={guidePath()}>{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '身份时间线' : 'Visa timeline'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.noticeTitle}</strong>
        <p>
          {c.notice} <a href={guidePath('visa')}>{c.chapter}</a>
        </p>
      </div>
      {H1B.fiscalYears.length > 0 && (
        <p>
          <a href="/career/h1b">{c.h1b} →</a>
        </p>
      )}
      <VisaTimeline zh={zh} />
    </>
  );
}
