import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { scenarioSetting } from '@/lib/server/roleplay-scenarios';
import { SCRIPTS } from '@/lib/content/negotiation-scripts';
import { NegotiationScripts } from '@/components/negotiation-scripts';

const copy = {
  en: {
    title: 'Negotiation Practice Scripts · CSWork',
    description:
      'Branching practice scripts, no AI needed: the salary question on a first recruiter call, a 48-hour exploding offer, using a competing offer, base traded for a sign-on, and a return offer next to an outside one. Every step scored and explained at the end.',
    kicker: 'NEGOTIATION PRACTICE',
    h1: 'One wrong line can cost you thousands. Practice it here first.',
    lead: 'Five branching scripts in which the recruiter reacts to what you say. Scores stay hidden until the end, when every step is scored and explained. No sign-in needed, and nothing is saved.',
  },
  zh: {
    title: '谈薪对练：招聘方初筛和 Offer 谈判剧本 · CSWork',
    description:
      '不用 AI 的分支对话剧本：初筛电话里被问期望薪资、48 小时限时 offer、用竞争 offer 谈条件、base 换签字费、转正 offer 加外部 offer。结束时逐步打分并解释。',
    kicker: '谈薪对练',
    h1: '谈薪时说错一句，可能就差几千美元。先在这里练一遍。',
    lead: '五个分支剧本，招聘方会随你的回答走向不同的结果。过程中不显示分数，结束时逐步打分并解释原因。不用登录，也不保存任何内容。',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/negotiation' });
}

/** /career/negotiation: branching recruiter and offer scripts (components/negotiation-scripts.tsx). */
export default async function NegotiationPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  // Resolved here so the scenarios' floors and notes stay on the server.
  const settings = Object.fromEntries(SCRIPTS.map((s) => [s.scenario, scenarioSetting(s.scenario)!]));
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '谈薪对练' : 'Negotiation practice'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <NegotiationScripts zh={zh} settings={settings} />
    </>
  );
}
