import '../mock-oa/mock-oa-public.css';
import '../guide/guide.css';
import './review-sheet.css';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { ReviewSheet } from '@/components/review-sheet';
import { GuideShell } from '../guide/shell';

const copy = {
  en: {
    title: 'One-Page Review Sheet · CSWork',
    description: 'Your own notes, stars, mistakes and leeches for a company, Line 500 stops or a classic list, on one printable page.',
    kicker: 'REVIEW SHEET · PRIVATE',
    h1: 'The night before, on one page.',
    lead: 'Pick a company, up to eight Line 500 stops or a classic list. The sheet gathers the problems you wrote notes on, starred, queued to redo, got wrong or keep failing, the shakiest first, in your own words. Drop or reorder rows, then print it.',
    book: 'Print every problem note as a review book',
    privacyTitle: 'Only you see this',
    privacy: 'The sheet is built from your own notes, marks and submissions; nothing here is shared. Printing and the PDF happen in this browser.',
    more: 'Privacy notice',
    signIn: 'Sign in to build a review sheet from your notes.',
    signInLink: 'Sign in',
  },
  zh: {
    title: '面试前一页纸复习单 · CSWork',
    description: '按公司、Line 500 站点或经典题单，把你自己的笔记、收藏、错题和顽固题收成一页，可以直接打印。',
    kicker: '复习单 · 仅自己可见',
    h1: '面试前一晚，看这一页就够。',
    lead: '选一家公司、最多 8 个 Line 500 站点，或一个经典题单。复习单会收进你写过笔记、收藏、标了重做、做错过或反复忘记的题，把握最低的排在前面，内容都是你自己写的。可以删行、调顺序，然后打印。',
    book: '把全部题目笔记打印成复习册',
    privacyTitle: '只有你能看到',
    privacy: '复习单只读取你自己的笔记、标记和提交记录，不会分享给任何人。打印和存 PDF 都在你的浏览器里完成。',
    more: '隐私说明',
    signIn: '登录后即可用自己的笔记生成复习单。',
    signInLink: '登录',
  },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return {
    ...seoMetadata({ title: c.title, description: c.description, path: '/review-sheet' }),
    // Private to each learner: not a landing page, and not in the sitemap.
    robots: { index: false, follow: false },
  };
}

/** /review-sheet: the one-page review sheet, or ?view=book&by=stop|list:<slug> the review book (components/review-sheet.tsx). */
export default async function ReviewSheetPage({ searchParams }: Props) {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  const query = await searchParams;
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const book = one(query.view) === 'book';
  return (
    <GuideShell zh={zh}>
      <nav className="mock-public-crumbs" aria-label={zh ? '导航路径' : 'Breadcrumb'}>
        <a href="/?view=progress">{zh ? '我的进度' : 'My progress'}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{book ? (zh ? '复习册' : 'Review book') : zh ? '复习单' : 'Review sheet'}</span>
      </nav>
      <section className="mock-public-hero guide-hero">
        <p className="mock-public-kicker">{c.kicker}</p>
        <h1>{book ? c.book : c.h1}</h1>
        {!book && <p>{c.lead}</p>}
      </section>
      <div className="resume-privacy" role="note">
        <strong>{c.privacyTitle}</strong>
        <p>
          {c.privacy} <a href="/privacy#privacy-learning">{c.more}</a>
        </p>
      </div>
      {!book && (
        <p className="guide-top-links rs-links">
          <a href="?view=book&by=stop">{c.book} →</a>
        </p>
      )}
      {viewer ? (
        <ReviewSheet
          zh={zh}
          book={book}
          by={one(query.by)}
          company={one(query.company)}
          stops={one(query.stops)}
          list={one(query.list)}
        />
      ) : (
        <div className="resume-off">
          <p>{c.signIn}</p>
          <a href="/?view=account">{c.signInLink} →</a>
        </div>
      )}
    </GuideShell>
  );
}
