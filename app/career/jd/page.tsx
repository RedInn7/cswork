import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { aiEnabled, AI_DAILY_LIMITS } from '@/lib/server/ai-tutor';
import { requestLocale } from '@/lib/server/locale';
import { JdReadiness } from '@/components/jd-readiness';

const copy = {
  en: {
    title: 'Job Description Readiness Check for Software Engineering Roles · CSWork',
    description:
      'Paste a job description and see which skills it asks for, how far your CSWork practice covers each one, the interview rounds to expect, and a study plan built around the gaps. Nothing is stored.',
    kicker: `JD READINESS CHECK · ${AI_DAILY_LIMITS.jd} A DAY`,
    h1: 'Paste a job description. See where you stand.',
    lead: 'The posting’s skills, each set against your own practice here: Line 500, the SQL track, chapters you have read, certificates and your STAR stories. Gaps on Line 500 go straight into your sprint plan.',
    privacyTitle: 'Before you paste',
    privacy:
      'The job description you paste is sent to Anthropic to pick out the skills it asks for. CSWork does not store the text or the checklist; only the daily number of checks is counted. Your progress is read from your own account and is not sent.',
    more: 'Privacy notice',
    off: 'The JD readiness check is not available on this site right now. The career guide lists what each interview round tests.',
    chapter: 'Open the career guide',
  },
  zh: {
    title: 'JD 准备度检查：软件工程岗位 · CSWork',
    description: '粘贴职位描述，看它要求哪些技能、你在 CSWork 上的练习各覆盖了多少、可能有哪些面试环节，并按缺口生成学习计划。不保存任何内容。',
    kicker: `JD 准备度检查 · 每天 ${AI_DAILY_LIMITS.jd} 次`,
    h1: '把职位描述贴进来，看看自己准备到哪了。',
    lead: '逐项列出职位要求的技能，并对照你在本站的练习：500 路、SQL 题、读过的章节、证书和 STAR 故事。500 路上的缺口可以直接排进冲刺计划。',
    privacyTitle: '粘贴之前',
    privacy:
      '你粘贴的职位描述会发送给 Anthropic，用于找出其中要求的技能。CSWork 不保存职位描述和清单结果，只统计每天的分析次数。你的练习进度从你自己的账户读取，不会发送出去。',
    more: '隐私说明',
    off: '本站暂未开放 JD 准备度检查。求职指南里有各轮面试考什么的说明。',
    chapter: '打开求职指南',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/jd' });
}

export default async function JdReadinessPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? 'JD 准备度检查' : 'JD readiness check'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <div className="resume-privacy" id="resume-privacy">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-jd">{c.more}</a>
        </p>
      </div>
      {aiEnabled() ? (
        <JdReadiness zh={zh} />
      ) : (
        <div className="resume-off">
          <p>{c.off}</p>
          <a href="/guide">{c.chapter} →</a>
        </div>
      )}
    </>
  );
}
