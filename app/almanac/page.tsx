import type { Metadata } from 'next';
import Link from 'next/link';
import './almanac.css';
import { InterviewAlmanac } from '@/components/interview-almanac';
import { pageMetadata } from '@/lib/server/seo';
import { requestLocale } from '@/lib/server/locale';

const copy = {
  zh: {
    title: '面试黄历：哪天宜电面、Onsite、谈 Offer · CSWork',
    description:
      '把老黄历的宜忌读成面试用语：每天给电面、Onsite 和谈 Offer 各打一个分，列出未来 30 天最宜面试的工作日和当天的好时段，按美国时区和假日排。民俗参考，图个好彩头。',
    h1: '面试黄历',
  },
  en: {
    title:
      'Interview Almanac: Lucky Days for Phone Screens, Onsites and Offers · CSWork',
    description:
      'The Chinese almanac read for interviews: every day gets a grade for phone screens, onsites and offer talks, with the best working days in the next 30 and the lucky hours, on US time zones and holidays. Folk custom, for fun.',
    h1: 'Interview almanac',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return await pageMetadata({
    title: c.title,
    description: c.description,
    path: '/almanac',
  });
}

/** The almanac alone, edge to edge: its own masthead with the way back, no site header or footer. */
export default async function AlmanacPage() {
  const zh = (await requestLocale()) === 'zh';
  return (
    <main className="almanac-page" id="main-content" lang={zh ? 'zh-CN' : 'en'}>
      <header className="almanac-mast">
        <Link className="almanac-back" href="/" prefetch={false}>
          <span aria-hidden="true">←</span>{' '}
          {zh ? '回到 CSWork' : 'Back to CSWork'}
        </Link>
        <h1>{copy[zh ? 'zh' : 'en'].h1}</h1>
      </header>
      <InterviewAlmanac zh={zh} />
    </main>
  );
}
