import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { CONTEST_BANDS } from '@/lib/contest';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { leaderboard } from '@/lib/server/contests';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { BandChip } from '@/components/contest-parts';

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh ? '周赛与入门赛 Rating 排行榜 · cswork' : 'Weekly and starter contest ratings · cswork',
    description: zh
      ? 'CSWork 周赛与入门赛共用的 Elo rating 排行榜与段位：车库、站站停、快车、直达、特快、高铁、磁浮。'
      : 'Elo ratings from the CSWork weekly and starter contests, by band: Depot, Local, Express, Rapid, Limited, Bullet, Maglev.',
    path: '/contest/leaderboard',
  });
}

/** /contest/leaderboard: the top 100 current ratings, by the name each raced under last. */
export default async function ContestLeaderboardPage() {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const zh = (await requestLocale()) === 'zh';
  const t = (a: string, b: string) => (zh ? a : b);
  const rows = await leaderboard(viewer);
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
      {rows.length ? (
        <div className="contest-board-wrap" role="region" aria-label={t('排行榜', 'Leaderboard')} tabIndex={0}>
          <table className="contest-board contest-ratings">
            <caption>{t('当前 rating 前 100', 'Top 100 current ratings')}</caption>
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
                    {r.name}
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
