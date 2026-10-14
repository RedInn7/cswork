import { headers } from 'next/headers';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CONTEST_KINDS, weeklyTitle } from '@/lib/contest';
import { seoMetadata } from '@/lib/seo';
import { person } from '@/lib/server/auth';
import { contestLobby } from '@/lib/server/contests';
import { origin } from '@/lib/server/env';
import { requestLocale } from '@/lib/server/locale';
import { BandChip, beijingTime } from '@/components/contest-parts';
import { LibraryPageView } from '../library/page-view';
import { CreateRoom, JoinByCode, LocalTime, WeeklyClock } from './client';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const zh = (await requestLocale()) === 'zh';
  return seoMetadata({
    title: zh ? 'CSWork 周赛与比赛房间 · cswork' : 'CSWork weekly contest and rooms · cswork',
    description: zh
      ? '每周日北京时间 09:00 的 90 分钟周赛，4 道按难度分排好的题，赛后按 Elo 结算 rating；也可以和朋友开自选赛或 1v1 对战。'
      : 'A 90-minute weekly every Sunday 09:00 Beijing time: four problems by contest rating, Elo-rated when it ends. Or open a mashup or a 1v1 duel with friends.',
    path: '/contest',
  });
}

type Card = Awaited<ReturnType<typeof contestLobby>>['past'][number];
function Cards({ items, zh }: { items: Card[]; zh: boolean }) {
  return (
    <ul className="lists-public-board contest-list">
      {items.map((room) => (
        <li key={room.id}>
          <a href={`/contest/${encodeURIComponent(room.id)}`}>
            <span className="contest-list-kind">{CONTEST_KINDS[room.kind][zh ? 0 : 1]}</span>
            <strong>{room.week ? weeklyTitle(room.week, zh) : room.title}</strong>
            <span className="lists-public-count">
              <LocalTime at={room.startsAt} fallback={beijingTime(room.startsAt, zh)} /> ·{' '}
              {zh ? `${room.entrants} 人` : `${room.entrants} entered`}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** /contest: this week's weekly (drawn on first sight), the reader's rooms, opening and joining rooms. */
export default async function ContestLobbyPage({ searchParams }: Props) {
  const viewer = await person(new Request(origin(), { headers: await headers() })).catch(() => null);
  const zh = (await requestLocale()) === 'zh';
  const lobby = await contestLobby(viewer);
  const join = (await searchParams).join;
  const t = (a: string, b: string) => (zh ? a : b);
  const weekly = lobby.weekly;
  const weeklyEnd = weekly ? weekly.startsAt + weekly.durationMin * 60000 : 0;
  return (
    <article className="contest-lobby">
      <section className="lists-public-hero contest-hero">
        <p className="lists-public-kicker">{t('CSWork 周赛 · 每周日 09:00 北京时间', 'CSWork Weekly · Sundays 09:00 Beijing')}</p>
        <h1>{weekly?.week ? weeklyTitle(weekly.week, zh) : t('CSWork 周赛', 'CSWork Weekly')}</h1>
        <p>
          {t(
            '4 道题、90 分钟，从易到难按周赛难度分抽取，计分沿用 ICPC 罚时。结束后按 Elo 结算 rating；错过了也能随时虚拟参赛。',
            'Four problems in 90 minutes, easiest to hardest by contest rating, scored with ICPC time penalties. Rated Elo-style when it ends; missed it? Run it virtually any time.',
          )}
        </p>
        {weekly ? (
          <>
            <p className="contest-when">
              <LocalTime at={weekly.startsAt} fallback={beijingTime(weekly.startsAt, zh)} />
              {' · '}
              {t(`已有 ${weekly.entrants} 人报名`, `${weekly.entrants} entered`)}
            </p>
            <WeeklyClock startsAt={weekly.startsAt} endsAt={weeklyEnd} now={lobby.now} />
            <a className="lists-public-cta" href={`/contest/${weekly.id}`}>
              {lobby.now >= weeklyEnd
                ? t('看计分板 · 虚拟参赛', 'Scoreboard · run it virtually')
                : lobby.now >= weekly.startsAt
                  ? t('进入比赛', 'Go to the contest')
                  : t('报名本周周赛', "Enter this week's contest")}{' '}
              →
            </a>
          </>
        ) : (
          <p className="contest-when">{t('题库还不够出一场周赛，稍后再来。', 'Not enough rated problems for a weekly yet.')}</p>
        )}
        {lobby.me?.rating ? (
          <p className="contest-when">
            {t('你的 rating', 'Your rating')} <BandChip rating={lobby.me.rating} zh={zh} />
          </p>
        ) : null}
      </section>

      {!!lobby.mine.length && (
        <section aria-labelledby="contest-mine">
          <h2 id="contest-mine" className="lists-public-h2">
            {t('我的比赛', 'Your contests')}
          </h2>
          <Cards items={lobby.mine} zh={zh} />
        </section>
      )}

      <div className="contest-columns">
        <section aria-labelledby="contest-open">
          <h2 id="contest-open" className="lists-public-h2">
            {t('开一个房间', 'Open a room')}
            <small>{t('自选赛最多 100 人，对战限 2 人', 'Mashups up to 100, duels 2')}</small>
          </h2>
          {lobby.me ? (
            <CreateRoom replays={lobby.replays} suggested={lobby.me.name} verified={lobby.me.verified} />
          ) : (
            <a className="lists-public-cta" href="/?view=account">
              {t('登录后开房间', 'Sign in to open a room')}
            </a>
          )}
        </section>
        <section aria-labelledby="contest-join">
          <h2 id="contest-join" className="lists-public-h2">
            {t('用邀请码加入', 'Join with a code')}
          </h2>
          {lobby.me ? (
            <JoinByCode initialCode={typeof join === 'string' ? join.slice(0, 12) : ''} suggested={lobby.me.name} />
          ) : (
            <a className="lists-public-cta" href="/?view=account">
              {t('登录后加入', 'Sign in to join')}
            </a>
          )}
        </section>
      </div>

      {!!lobby.past.length && (
        <section aria-labelledby="contest-past">
          <h2 id="contest-past" className="lists-public-h2">
            {t('往期周赛', 'Past weeklies')}
            <small>{t('随时可以虚拟参赛', 'Run any of them virtually')}</small>
          </h2>
          <Cards items={lobby.past} zh={zh} />
        </section>
      )}
      <Suspense fallback={null}>
        <LibraryPageView />
      </Suspense>
    </article>
  );
}
