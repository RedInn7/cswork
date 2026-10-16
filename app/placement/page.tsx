import '../library/library.css';
import { headers } from 'next/headers';
import Link from 'next/link';
import { Placement } from '@/components/placement';
import { PER_GROUP, RETAKE_DAYS } from '@/lib/placement';
import { ROUTE_SECTIONS } from '@/lib/route-stops';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';

export async function generateMetadata() {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh ? '题型识别定位测验：哪些算法专题可以跳过 · cswork' : 'Pattern placement quiz: which algorithm topics to skip · cswork',
    description: zh
      ? '按 500 路的六组专题出题，答对升一档、答错降一档，认出每道题该用的方法。结果给出每组的估计水平和可以跳过的站，并直接用到冲刺计划里。'
      : 'Questions from the six groups of Line 500 on a ladder that climbs with each right answer. Name the technique each problem calls for and get a level per group, the stops you can skip, and a sprint plan that skips them.',
    path: '/placement',
  });
}

/** /placement: the pattern-recognition placement quiz (components/placement.tsx), signed in. */
export default async function PlacementPage() {
  const zh = (await requestLocale()) === 'zh';
  const L = (zhText: string, en: string) => (zh ? zhText : en);
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  return (
    <div className="public-library" lang={zh ? 'zh-CN' : 'en'}>
      <header className="public-library-header">
        <Link className="public-library-brand" href="/" prefetch={false}>
          cswork<span> / {L('定位测验', 'placement')}</span>
        </Link>
        <Link href="/?view=speedrun" prefetch={false}>
          {L('题型快练', 'Pattern speedrun')} <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="public-library-main" id="main-content">
        <article className="public-library-article">
          <header className="public-library-article-header">
            <p className="public-library-eyebrow">PLACEMENT</p>
            <h1>{L('题型识别定位测验', 'Pattern placement quiz')}</h1>
            <p>
              {L(
                `500 路的 ${ROUTE_SECTIONS.length} 组专题各出 ${PER_GROUP} 题，题目从周赛难度分 1500 左右起步，答对一题升 200，答错降 200。每题读题面开头，判断它该用哪一站的方法。全部答对的组可以跳过，冲刺计划会把这些站标成已掌握，从第一个没掌握的站出发；其他组各推荐两道题，做一做验证结果。每 ${RETAKE_DAYS} 天可以重测一次。`,
                `Each of the ${ROUTE_SECTIONS.length} groups of Line 500 asks ${PER_GROUP} questions. They start near a contest rating of 1500 and move up 200 after a right answer, down 200 after a miss. Read the opening of each statement and pick the stop whose technique it calls for. A group answered right throughout can be skipped: the sprint plan marks its stops as known and starts at the first one you have not covered. Every other group gets two problems to check the result. You can retake the quiz every ${RETAKE_DAYS} days.`,
              )}
            </p>
            <p>
              {L(
                '它测的是题型识别，不是写代码的能力，结果只作为排计划的参考。',
                'It tests recognising patterns, not writing code, so treat the result as a starting point for your plan.',
              )}
            </p>
          </header>
          {viewer ? (
            <Placement zh={zh} />
          ) : (
            <p>
              {L('登录后就能开始测验，结果会保存在你的账户里。', 'Sign in to take the quiz; the result is kept in your account.')}{' '}
              <Link href="/?view=account" prefetch={false}>
                {L('登录 / 注册', 'Sign in / sign up')} →
              </Link>
            </p>
          )}
        </article>
      </main>
      <footer className="public-library-footer">
        <Link href="/?view=problems" prefetch={false}>
          {L('500 路', 'Line 500')}
        </Link>
        <Link href="/privacy" prefetch={false}>
          {L('隐私', 'Privacy')}
        </Link>
      </footer>
    </div>
  );
}
