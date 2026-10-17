import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { Contacts } from '@/components/contacts';

const copy = {
  en: {
    title: 'Job Search Contacts · CSWork',
    description: 'Keep track of the people in your job search: who they are, how you met, when you last talked and when to follow up.',
    kicker: 'CONTACTS · PRIVATE',
    h1: 'The people behind your applications.',
    lead: 'Referrers, recruiters, alumni and interviewers: note how you met, link them to an application, and set a follow-up date. Contacts due for a follow-up come first, and your daily reminder can count them.',
    privacyTitle: 'Details about other people, kept for you alone',
    privacy:
      'These are notes you record about other people. They are saved only in your account and nobody else can see them. Keep to what your job search needs, and delete a contact when you no longer need it.',
    more: 'Privacy notice',
    signIn: 'Sign in to keep your contacts.',
    signInLink: 'Sign in',
  },
  zh: {
    title: '求职联系人 · CSWork',
    description: '记录求职路上的联系人：对方是谁、怎么认识的、上次什么时候联系、什么时候该跟进。',
    kicker: '联系人 · 仅自己可见',
    h1: '每一份投递背后的人。',
    lead: '内推人、招聘方、校友和面试官：记下怎么认识的，关联到对应的投递，设一个跟进日期。到期的联系人排在最前面，每日提醒也会算上他们。',
    privacyTitle: '关于他人的信息，只给你自己看',
    privacy: '这些是你记录的他人信息，只保存在你自己的账号里，其他人都看不到。只记求职需要的内容，不再需要时请删掉。',
    more: '隐私说明',
    signIn: '登录后即可记录联系人。',
    signInLink: '登录',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/career/contacts' }),
    // A private list: not a landing page.
    robots: { index: false, follow: false },
  };
}

/** /career/contacts: the signed-in learner's job-search contacts (components/contacts.tsx). */
export default async function ContactsPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <a href="/career/tracker">{zh ? '投递追踪' : 'Application tracker'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '联系人' : 'Contacts'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-contacts">{c.more}</a>
        </p>
      </div>
      {viewer ? (
        <Contacts zh={zh} />
      ) : (
        <div className="resume-off">
          <p>{c.signIn}</p>
          <a href="/?view=account">{c.signInLink} →</a>
        </div>
      )}
    </>
  );
}
