import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { OutreachTemplates } from '@/components/outreach-templates';

const copy = {
  en: {
    title: 'Job Search Email Templates · CSWork',
    description:
      'Fill-in templates in English and Chinese for referral requests, recruiter follow-ups, thank-you notes, offer extensions, negotiation, accepting and declining.',
    kicker: 'MESSAGE TEMPLATES',
    h1: 'The job-search emails, ready to fill in.',
    lead: 'Ten short templates in English and Chinese, from asking for a referral to declining an offer. Fill them in from an application or a contact, then copy the text or open it in your own mail app: nothing is sent from this site.',
  },
  zh: {
    title: '求职邮件模板 · CSWork',
    description: '中英双语的求职邮件模板：请人内推、跟进招聘方、面试感谢信、延长 offer 截止日期、谈薪、接受和婉拒 offer。',
    kicker: '消息模板',
    h1: '求职路上要写的邮件，填空就好。',
    lead: '十个中英双语短模板，从请人内推到婉拒 offer。可以用投递卡或联系人填写，再复制文字或在你自己的邮件应用中打开：本站不会替你发送任何邮件。',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/templates' });
}

/** /career/templates: fill-in outreach and negotiation messages (components/outreach-templates.tsx). */
export default async function TemplatesPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '消息模板' : 'Message templates'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <OutreachTemplates zh={zh} signedIn={!!viewer} />
    </>
  );
}
