import '../../ai-assisted/ai-assisted.css';
import './ica.css';
import Link from 'next/link';
import { breadcrumbJsonLd, SITE_NAME, seoMetadata } from '@/lib/seo';
import { icaTasks } from '@/lib/server/ai-tasks';
import { canSeeProblem } from '@/lib/server/oj-problems';
import { requestLocale } from '@/lib/server/locale';
import { shownMockPresets } from '@/lib/server/mock-oa-presets';

const copy = {
  en: {
    title: `CodeSignal ICA Practice: Four-Level Project Problems | ${SITE_NAME}`,
    description:
      'Practise CodeSignal Industry Coding Assessment style problems: one Python project in four gated levels, judged against hidden tests, with a 90-minute timer. How ICA differs from GCA and which companies use it.',
    kicker: 'CODESIGNAL ICA-STYLE PRACTICE',
    h1: 'One project, four levels',
    lead: 'In an Industry Coding Assessment you build one small system and extend it level by level. Each level adds operations, and the next one opens only when the current level passes its tests. These sets are written for this site: practise the format, not the exact questions.',
    compareTitle: 'ICA or GCA?',
    compare: [
      ['General Coding Assessment (GCA)', 'Four independent algorithm problems, usually about 70 minutes. Each problem stands alone; you can skip around.'],
      ['Industry Coding Assessment (ICA)', 'One project in four gated levels, usually about 90 minutes: an in-memory store, a bank ledger, a file store. Later levels reuse what you built, so the design of level 1 matters. AI tools are not allowed.'],
      ['Scoring here', 'Your score is the levels you passed plus the share of hidden tests your latest run passes on the level you are on. Formats change: the invite email is the authority.'],
    ],
    setsTitle: 'Practice sets',
    levels: (n: number, m: number) => `${n} levels · ~${m} min`,
    companiesTitle: 'Companies whose OA notes mention it',
    companiesLead: 'From our mock OA research notes: the reports describe an Industry Coding style test for these companies.',
    mock: 'Mock OA',
    tipsTitle: 'How to practise',
    tips: [
      'Read the level brief twice and run the public tests before writing code.',
      'Keep data in structures you can extend: later levels add history, time and ownership to what you store.',
      'Process time-based events before each operation, exactly as the brief orders them.',
      'Start the timer and do a whole set in one sitting; then redo it faster.',
    ],
    rest: 'REST API problems (offline API, Python)',
  },
  zh: {
    title: `CodeSignal ICA 式练习：四关递进的项目题 | ${SITE_NAME}`,
    description: '练习 CodeSignal Industry Coding Assessment（ICA）式题目：一个 Python 项目分四关递进，过关才解锁下一关，用隐藏测试评分，带 90 分钟计时。介绍 ICA 和 GCA 的区别，以及哪些公司用这种形式。',
    kicker: 'CODESIGNAL ICA 式练习',
    h1: '一个项目，四关递进',
    lead: 'Industry Coding Assessment 让你实现一个小系统，并一关一关地扩展：每关增加新操作，当前关通过测试后才解锁下一关。这里的题目是本站原创，用来熟悉形式，不是原题。',
    compareTitle: 'ICA 和 GCA 有什么不同',
    compare: [
      ['General Coding Assessment（GCA）', '4 道互相独立的算法题，通常约 70 分钟。每题单独计分，可以跳着做。'],
      ['Industry Coding Assessment（ICA）', '一个项目分 4 关递进，通常约 90 分钟，例如内存存储、银行账本、文件存储。后面的关卡沿用前面写的代码，第 1 关的设计很重要。不允许使用 AI 工具。'],
      ['这里怎么计分', '得分 = 已通过的关数 + 当前关最近一次运行的隐藏测试通过比例。各公司形式会变，以邀请邮件为准。'],
    ],
    setsTitle: '练习题组',
    levels: (n: number, m: number) => `${n} 关 · 约 ${m} 分钟`,
    companiesTitle: 'OA 笔记里提到这种形式的公司',
    companiesLead: '来自本站模拟 OA 的调研笔记：这些公司的报告提到 Industry Coding 式测试。',
    mock: '模拟 OA',
    tipsTitle: '练习建议',
    tips: [
      '每关先把说明读两遍、跑一遍公开测试，再动手写代码。',
      '数据结构留出扩展余地：后面的关卡会给存储的数据加上历史、时间和归属。',
      '涉及时间的事件，按说明规定的顺序在每个操作开始前先处理。',
      '开启计时，一次做完一整组；之后再限时重做一遍。',
    ],
    rest: 'REST API 题（离线接口，Python）',
  },
};

/** Presets whose research notes describe the Industry Coding format (lib/content/mock-oa-presets.json). */
const icaCompanies = () => shownMockPresets().filter((p) => /industry coding/i.test(p.notes_en ?? ''));

export async function generateMetadata() {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/oa/ica' });
}

/** /oa/ica: the ICA format, how it differs from GCA, the practice sets and the companies that use it. */
export default async function IcaIndex() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'],
    i = zh ? 0 : 1;
  const tasks = icaTasks();
  const companies = icaCompanies();
  // The rest- track is published only after go-judge verified it (scripts/publish-sql-track.ts): no link before then.
  const rest = await canSeeProblem(null, 'rest-01');
  return (
    <article className="ica-round">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name: 'ICA', path: '/oa/ica' },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">ICA</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{c.kicker}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </div>
      <h2 className="oa-public-section">{c.compareTitle}</h2>
      <dl className="ica-compare">
        {c.compare.map(([term, text]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
      <h2 className="oa-public-section">{c.setsTitle}</h2>
      <ul className="ai-round-tasks">
        {tasks.map((task) => (
          <li key={task.slug}>
            <Link href={`/oa/ica/${task.slug}`} prefetch={false}>
              <span className="ai-round-chip">ICA</span>
              <strong>{task.title[i]}</strong>
              <span>{task.summary[i]}</span>
              <small>{c.levels(task.levels.length, task.minutes)}</small>
            </Link>
          </li>
        ))}
      </ul>
      {companies.length > 0 && (
        <>
          <h2 className="oa-public-section">{c.companiesTitle}</h2>
          <p className="ica-lead">{c.companiesLead}</p>
          <ul className="ica-companies">
            {companies.map((company) => (
              <li key={company.slug}>
                <strong>{company.name}</strong>
                <span>{zh ? company.notes_zh : company.notes_en}</span>
                <Link href={`/mock-oa/${company.slug}`} prefetch={false}>
                  {c.mock} {company.name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="oa-public-section">{c.tipsTitle}</h2>
      <ul className="ai-round-tips">
        {c.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {rest && (
        <p className="oa-public-actions">
          <a className="oa-public-cta is-quiet" href={`/?${new URLSearchParams({ view: 'problem', problem: 'rest-01' })}`}>
            {c.rest}
          </a>
        </p>
      )}
    </article>
  );
}
