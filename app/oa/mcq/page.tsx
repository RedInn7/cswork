import Link from 'next/link';
import bankFile from '@/lib/content/oa-mcq.json';
import { mcqScope, type McqQuestion } from '@/lib/mock-oa';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { sdChapters } from '@/lib/server/system-design-course';
import { McqPractice } from './practice';

const bank = bankFile.questions as McqQuestion[];
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function copy(zh: boolean) {
  return zh
    ? {
        title: 'OA 选择题练习：数据结构、复杂度、操作系统、数据库、网络与读代码 | CSWork',
        lead: `${bank.length} 道原创 OA 风格选择题，覆盖 CS 基础（数据结构与算法、操作系统、数据库、网络、并发、面向对象、Linux 命令行、Git、计算机体系结构、Web 安全、设计模式、Web 前端）、读代码（时间复杂度、Python、JavaScript、Java、C++、SQL）和数学逻辑。读代码题的答案都是实际运行得出的。提交后立即判分并给出解析；答过的题按 1、3、7、21 天的间隔回来复习。`,
      }
    : {
        title: 'OA Multiple-Choice Practice: DSA, Complexity, OS, Databases, Code Output | CSWork',
        lead: `${bank.length} original OA-style multiple-choice questions on CS fundamentals (data structures and algorithms, OS, databases, networking, concurrency, OOP, the Linux command line, Git, computer architecture, web security, design patterns, web frontend), code output (time complexity, Python, JavaScript, Java, C++, SQL) and quant. Every code-output answer comes from running the code. Each question is graded the moment you submit, with an explanation, and comes back for review after 1, 3, 7 and 21 days.`,
      };
}

export async function generateMetadata() {
  const { title, lead } = copy((await requestLocale()) === 'zh');
  return seoMetadata({ title, description: lead, path: '/oa/mcq' });
}

export default async function OaMcqPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh';
  const { lead } = copy(zh);
  const { items: chosen, initial } = mcqScope(bank, await searchParams);
  // Only the page's language goes to the browser.
  const items = chosen.map(({ zh: zhText, en, ...q }) => ({ ...q, text: zh ? zhText : en }));
  // Only titles and right choices of the chapter quizzes, to find the learner's wrong answers.
  const sd = sdChapters
    .filter((c) => c.quiz.length)
    .map((c) => ({ slug: c.slug, title: zh ? c.titleZh : c.titleEn, answers: c.quiz.map((q) => q.answer) }));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: 'CSWork', path: '/' },
            { name: 'OA', path: '/oa' },
            { name: zh ? '选择题' : 'MCQ', path: '/oa/mcq' },
          ]),
        }}
      />
      <nav className="public-library-breadcrumb" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <Link href="/oa" prefetch={false}>
          OA
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{zh ? '选择题' : 'Multiple choice'}</span>
      </nav>
      <div className="public-library-intro">
        <p className="public-library-eyebrow">
          {zh ? 'OA 选择题 · 即时判分' : 'OA MULTIPLE CHOICE · INSTANT FEEDBACK'}
        </p>
        <h1>{zh ? 'OA 里的选择题，先在这里练。' : 'Practise the multiple-choice part of the OA.'}</h1>
        <p>{lead}</p>
      </div>
      <McqPractice items={items} zh={zh} sd={sd} initial={initial} />
    </>
  );
}
