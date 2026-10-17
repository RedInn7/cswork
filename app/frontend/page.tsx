import { headers } from 'next/headers';
import Link from 'next/link';
import type { Metadata } from 'next';
import track from '@/lib/content/frontend-js.json';
import mcq from '@/lib/content/oa-mcq.json';
import { breadcrumbJsonLd, seoMetadata, SITE_NAME } from '@/lib/seo';
import { aiEnabled } from '@/lib/server/ai-tutor';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { FrontendProblemList } from './progress';

const COPY = {
  zh: {
    title: `前端面试练习：${track.problems.length} 道 JavaScript 手写题，浏览器里直接判题 | ${SITE_NAME}`,
    description: `防抖节流、Promise.all / any / allSettled、并发控制、深拷贝、柯里化、EventEmitter、LRU、call / apply / bind、手写 new 和 JSON.stringify 等 ${track.problems.length} 道原创 JavaScript 手写题。代码在浏览器的沙箱里运行，用 Jest 风格的用例和假时钟判题，先跑公开用例，再提交全部用例，通过后看题解。`,
    eyebrow: `FRONTEND · ${track.problems.length} 道 JS 手写题 · 浏览器内判题`,
    heading: '前端面试里的手写题，在这里一题一题写过。',
    practice: '只算练习：不计积分、rating 和连续打卡。代码在你的浏览器里运行，不上传。',
    more: '还可以练',
    mcqWeb: (n: number) => `Web 前端选择题（${n} 道）`,
    mcqJs: (n: number) => `JavaScript 读代码选择题（${n} 道）`,
    ai: 'AI 前端模拟面试',
    aiOff: 'AI 前端模拟面试需要 AI 服务，目前暂不可用。',
    crumb: '前端',
  },
  en: {
    title: `Frontend Interview Practice: ${track.problems.length} JavaScript Problems Judged in the Browser | ${SITE_NAME}`,
    description: `${track.problems.length} original JavaScript coding problems: debounce and throttle, Promise.all / any / allSettled, a concurrency-limited pool, deep clone, curry, an event emitter, an LRU cache, call / apply / bind, new and JSON.stringify by hand. Your code runs in a sandbox in your browser against Jest-style tests with a fake clock: run the public tests, submit them all, then read the editorial.`,
    eyebrow: `FRONTEND · ${track.problems.length} JS PROBLEMS · JUDGED IN YOUR BROWSER`,
    heading: 'Write the JavaScript that frontend interviews ask for, one problem at a time.',
    practice: 'Practice only: no points, rating or streaks. Your code runs in your browser and is never uploaded.',
    more: 'More practice',
    mcqWeb: (n: number) => `Web frontend multiple choice (${n})`,
    mcqJs: (n: number) => `JavaScript code-output multiple choice (${n})`,
    ai: 'AI frontend mock interview',
    aiOff: 'The AI frontend mock interview needs the AI service, which is not available right now.',
    crumb: 'Frontend',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const c = COPY[await requestLocale()];
  return seoMetadata({ title: c.title, description: c.description, path: '/frontend' });
}

/** /frontend: the JS problems (judged in the browser, components/js-workspace.tsx) and links to the web and JS MCQs. */
export default async function FrontendPage() {
  const zh = (await requestLocale()) === 'zh';
  const c = COPY[zh ? 'zh' : 'en'];
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const count = (topic: string) => mcq.questions.filter((q) => q.topic === topic).length;
  const groups = track.groups.map((g) => ({
    key: g.key,
    title: zh ? g.zh : g.en,
    items: track.problems
      .filter((p) => p.group === g.key)
      .map((p) => ({ slug: p.slug, title: zh ? p.title.zh : p.title.en, difficulty: p.difficulty as 'easy' | 'medium' | 'hard' })),
  }));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: breadcrumbJsonLd([
            { name: SITE_NAME, path: '/' },
            { name: c.crumb, path: '/frontend' },
          ]),
        }}
      />
      <div className="public-library-intro">
        <p className="public-library-eyebrow">{c.eyebrow}</p>
        <h1>{c.heading}</h1>
        <p>{c.description}</p>
      </div>
      <p className="fejs-practice">{c.practice}</p>
      <FrontendProblemList groups={groups} signedIn={!!viewer} />
      <section className="fejs-more" aria-labelledby="fejs-more-title">
        <h2 id="fejs-more-title">{c.more}</h2>
        <ul>
          <li>
            <Link href="/oa/mcq?topic=web" prefetch={false}>
              {c.mcqWeb(count('web'))} →
            </Link>
          </li>
          <li>
            <Link href="/oa/mcq?topic=js" prefetch={false}>
              {c.mcqJs(count('js'))} →
            </Link>
          </li>
          <li>{aiEnabled() ? <a href="/?view=mock-interview&template=frontend">{c.ai} →</a> : <span className="fejs-off">{c.aiOff}</span>}</li>
        </ul>
      </section>
    </>
  );
}
