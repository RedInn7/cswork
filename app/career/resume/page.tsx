import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { aiEnabled, AI_DAILY_LIMITS } from '@/lib/server/ai-tutor';
import { requestLocale } from '@/lib/server/locale';
import { ResumeReview } from '@/components/resume-review';

const copy = {
  en: {
    title: 'AI Resume Review for Software Engineering Roles · CSWork',
    description:
      'Paste your resume text and get feedback on measurable impact, action verbs, missing keywords for your target role and line-by-line rewrites. Nothing is stored.',
    kicker: `AI RESUME REVIEW · ${AI_DAILY_LIMITS.resume} A DAY`,
    offKicker: 'AI RESUME REVIEW · NOT AVAILABLE',
    // AI off (production has no key): the page only points at the builder's rule check, so it promises nothing more.
    offTitle: 'Resume Rule Check for Software Engineering Roles · CSWork',
    offDescription:
      'The AI resume review is not available. The resume builder’s rule check scores verbs, numbers, bullet length, dates and required sections in your browser.',
    crumb: 'AI resume review',
    offCrumb: 'Resume check',
    h1: 'Paste your resume. See what it still lacks.',
    offH1: 'The AI resume review is not available right now.',
    lead: 'Feedback on four things recruiters notice first: results with numbers, strong verbs, the keywords your target role asks for, and the weakest bullets rewritten in the XYZ form. It is a second opinion, not a verdict.',
    offLead: 'The resume builder has a rule check that scores your resume without AI.',
    privacyTitle: 'Before you paste',
    privacy:
      'Your resume text, target role and job description are sent to Anthropic to write the review. CSWork does not store the text or the review; only the daily number of reviews is counted. Anything in the resume itself, such as your name or phone number, goes with it, so remove it first if you prefer.',
    more: 'Privacy notice',
    off: 'It looks at action verbs, numbers, bullet length, vague wording, dates and the sections every resume needs, and points at the field to fix. It runs in your browser; nothing is uploaded.',
    chapter: 'Open the rule check',
  },
  zh: {
    title: '简历 AI 点评：软件工程岗位 · CSWork',
    description: '粘贴简历文字，获得成果量化、动词、目标岗位关键词差距和逐条改写建议。不保存任何内容。',
    kicker: `简历 AI 点评 · 每天 ${AI_DAILY_LIMITS.resume} 次`,
    offKicker: '简历 AI 点评 · 暂未开放',
    offTitle: '简历规则检查：软件工程岗位 · CSWork',
    offDescription: '本站暂未开放简历 AI 点评。简历生成器里的规则检查不用 AI，在浏览器里检查动词、数字、要点长度、日期和必备小节。',
    crumb: '简历 AI 点评',
    offCrumb: '简历检查',
    h1: '把简历贴进来，看看它还缺什么。',
    offH1: '简历 AI 点评暂未开放',
    lead: '点评招聘方最先注意的四件事：有没有带数字的成果、动词是否有力、目标岗位要的关键词有没有覆盖，以及把最弱的几条按 XYZ 公式改写。它是第二意见，不是结论。',
    offLead: '简历生成器里的规则检查不用 AI 也能给简历打分。',
    privacyTitle: '粘贴之前',
    privacy:
      '你的简历文字、目标岗位和职位描述会发送给 Anthropic 用于生成点评。CSWork 不保存简历文字和点评结果，只统计每天的点评次数。简历里本身写着的姓名、电话等信息会一起发送，介意的话可以先删掉。',
    more: '隐私说明',
    off: '它看动词、数字、要点长度、空泛用词、日期和必备小节，并指出该改哪一个输入框。检查在你的浏览器里完成，不会上传。',
    chapter: '打开规则检查',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()],
    ai = aiEnabled();
  return seoMetadata({ title: ai ? c.title : c.offTitle, description: ai ? c.description : c.offDescription, path: '/career/resume' });
}

export default async function ResumeReviewPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'],
    ai = aiEnabled();
  return (
    <>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/guide">{zh ? '求职指南' : 'Career guide'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{ai ? c.crumb : c.offCrumb}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{ai ? c.kicker : c.offKicker}</p>
        <h1>{ai ? c.h1 : c.offH1}</h1>
        <p>{ai ? c.lead : c.offLead}</p>
      </section>
      {ai ? (
        <>
          <div className="resume-privacy" id="resume-privacy">
            <strong>{c.privacyTitle}</strong>
            <p>
              {c.privacy} <a href="/privacy#privacy-resume">{c.more}</a>
            </p>
          </div>
          <ResumeReview zh={zh} />
        </>
      ) : (
        <div className="resume-off">
          <p>{c.off}</p>
          <a href="/career/resume/builder#resume-check">{c.chapter} →</a>
        </div>
      )}
    </>
  );
}
