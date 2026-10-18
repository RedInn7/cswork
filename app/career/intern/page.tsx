import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { InternLog } from '@/components/intern-log';

const copy = {
  en: {
    title: 'Internship Log · CSWork',
    description: 'A week-by-week internship checklist, a weekly log of your work that becomes midpoint and final self-review drafts and XYZ resume bullets, and score cards for team-matching calls.',
    kicker: 'INTERNSHIP LOG · PRIVATE',
    h1: 'These weeks decide the return offer. Keep the evidence.',
    lead: 'Log what you got done each week in XYZ form. The log turns into midpoint and final self-review drafts, resume bullets and STAR stories, and this week’s checklist items show up here.',
    privacyTitle: 'Only you see this',
    privacy:
      'The internship setup, your weekly logs and your team-matching notes are private notes in your account; nobody else can see them. Exports are made in this browser, and adding bullets to the resume only changes the resume builder’s copy in this browser.',
    more: 'Privacy notice',
    signIn: 'Sign in to keep an internship log.',
    signInLink: 'Sign in',
    chapter: 'Read the internship chapter',
  },
  zh: {
    title: '实习日志 · CSWork',
    description: '按周给出实习清单；每周记录成果，可导出中期、期末自评草稿和 XYZ 简历要点；选组电话的记录卡和加权打分。',
    kicker: '实习日志 · 仅自己可见',
    h1: '实习这几周决定能不能转正，把做成的事记下来。',
    lead: '每周按 XYZ 记下做成的事。日志可以变成中期、期末自评草稿、简历要点和 STAR 故事；本周清单上该做的事也会列在这里。',
    privacyTitle: '只有你能看到',
    privacy: '实习设置、每周日志和选组电话笔记是你账号里的私人笔记，其他人都看不到。导出在你的浏览器里生成；写入简历只改这个浏览器里简历生成器的那份。',
    more: '隐私说明',
    signIn: '登录后即可记录实习日志。',
    signInLink: '登录',
    chapter: '先读实习手册',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/intern' }),
    // A private log: not a landing page.
    robots: { index: false, follow: false },
  };
}

/** /career/intern: the signed-in learner's internship log and team-matching cards (components/intern-log.tsx). */
export default async function InternPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '实习日志' : 'Internship log'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-intern">{c.more}</a>
        </p>
      </div>
      <p className="guide-top-links">
        <a href="/guide/internship">{zh ? '实习手册' : 'Internship chapter'}</a>
        <a href="/?view=stories">{zh ? 'STAR 故事库' : 'STAR story bank'}</a>
        <a href="/career/resume/builder">{zh ? '简历生成器' : 'Resume builder'}</a>
      </p>
      {viewer ? (
        <InternLog zh={zh} />
      ) : (
        <div className="resume-off">
          <p>{c.signIn}</p>
          <a href="/?view=account">{c.signInLink} →</a>{' '}
          <a href="/guide/internship">{c.chapter} →</a>
        </div>
      )}
    </>
  );
}
