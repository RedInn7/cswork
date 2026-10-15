import Link from 'next/link';
import bankFile from '@/lib/content/oa-mcq.json';
import type { McqQuestion } from '@/lib/mock-oa';
import { breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { McqPractice } from './practice';

const bank = bankFile.questions as McqQuestion[];

function copy(zh: boolean) {
  return zh
    ? {
        title: 'OA 选择题练习：操作系统、数据库、网络、并发、读代码与概率 | CSWork',
        lead: `${bank.length} 道原创 OA 风格选择题，覆盖 CS 基础（操作系统、数据库、网络、并发、面向对象）、读代码（Python、JavaScript、Java）和数学逻辑。提交后立即判分并给出解析。`,
      }
    : {
        title: 'OA Multiple-Choice Practice: OS, Databases, Networking, Code Output | CSWork',
        lead: `${bank.length} original OA-style multiple-choice questions on CS fundamentals (OS, databases, networking, concurrency, OOP), code output (Python, JavaScript, Java) and quant. Each is graded the moment you submit, with an explanation.`,
      };
}

export async function generateMetadata() {
  const { title, lead } = copy((await requestLocale()) === 'zh');
  return seoMetadata({ title, description: lead, path: '/oa/mcq' });
}

export default async function OaMcqPage() {
  const zh = (await requestLocale()) === 'zh';
  const { lead } = copy(zh);
  // Only the page's language goes to the browser.
  const items = bank.map(({ zh: zhText, en, ...q }) => ({ ...q, text: zh ? zhText : en }));
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
      <McqPractice items={items} zh={zh} />
    </>
  );
}
