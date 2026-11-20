import type { Metadata } from 'next';
import Link from 'next/link';
import './almanac.css';
import { InterviewAlmanac } from '@/components/interview-almanac';
import { guidePath } from '@/lib/career-guide';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';

const copy = {
  zh: {
    title: '面试黄历：哪天宜电面、Onsite、谈 Offer · CSWork',
    description:
      '把老黄历的宜忌读成面试用语：每天给电面、Onsite 和谈 Offer 各打一个分，列出未来 30 天最宜面试的工作日和当天的好时段，按美国时区和假日排。民俗参考，图个好彩头。',
    kicker: '面试黄历 · 民俗参考',
    h1: '挑个好日子去面试。',
    lead: '老黄历每天有宜有忌。这里把「赴任」读成 Onsite，「会亲友」读成电面，「订盟」读成接 Offer，再按美国的工作日和假日排好。',
    crumb: '面试黄历',
    noticeTitle: '图个好彩头',
    notice: '黄历是民俗，不预测面试结果。约到哪天就面哪天，准备比日子重要。',
    practice: '去题库刷题',
  },
  en: {
    title:
      'Interview Almanac: Lucky Days for Phone Screens, Onsites and Offers · CSWork',
    description:
      'The Chinese almanac read for interviews: every day gets a grade for phone screens, onsites and offer talks, with the best working days in the next 30 and the lucky hours, on US time zones and holidays. Folk custom, for fun.',
    kicker: 'INTERVIEW ALMANAC · FOLK CUSTOM',
    h1: 'Pick a lucky day to interview.',
    lead: 'The Chinese almanac (黄历) lists what each day is good and bad for. Here “taking up a post” reads as an onsite, “meeting friends” as a phone screen and “making a pact” as accepting an offer, laid out on US working days and holidays.',
    crumb: 'Interview almanac',
    noticeTitle: 'For luck only',
    notice:
      'The almanac is folk custom and predicts nothing about an interview. Take the slot you are offered; preparation matters more than the date.',
    practice: 'Practice problems',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({
    title: c.title,
    description: c.description,
    path: '/career/almanac',
  });
}

export default async function AlmanacPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  return (
    <>
      <nav
        className="mock-public-crumbs"
        aria-label={zh ? '导航路径' : 'Breadcrumb'}
      >
        <a href={guidePath()}>{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{c.crumb}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <InterviewAlmanac zh={zh} />
      <div className="resume-privacy" role="note">
        <strong>{c.noticeTitle}</strong>
        <p>
          {c.notice}{' '}
          <Link href="/?view=problems" prefetch={false}>
            {c.practice} →
          </Link>
        </p>
      </div>
    </>
  );
}
