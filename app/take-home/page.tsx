import type { Metadata } from 'next';
import Link from 'next/link';
import { seoMetadata } from '@/lib/seo';
import { aiTasks } from '@/lib/server/ai-tasks';
import { requestLocale } from '@/lib/server/locale';

const copy = {
  en: {
    title: 'Take-Home Coding Assignments: Timed Practice with Hidden Tests · CSWork',
    description:
      'Practise take-home coding assignments the way companies send them: a brief, a skeleton, three hours, hidden tests and a code quality review of structure, tests, error handling and your design note.',
    kicker: 'TAKE-HOME ASSIGNMENTS',
    h1: 'A take-home, against the clock',
    lead: 'Some companies replace a live round with a small project done at home. It is graded like work: does it do what the brief says, is it tested, and could a colleague maintain it?',
    howTitle: 'How a take-home usually works',
    how: [
      'You get a written brief and often a skeleton with the interface fixed. The time is set or suggested, commonly two to four hours.',
      'You hand in code, your own tests and a short note: how to run it, what you assumed and what you would do next.',
      'Graders run their own tests, then read the code. Many teams follow up with a call where you walk them through it.',
      'Rules differ by company: whether AI tools are allowed, the time limit and the language. Ask, and follow what they say.',
    ],
    lookTitle: 'What graders tend to look for',
    look: [
      ['Correctness', 'Every rule of the brief, including the edge cases it only implies. Hidden tests find the ones you skipped.'],
      ['Structure', 'Small functions with one job, names that explain themselves, no copy-paste, nothing clever without a reason.'],
      ['Tests', 'Tests that read like the brief, cover the edges and fail for the right reason.'],
      ['Communication', 'A note that states assumptions and trade-offs instead of hiding them.'],
    ],
    tasksTitle: 'Assignments',
    tasksLead:
      'Python projects with a skeleton, public tests and a hidden suite that shows only how many pass. No AI pair here. After a run, an AI review can score the code quality.',
    minutes: (n: number) => `~${Math.round(n / 60)} h`,
    tipsTitle: 'How to practise',
    tips: [
      'Start the timer, read the whole brief and write down the rules as a checklist before any code.',
      'Write the tests for each rule as you go; run them after every change.',
      'Leave the last twenty minutes for reading your own code and writing the note.',
      'When time is up, stop: note what you would do next instead of rushing it in.',
    ],
  },
  zh: {
    title: '带回家作业（Take-home）：限时练习，隐藏测试与代码评审 · CSWork',
    description: '按公司发 take-home 的方式练习：一份需求、一个代码骨架、三个小时、隐藏测试，以及按结构、测试、错误处理和设计说明打分的代码质量评估。',
    kicker: '带回家作业',
    h1: '限时完成一份带回家作业',
    lead: '有些公司会用一个在家完成的小项目代替一轮现场面试。评分方式和工作一样：是否做到了需求说的、有没有测试、同事能不能接手维护。',
    howTitle: '带回家作业一般怎么进行',
    how: [
      '你会拿到一份书面需求，通常还有接口已经定好的代码骨架。时间是规定或建议的，常见两到四小时。',
      '交付的是代码、你自己写的测试，以及一份简短说明：怎么运行、做了哪些假设、接下来会做什么。',
      '评审会先跑他们自己的测试，再读代码。很多团队之后还会约一次通话，让你讲讲自己的实现。',
      '不同公司的规则不一样：是否允许用 AI、时间限制、使用的语言。先问清楚，并按要求来。',
    ],
    lookTitle: '评审通常看什么',
    look: [
      ['正确性', '需求里的每一条规则，包括只是暗示了的边界情况。你漏掉的，隐藏测试会找出来。'],
      ['结构', '函数小而职责单一，命名能自我解释，没有复制粘贴，没有无缘由的炫技。'],
      ['测试', '测试读起来像需求，覆盖边界，并且因为正确的原因失败。'],
      ['沟通', '说明里把假设和取舍讲清楚，而不是藏起来。'],
    ],
    tasksTitle: '作业',
    tasksLead: 'Python 项目，带代码骨架、公开测试和只显示通过数量的隐藏测试。这里没有 AI 结对。运行之后，可以请 AI 评估代码质量。',
    minutes: (n: number) => `约 ${Math.round(n / 60)} 小时`,
    tipsTitle: '练习建议',
    tips: [
      '先开计时，通读需求，把规则写成清单，再开始写代码。',
      '每实现一条规则就写对应的测试，每次改动后都跑一遍。',
      '留出最后二十分钟读自己的代码、写说明。',
      '时间到就停：把接下来要做的写进说明，而不是匆忙塞进代码。',
    ],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/take-home' });
}

/** /take-home: what a take-home assignment is, what graders look for, and the assignments. */
export default async function TakeHomePage() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'],
    i = zh ? 0 : 1;
  const tasks = aiTasks().filter((task) => task.track === 'take-home');
  return (
    <article>
      <section className="mock-public-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
        {tasks[0] && (
          <Link className="mock-public-cta" href={`/take-home/${tasks[0].slug}`} prefetch={false}>
            {zh ? '开始第一份作业' : 'Start the first assignment'}
          </Link>
        )}
      </section>
      <section aria-labelledby="take-home-how">
        <h2 className="mock-public-h2" id="take-home-how">
          {c.howTitle}
        </h2>
        <ol className="ai-round-steps">
          {c.how.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="take-home-look">
        <h2 className="mock-public-h2" id="take-home-look">
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
      <section aria-labelledby="take-home-tasks">
        <h2 className="mock-public-h2" id="take-home-tasks">
          {c.tasksTitle}
        </h2>
        <p className="ai-round-lead">{c.tasksLead}</p>
        <ul className="ai-round-tasks">
          {tasks.map((task) => (
            <li key={task.slug}>
              <Link href={`/take-home/${task.slug}`} prefetch={false}>
                <span className="ai-round-chip">{task.kind[i]}</span>
                <strong>{task.title[i]}</strong>
                <span>{task.summary[i]}</span>
                <small>{c.minutes(task.minutes)}</small>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="take-home-tips">
        <h2 className="mock-public-h2" id="take-home-tips">
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
