import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { problemTitle } from '@/lib/problems';
import { STOP_NAMES, stopHref } from '@/lib/route-stops';
import { seoMetadata } from '@/lib/seo';
import { publicCatalogue, publicProfile } from '@/lib/server/learner-cloud';
import { requestLocale } from '@/lib/server/locale';
import { ProfileHeatmap } from './heatmap';

type Props = { params: Promise<{ handle: string }> };

/** Off, missing and reserved handles are all a plain 404: nothing says an account exists. */
const load = cache(async (handle: string) => {
  const catalogue = await publicCatalogue();
  const profile = publicProfile(decodeURIComponent(handle).toLowerCase(), catalogue);
  if (!profile) notFound();
  return { profile, catalogue, zh: (await requestLocale()) === 'zh' };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { profile, zh } = await load((await params).handle);
  const { total } = profile.solved;
  return {
    ...seoMetadata({
      title: zh ? `@${profile.handle} 的刷题主页 · CSWork` : `@${profile.handle} on CSWork`,
      description: zh
        ? `@${profile.handle} 在 CSWork 通过了 ${total} 道题。${profile.bio}`
        : `@${profile.handle} has solved ${total} problems on CSWork. ${profile.bio}`,
      path: `/u/${profile.handle}`,
    }),
    // Personal pages stay out of search unless the learner opted in.
    ...(profile.indexable ? {} : { robots: { index: false, follow: false } }),
  };
}

export default async function LearnerProfilePage({ params }: Props) {
  const { profile, catalogue, zh } = await load((await params).handle);
  const t = (a: string, b: string) => (zh ? a : b);
  const { solved } = profile;
  const levels = [
    ['easy', solved.easy],
    ['medium', solved.medium],
    ['hard', solved.hard],
  ] as const;
  return (
    <article className="learner-profile">
      <section className="lists-public-hero learner-hero">
        <p className="lists-public-kicker">{t('学习者主页', 'Learner profile')}</p>
        <h1>@{profile.handle}</h1>
        {profile.bio && <p>{profile.bio}</p>}
        <dl className="learner-stats">
          <div className="learner-total">
            <dt>{t('已通过', 'Solved')}</dt>
            <dd>{solved.total}</dd>
          </div>
          {levels.map(([key, n]) => {
            const level = levelOf(key)!;
            return (
              <div key={key} data-level={key}>
                <dt>{zh ? level[1] : level[2]}</dt>
                <dd>{n}</dd>
              </div>
            );
          })}
        </dl>
        {solved.total > 0 && (
          <span
            className="learner-split"
            aria-hidden="true"
            style={
              {
                '--easy': solved.easy / solved.total,
                '--medium': solved.medium / solved.total,
              } as React.CSSProperties
            }
          />
        )}
      </section>

      <ProfileHeatmap activity={profile.activity} zh={zh} />

      {!!profile.stops.length && (
        <section aria-labelledby="learner-stops">
          <h2 id="learner-stops" className="lists-public-h2">
            {t('500 路已到达的站', 'Line 500 stops reached')}
            <small>{t(`${profile.stops.length} / 35 站`, `${profile.stops.length} of 35 stops`)}</small>
          </h2>
          <ol className="learner-stops">
            {profile.stops.map((stop) => (
              <li key={stop.slug} data-done={stop.solved >= stop.total || undefined}>
                <a href={stopHref(stop.slug) ?? '/?view=problems'}>
                  <span>{STOP_NAMES[stop.slug]?.[zh ? 0 : 1] ?? stop.slug}</span>
                  <small>
                    {stop.solved}/{stop.total}
                  </small>
                  <span
                    className="lists-public-bar"
                    style={{ '--frac': stop.solved / stop.total } as React.CSSProperties}
                    aria-hidden="true"
                  />
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!profile.recent.length && (
        <section aria-labelledby="learner-recent">
          <h2 id="learner-recent" className="lists-public-h2">
            {t('最近通过', 'Recently solved')}
          </h2>
          <ol className="lists-public-rows learner-rows">
            {profile.recent.map((r) => {
              const p = catalogue.get(r.id)!;
              const level = levelOf(p.difficulty);
              return (
                <li key={r.id}>
                  <span className="lists-public-number">{r.id.startsWith('lc-') ? r.id.slice(3) : 'OA'}</span>
                  <a href={problemAppHref(r.id)}>{problemTitle(p, zh ? 'zh' : 'en')}</a>
                  <time dateTime={new Date(r.at).toISOString()} className="lists-public-count">
                    {new Date(r.at).toISOString().slice(0, 10)}
                  </time>
                  <span className="lists-public-level" data-level={level?.[0]}>
                    {level ? (zh ? level[1] : level[2]) : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!!profile.lists.length && (
        <section aria-labelledby="learner-lists">
          <h2 id="learner-lists" className="lists-public-h2">
            {t('公开题单', 'Public lists')}
          </h2>
          <ul className="lists-public-board">
            {profile.lists.map((l) => (
              <li key={l.id}>
                <Link href={`/u/lists/${l.id}`} prefetch={false}>
                  <strong>{l.title}</strong>
                  <span className="lists-public-count">{t(`${l.count} 题`, `${l.count} problems`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="learner-cta">
        <a className="lists-public-cta" href="/?view=problems&utm_source=profile">
          {t('一起在 CSWork 刷题', 'Practice on CSWork too')} →
        </a>
      </p>
    </article>
  );
}
