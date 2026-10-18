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
    lead: 'The posting’s skills, each set against your own practice here: Line 500, the SQL track, chapters you have read and certificates. Gaps on Line 500 go straight into your sprint plan.',
    privacyTitle: 'Before you paste',
    privacy:
      'The job description you paste is sent to Anthropic to pick out the skills it asks for. CSWork does not store the text or the checklist; only the daily number of checks is counted. Your progress is read from your own account and is not sent.',
    more: 'Privacy notice',
    // Keyword mode (AI off): lib/jd-keywords.ts in the browser.
    offKicker: 'JD KEYWORD CHECK · RUNS IN YOUR BROWSER',
    offLead:
      'The posting is matched against about 250 technical keywords: the skills it asks for, required or nice to have, each set against your own practice here, the interview rounds to expect, and how well your resume covers its keywords.',
    offPrivacy:
      'The job description is read in this browser and never uploaded. Signed in, only the names of the skills found (such as python or sql) are sent to read your progress; nothing is stored. Your resume is compared in this browser too.',
  },
  zh: {
    title: 'JD 准备度检查：软件工程岗位 · CSWork',
    description: '粘贴职位描述，看它要求哪些技能、你在 CSWork 上的练习各覆盖了多少、可能有哪些面试环节，并按缺口生成学习计划。不保存任何内容。',
    kicker: `JD 准备度检查 · 每天 ${AI_DAILY_LIMITS.jd} 次`,
    h1: '把职位描述贴进来，看看自己准备到哪了。',
    lead: '逐项列出职位要求的技能，并对照你在本站的练习：500 路、SQL 题、读过的章节和证书。500 路上的缺口可以直接排进冲刺计划。',
    privacyTitle: '粘贴之前',
    privacy:
      '你粘贴的职位描述会发送给 Anthropic，用于找出其中要求的技能。CSWork 不保存职位描述和清单结果，只统计每天的分析次数。你的练习进度从你自己的账户读取，不会发送出去。',
    more: '隐私说明',
    offKicker: 'JD 关键词检查 · 在你的浏览器里完成',
    offLead: '用约 250 个技术关键词对照职位描述：列出它要求的技能（必须还是加分），逐项对照你在本站的练习，推断可能的面试环节，并看你的简历覆盖了多少关键词。',
    offPrivacy:
      '职位描述只在这个浏览器里做关键词匹配，不会上传。登录后，只有匹配到的技能名称（例如 python、sql）会发送给 CSWork，用来读取你的练习进度，不会保存。简历比对同样只在浏览器里进行。',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/career/jd' });
}

export default async function JdReadinessPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'],
    ai = aiEnabled();
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? 'JD 检查' : 'JD check'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{ai ? c.kicker : c.offKicker}</p>
        <h1>{c.h1}</h1>
        <p>{ai ? c.lead : c.offLead}</p>
      </section>
      <div className="resume-privacy" id="resume-privacy">
        <strong>{c.privacyTitle}</strong>
        <p>
          {ai ? c.privacy : c.offPrivacy} <a href="/privacy#privacy-jd">{c.more}</a>
        </p>
      </div>
      <JdReadiness zh={zh} ai={ai} />
    </>
  );
}
