import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CONTEST_BANDS } from '@/lib/contest';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { leaderboard, schoolBoards } from '@/lib/server/contests';
import { origin } from '@/lib/server/env';
import { schoolKey } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { BandChip } from '@/components/contest-parts';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return {
    ...seoMetadata({
      title: zh ? '周赛与入门赛 Rating 排行榜 · cswork' : 'Weekly and starter contest ratings · cswork',
      description: zh
        ? 'CSWork 周赛与入门赛共用的 Elo rating 排行榜与段位：车库、站站停、快车、直达、特快、高铁、磁浮。'
        : 'Elo ratings from the CSWork weekly and starter contests, by band: Depot, Local, Express, Rapid, Limited, Bullet, Maglev.',
      path: '/contest/leaderboard',
    }),
    // School boards rest on self-reported schools: kept out of search.
    ...((await searchParams).school ? { robots: { index: false, follow: false } } : {}),
  };
}

/**
 * /contest/leaderboard: the top 100 current ratings, by the name each raced under last.
 * ?school=<key>: a school with at least 3 learners showing school and contests on their profile.
 */
export default async function ContestLeaderboardPage({ searchParams }: Props) {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const zh = (await requestLocale()) === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  const wanted = (await searchParams).school;
  const boards = schoolBoards();
  const school = typeof wanted === 'string' ? boards.find((b) => b.key === schoolKey(wanted)) : undefined;
  if (wanted !== undefined && !school) notFound();
  const rows = await leaderboard(viewer, 100, Date.now(), school?.key);
  return (
    <article className="contest-leaderboard">
      <section className="lists-public-hero contest-hero">
        <p className="lists-public-kicker">{t('比赛 Rating', 'Contest ratings')}</p>
        <h1>{t('Rating 排行榜', 'Rating board')}</h1>
        <p>
          {t(
            '每场周赛和入门赛结束后按 Elo 结算（入门赛只给 1700 以下的人计分）：人人从 1500 起步，名次超出预期就涨，场次越多变化越稳。段位按列车等级命名。',
            'Every weekly and starter is rated Elo-style when it ends (a starter only below 1700): everyone starts at 1500, placing above expectation raises it, and ratings steady as you race more. Bands are named after the trains on the line.',
          )}
        </p>
        <ul className="contest-bands" aria-label={t('段位', 'Bands')}>
          {CONTEST_BANDS.map((band) => (
            <li key={band.key}>
              <span className="lc-rating contest-band" data-band={band.color}>
                <b>{band.from || '<1400'}</b>
                <span>{zh ? band.zh : band.en}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {!!boards.length && (
        <nav className="contest-schools" aria-label={t('学校排行榜', 'School boards')}>
          <a href="/contest/leaderboard" aria-current={school ? undefined : 'page'}>
            {t('全站', 'Everyone')}
          </a>
          {boards.map((b) => (
            <a
              key={b.key}
              href={`/contest/leaderboard?school=${encodeURIComponent(b.key)}`}
              aria-current={b.key === school?.key ? 'page' : undefined}
            >
              {b.name} <small>{b.members}</small>
            </a>
          ))}
        </nav>
      )}
      {school && (
        <p className="contest-hidden-note">
          {t(
            `${school.name}：学校是学习者自己填写的，未经验证。只列出公开主页、同时展示学校和比赛记录的人。`,
            `${school.name}: schools are self-reported and unverified. Only learners whose public profile shows both their school and their contests are listed.`,
          )}
        </p>
      )}
      {rows.length ? (
        <div className="contest-board-wrap" role="region" aria-label={t('排行榜', 'Leaderboard')} tabIndex={0}>
          <table className="contest-board contest-ratings">
            <caption>
              {school ? t(`${school.name} · 当前 rating`, `${school.name} · current ratings`) : t('当前 rating 前 100', 'Top 100 current ratings')}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('比赛昵称', 'Contest name')}</th>
                <th scope="col">Rating</th>
                <th scope="col">{t('比赛场次', 'Contests')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} data-me={r.me || undefined}>
                  <td className="contest-rank">{r.rank}</td>
                  <th scope="row">
                    {r.handle ? <a href={`/u/${r.handle}`}>{r.name}</a> : r.name}
                    {r.me && <small>{t('你', 'you')}</small>}
                  </th>
                  <td>
                    <BandChip rating={r.rating} zh={zh} />
                  </td>
                  <td>{r.contests}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="contest-hidden-note">
          {t('第一场比赛结算后，这里就有名次了。', 'The board fills in once the first contest is rated.')}{' '}
          <a href="/contest">{t('去报名', 'Enter the weekly')} →</a>
        </p>
      )}
    </article>
  );
}
