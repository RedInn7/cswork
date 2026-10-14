import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { problemTitle, type ProblemSummary } from '@/lib/problems';
import { STOP_NAMES, stopHref } from '@/lib/route-stops';
import type { publicProfile, readList } from '@/lib/server/learner-cloud';
import { ProfileHeatmap } from './heatmap';

/** /u/<handle>: a learner's opt-in page. Pure of request context, so tests render it directly. */
export function ProfileView({
  profile,
  catalogue,
  zh,
}: {
  profile: NonNullable<ReturnType<typeof publicProfile>>;
  catalogue: ReadonlyMap<string, ProblemSummary>;
  zh: boolean;
}) {
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
                <a href={`/u/lists/${l.id}`}>
                  <strong>{l.title}</strong>
                  <span className="lists-public-count">{t(`${l.count} 题`, `${l.count} problems`)}</span>
                </a>
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

/** /u/lists/<id>: a public learner list. */
export function PublicListView({
  list,
  items,
  zh,
}: {
  list: NonNullable<ReturnType<typeof readList>>;
  items: { id: string; problem: ProblemSummary }[];
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <article>
      <section className="lists-public-hero">
        <p className="lists-public-kicker">
          {list.owner ? (
            <>
              {t('题单 · 来自 ', 'List · by ')}
              <a href={`/u/${list.owner}`} className="learner-owner">
                @{list.owner}
              </a>
            </>
          ) : (
            t('学习者题单', 'Learner list')
          )}
        </p>
        <h1>{list.title}</h1>
        {list.description && <p className="learner-description">{list.description}</p>}
        <div className="lists-public-meter">
          <span>
            <strong>{items.length}</strong> {t('道题', items.length === 1 ? 'problem' : 'problems')}
          </span>
        </div>
        <a className="lists-public-cta" href={`/?view=lists&list=${encodeURIComponent(list.id)}&utm_source=list`}>
          {t('复制到我的题单并开始练习', 'Copy it to my lists and practice')} →
        </a>
      </section>
      {items.length ? (
        <ol className="lists-public-rows learner-rows">
          {items.map(({ id, problem }, index) => {
            const level = levelOf(problem.difficulty);
            return (
              <li key={id}>
                <span className="lists-public-number">{index + 1}</span>
                <a href={problemAppHref(id)}>
                  {id.startsWith('lc-') ? `${id.slice(3)}. ` : ''}
                  {problemTitle(problem, zh ? 'zh' : 'en')}
                </a>
                <span className="lists-public-tags">
                  <span className="lists-public-judge">{id.startsWith('lc-') ? 'LeetCode' : 'OA'}</span>
                </span>
                <span className="lists-public-level" data-level={level?.[0]}>
                  {level ? (zh ? level[1] : level[2]) : ''}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="learner-empty">{t('这个题单还是空的。', 'This list is empty for now.')}</p>
      )}
    </article>
  );
}
