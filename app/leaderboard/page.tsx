import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { LANGUAGE_IDS } from '@/lib/problems';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { origin } from '@/lib/server/env';
import { publicCatalogue, schoolKey } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { BOARD_SORTS, practiceBoard, type BoardSort } from '@/lib/server/practice-board';
import { PracticeBoardView } from './view';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? '练习积分排行榜 · cswork' : 'Practice leaderboard · cswork',
      description: zh
        ? 'CSWork 练习排行榜：按通过题目的难度积分、通过题数和连续打卡天数排名，可按学校和语言筛选。'
        : 'The CSWork practice leaderboard: points by the difficulty of solved problems, problems solved and daily streaks, by school and language.',
      path: '/leaderboard',
    }),
    // Every row is a handle, some of them on profiles kept out of search: so is the board.
    robots: { index: false, follow: false },
  };
}

/**
 * /leaderboard: learners who opted in (lib/server/practice-board.ts). ?sort=score|solved|streak,
 * ?school=<key> (a school with at least 3 listed learners), ?language=<judge language>.
 */
export default async function PracticeLeaderboardPage({ searchParams }: Props) {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const zh = (await requestLocale()) === 'zh';
  const q = await searchParams;
  const pick = (v: string | string[] | undefined) => (typeof v === 'string' && v ? v : undefined);
  const sort = (BOARD_SORTS as readonly string[]).includes(pick(q.sort) ?? '') ? (q.sort as BoardSort) : 'score';
  const wanted = pick(q.school);
  const language = (LANGUAGE_IDS as readonly string[]).includes(pick(q.language) ?? '') ? (q.language as string) : undefined;
  const board = practiceBoard(
    await publicCatalogue(),
    { sort, school: wanted && schoolKey(wanted), language },
    viewer?.id ?? null,
  );
  if (wanted && !board.school) notFound();
  return <PracticeBoardView board={board} sort={sort} language={language} zh={zh} />;
}
