import type { Metadata } from 'next';
import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import { AI_DAILY_LIMITS } from '@/lib/server/ai-tutor';
import { aiRoundCompanies } from '@/lib/server/ai-rounds';
import { aiTasks } from '@/lib/server/ai-tasks';
import { requestLocale } from '@/lib/server/locale';

const copy = {
  en: {
    title: 'AI-Assisted Coding Round: How It Works and Practice Projects · CSWork',
    description:
      'What an AI-assisted coding interview round usually asks, what interviewers look for, which companies interview reports mention it, and multi-file Python projects to practise on with an AI pair.',
    kicker: 'AI-ASSISTED CODING ROUND',
    h1: 'Coding with an AI in the room',
    lead: 'Some interview loops now hand you a small codebase and let you use an AI assistant. The code still has to be right: the round is about reading code, steering the tool and proving the result.',
    howTitle: 'How such a round usually runs',
    how: [
      'You get a repository of a few files with a short brief: a bug to fix, a feature to add, something slow to speed up, or legacy code to cover with tests.',
      'An AI assistant is allowed, often inside the editor. You decide what to ask it and what to keep.',
      'You run the tests yourself, add the ones that are missing and explain your changes as you go.',
      'Formats differ by company and team: the time, the tools allowed and whether hidden tests run afterwards. Ask your recruiter.',
    ],
    lookTitle: 'What interviewers tend to look for',
    look: [
      ['Understanding the brief', 'Reading the existing code and the requirement before generating anything, and asking about what is unclear.'],
      ['Checking AI output', 'Treating suggestions as a draft: reading them, spotting wrong assumptions and rejecting what does not fit.'],
      ['Tests', 'Writing tests that pin the behaviour, including the edge cases the brief only implies, and running them often.'],
      ['Trade-offs out loud', 'Saying why you chose an approach, what it costs and what you would do with more time.'],
    ],
    tasksTitle: 'Practice projects',
    tasksLead: `Small Python projects with public tests and a hidden suite that shows only how many pass. The AI pair beside the editor may write code; it gets ${AI_DAILY_LIMITS.pair} questions a day.`,
    minutes: (n: number) => `~${n} min`,
    companiesTitle: 'Companies whose interview reports mention it',
    companiesLead:
      'Matched by keywords such as "AI-assisted", "Copilot" or "可以用 AI" in the interview reports of the library. A match is a report mentioning it, not a confirmed format: read the report.',
    reports: (n: number) => `${n} report${n === 1 ? '' : 's'}`,
    none: 'No report in the library mentions an AI-assisted round yet.',
    tipsTitle: 'How to practise',
    tips: [
      'Read the README and the tests before you open the AI pair. Write down what "done" means.',
      'Ask for small, specific changes ("why does this test fail", "write a test for a duplicate order id"), not the whole solution.',
      'Run the tests after every change you accept, and add a test before trusting a fix.',
      'When the AI is wrong, say why: that is the part interviewers listen for.',
      'Then do one project without the AI, against the clock.',
    ],
  },
  zh: {
    title: 'AI 辅助编程轮：形式、考察点与多文件实战练习 · CSWork',
    description: 'AI 辅助编程面试一般怎么进行、面试官看什么、站内面经里哪些公司提到过，以及可以和 AI 结对练习的多文件 Python 项目。',
    kicker: 'AI 辅助编程轮',
    h1: '允许用 AI 的编程面试',
    lead: '一些面试流程会给你一个小代码库，并允许使用 AI 助手。代码仍然必须正确：这一轮考的是读代码、驾驭工具和证明结果。',
    howTitle: '这种轮次一般怎么进行',
    how: [
      '拿到一个只有几个文件的代码库和一段简短说明：修一个 bug、加一个功能、把慢的地方提速，或者给遗留代码补测试。',
      '允许使用 AI 助手，通常就在编辑器里。问它什么、采纳什么，由你决定。',
      '你自己运行测试、补上缺的测试，并边做边解释改动。',
      '不同公司和团队的形式不一样：时长、允许的工具、结束后是否跑隐藏测试都可能不同，以招聘方的说明为准。',
    ],
    lookTitle: '面试官通常看什么',
    look: [
      ['理解需求', '先读懂现有代码和需求再让 AI 生成，不清楚的地方主动问。'],
      ['验证 AI 产出', '把建议当草稿：逐行读，找出错误假设，不合适的就不用。'],
      ['写测试', '用测试把行为钉住，包括说明里只是暗示的边界情况，并且经常运行。'],
      ['讲清取舍', '说明为什么选这个方案、代价是什么、时间更多时会怎么做。'],
    ],
    tasksTitle: '练习项目',
    tasksLead: `小型 Python 项目，带公开测试和只显示通过数量的隐藏测试。编辑器旁的 AI 结对可以写代码，每天 ${AI_DAILY_LIMITS.pair} 次。`,
    minutes: (n: number) => `约 ${n} 分钟`,
    companiesTitle: '面经里提到过的公司',
    companiesLead: '按面经正文里的关键词匹配，例如 “AI-assisted”“Copilot”“可以用 AI”。命中只代表有面经提到，不代表该公司一定采用这种形式，请点开原文核实。',
    reports: (n: number) => `${n} 篇面经`,
    none: '面经库里暂时没有提到 AI 辅助编程轮的面经。',
    tipsTitle: '练习建议',
    tips: [
      '打开 AI 结对之前，先读 README 和测试，写下「做完」的标准。',
      '让 AI 做小而具体的事（「这个测试为什么失败」「给重复订单号写个测试」），而不是直接要整份答案。',
      '每采纳一处改动就跑一次测试；相信一个修复之前先补一个测试。',
      'AI 说错时讲出错在哪里，面试官最想听的就是这部分。',
      '最后不用 AI、限时再做一遍。',
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/ai-assisted' });
}

/** /ai-assisted: the round explained in general terms, the practice projects, and the reports that mention it. */
export default async function AiAssistedPage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'],
    i = zh ? 0 : 1;
  // Take-homes have their own pages (/take-home).
  const tasks = aiTasks().filter((task) => task.track === 'ai-assisted');
  const companies = aiRoundCompanies();
  return (
    <article>
      <section className="mock-public-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
        {tasks[0] && (
          <Link className="mock-public-cta" href={`/ai-assisted/${tasks[0].slug}`} prefetch={false}>
            {zh ? '开始第一个项目' : 'Start the first project'}
          </Link>
        )}
      </section>
      <section aria-labelledby="ai-round-how">
        <h2 className="mock-public-h2" id="ai-round-how">
          {c.howTitle}
        </h2>
        <ol className="ai-round-steps">
          {c.how.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="ai-round-look">
        <h2 className="mock-public-h2" id="ai-round-look">
          {c.lookTitle}
        </h2>
        <dl className="ai-round-look">
          {c.look.map(([term, text]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="ai-round-tasks">
        <h2 className="mock-public-h2" id="ai-round-tasks">
          {c.tasksTitle}
        </h2>
        <p className="ai-round-lead">{c.tasksLead}</p>
        <ul className="ai-round-tasks">
          {tasks.map((task) => (
            <li key={task.slug}>
              <Link href={`/ai-assisted/${task.slug}`} prefetch={false}>
                <span className="ai-round-chip">{task.kind[i]}</span>
                <strong>{task.title[i]}</strong>
                <span>{task.summary[i]}</span>
                <small>{c.minutes(task.minutes)}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="ai-round-companies">
        <h2 className="mock-public-h2" id="ai-round-companies">
          {c.companiesTitle}
        </h2>
        <p className="ai-round-lead">{c.companiesLead}</p>
        {companies.length ? (
          <ul className="ai-round-companies">
            {companies.map((company) => (
              <li key={company.slug}>
                <strong>{company.name}</strong>
                <span>{c.reports(company.reports)}</span>
                <ul>
                  {company.links.map((link) => (
                    <li key={link.path}>
                      <Link href={link.path} prefetch={false}>
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ai-round-lead">{c.none}</p>
        )}
      </section>
      <section aria-labelledby="ai-round-tips">
        <h2 className="mock-public-h2" id="ai-round-tips">
          {c.tipsTitle}
        </h2>
        <ul className="ai-round-tips">
          {c.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
