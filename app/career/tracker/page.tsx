import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { ApplicationTracker, KeepTrackerAdd } from '@/components/application-tracker';

const copy = {
  en: {
    title: 'Job Application Tracker · CSWork',
    description: 'Track your applications from applied to OA, interviews and offer, with OA deadline reminders for your calendar.',
    kicker: 'APPLICATION TRACKER · PRIVATE',
    h1: 'Every application, from applied to offer.',
    lead: 'One card per application, moved along as it goes. OA deadlines count down here, and the calendar export reminds you a day and two hours before each one.',
    privacyTitle: 'Only you see this',
    privacy:
      'Your applications are saved to your account so they follow you to other devices; nobody else can see them. The CSV and the calendar file are made in this browser.',
    more: 'Privacy notice',
    signIn: 'Sign in to track your applications.',
    signInLink: 'Sign in',
  },
  zh: {
    title: '求职投递追踪 · CSWork',
    description: '记录每一份投递从投出到 OA、面试和 offer 的进度，OA 截止日可以导入日历提醒。',
    kicker: '投递追踪 · 仅自己可见',
    h1: '每一份投递，从投出到 offer。',
    lead: '一份投递一张卡片，进展到哪一步就挪到哪一列。OA 截止日在这里倒计时，导出到日历后会在截止前 1 天和 2 小时提醒你。',
    privacyTitle: '只有你能看到',
    privacy: '投递记录保存在你的账号里，换设备也能看到，其他人都看不到。CSV 和日历文件在你的浏览器里生成。',
    more: '隐私说明',
    signIn: '登录后即可记录投递。',
    signInLink: '登录',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/tracker' }),
    // A private board: not a landing page.
    robots: { index: false, follow: false },
  };
}

/** /career/tracker: the signed-in learner's application board (components/application-tracker.tsx). */
export default async function TrackerPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '投递追踪' : 'Application tracker'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-tracker">{c.more}</a>
        </p>
      </div>
      {viewer ? (
        <ApplicationTracker zh={zh} />
      ) : (
        <div className="resume-off">
          <KeepTrackerAdd />
          <p>{c.signIn}</p>
          <a href="/?view=account">{c.signInLink} →</a>
        </div>
      )}
    </>
  );
}
