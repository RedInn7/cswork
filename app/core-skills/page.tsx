import '../library/library.css';
import '../topics/topics.css';
import Link from 'next/link';
import { Suspense } from 'react';
import track from '@/lib/content/core-skills.json';
import { problemAppHref } from '@/lib/classic-lists';
import { SITE_NAME, breadcrumbJsonLd, seoMetadata } from '@/lib/seo';
import { requestLocale } from '@/lib/server/locale';
import { LibraryPageView } from '../library/page-view';

const N = track.problems.length;
const COPY = {
  zh: {
    title: `Core Skills：手写数据结构、经典算法、并发与面向对象设计 ${N} 题 | ${SITE_NAME}`,
    description:
      '不调库，亲手实现动态数组、链表、哈希表、堆、LRU 缓存、快速排序、归并排序、KMP、BFS、Dijkstra、最小生成树、并查集、字典树、线段树和树状数组，再用锁、条件变量和信号量写按序执行、哲学家就餐、有界阻塞队列和读写锁等多线程题，最后把停车场、电梯、ATM、售货机、分账、电影选座、快递柜和酒店预订这些面向对象设计（LLD）题写成能判对错的类。每题有 Python、C++、Java、Go 起始代码和固定驱动，在线判题。',
    eyebrow: `CORE SKILLS · ${N} 题 · 4 种语言`,
    heading: '把常用的数据结构和算法亲手写一遍。',
    crumb: 'Core Skills',
    open: '打开 Core Skills 练习',
  },
  en: {
    title: `Core Skills: ${N} Data Structures, Algorithms, Concurrency & OOD Problems by Hand | ${SITE_NAME}`,
    description:
      'No libraries: implement a dynamic array, linked list, hash map, heap, LRU cache, quicksort, merge sort, KMP, BFS, Dijkstra, minimum spanning trees, union-find, a trie, a segment tree and a Fenwick tree yourself, then use locks, condition variables and semaphores for multithreaded problems such as run in order, dining philosophers, a bounded blocking queue and a read-write lock, and finally write object-oriented design (LLD) classes for a parking lot, an elevator, an ATM, a vending machine, Splitwise, movie seat booking, a parcel locker and hotel booking, judged like the rest. Every problem has Python, C++, Java and Go starters with a fixed driver, judged online.',
    eyebrow: `CORE SKILLS · ${N} PROBLEMS · 4 LANGUAGES`,
    heading: 'Write the everyday data structures and algorithms yourself.',
    crumb: 'Core Skills',
    open: 'Practice Core Skills',
  },
};

export async function generateMetadata() {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/core-skills' });
}

/** Public index of the Core Skills track; the problems themselves open in the app (components/core-skills.tsx). */
export default async function CoreSkillsPage() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  const problems = new Map(track.problems.map((item, index) => [item.id, { ...item, number: index + 1 }] as const));
  return (
    <div className="public-library topics-public" lang={zh ? 'zh-CN' : 'en'}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: '/core-skills' },
          ]),
        }}
      />
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / core skills</span>
        </Link>
        <Link href="/?view=problems&library=core" prefetch={false}>
          {c.open} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <div className="public-library-intro">
          <p className="public-library-eyebrow">{c.eyebrow}</p>
          <h1>{c.heading}</h1>
          <p>{c.description}</p>
        </div>
        <div className="topics-map">
          {track.groups.map((group) => (
            <section className="topics-group" key={group.key} aria-labelledby={`core-group-${group.key}`}>
              <h2 id={`core-group-${group.key}`}>
                <span>{zh ? group.zh : group.en}</span>
                <span className="topics-group-range">{group.ids.length}</span>
              </h2>
              <ol className="topics-line">
                {group.ids.map((id) => {
                  const item = problems.get(id)!;
                  return (
                    <li key={id}>
                      <a href={problemAppHref(id)}>
                        <span className="topics-no" aria-hidden="true">
                          {item.number}
                        </span>
                        <span className="topics-stop-name">{zh ? item.titleZh : item.titleEn}</span>
                        <span className="topics-stop-pattern">{zh ? item.summaryZh : item.summaryEn}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </main>
      <footer className="public-library-footer">
        <Link href="/topics" prefetch={false}>
          {zh ? '模板速查' : 'Templates'}
        </Link>
        <Link href="/roadmap" prefetch={false}>
          {zh ? '路线图' : 'Roadmap'}
        </Link>
        <Link href="/library" prefetch={false}>
          {zh ? '面试资料库' : 'Library'}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {zh ? '隐私' : 'Privacy'}
        </Link>
      </footer>
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </div>
  );
}
