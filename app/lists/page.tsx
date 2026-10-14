import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { classicLists } from '@/lib/classic-lists';
import { listClassicLibrary } from '@/lib/server/study-library';

const copy = {
  en: {
    title: 'Classic LeetCode lists mapped to CSWork · CSWork',
    description:
      'Top 100 Liked, Top Interview 150, Blind 75, Grind 75, LeetCode 75, Coding Interviews (剑指 Offer) and Cracking the Coding Interview, mapped problem by problem to CSWork: see which ones you can judge online here and which link out to LeetCode. Not official lists.',
    h1: 'Classic lists, mapped to this bank.',
    lead: 'Each list is matched by problem number; book problems are matched to the same problem on LeetCode where there is one. Problems judgeable here open in the CSWork editor; the rest are marked external and link to LeetCode. These are mappings by cswork, not the official lists.',
  },
  zh: {
    title: '经典题单对照：热题 100、面试经典 150、LeetCode 75、剑指 Offer、面试金典 · CSWork',
    description:
      '把热题 100、面试经典 150、Blind 75、Grind 75、LeetCode 75、剑指 Offer 和程序员面试金典按题号对照到 CSWork：哪些题能在本站在线判题，哪些标为站外并链接到力扣。非官方题单。',
    h1: '经典题单，按题号对照到本站。',
    lead: '每份题单按题号逐题对照，书里的题对照到力扣主站上的同一道题（有的话）：本站能判的题直接进 CSWork 编辑器，其余标为站外并链接到力扣。题单由 cswork 整理对照，并非官方题单。',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = copy[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/lists' });
}

export default async function ListsIndex() {
  const zh = (await requestLocale()) === 'zh',
    c = copy[zh ? 'zh' : 'en'];
  return (
    <>
      <section className="lists-public-hero">
        <p className="lists-public-kicker">{zh ? '经典题单 · 对照' : 'Classic lists · Mapped'}</p>
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </section>
      <section aria-labelledby="lists-public-board">
        <h2 id="lists-public-board" className="lists-public-h2">
          {zh ? '选择题单' : 'Choose a list'}
        </h2>
        <ul className="lists-public-board">
          {classicLists.map((list) => {
            const { total, ready } = listClassicLibrary(list).collection;
            return (
              <li key={list.slug}>
                <Link href={`/lists/${list.slug}`} prefetch={false}>
                  <strong>{zh ? list.nameZh : list.nameEn}</strong>
                  <span className="lists-public-count">
                    {zh ? `本站可判 ${ready} / ${total}` : `${ready} of ${total} judgeable here`}
                  </span>
                  <span
                    className="lists-public-bar"
                    style={{ '--frac': total ? ready / total : 0 } as React.CSSProperties}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
