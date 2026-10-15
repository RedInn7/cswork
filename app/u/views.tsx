import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { threadPath } from '@/lib/community';
import { problemTitle, type ProblemSummary } from '@/lib/problems';
import { STOP_NAMES, stopHref } from '@/lib/route-stops';
import type { followPeople } from '@/lib/server/follows';
import type { publicProfile, readList } from '@/lib/server/learner-cloud';
import type { profileCertificates } from '@/lib/server/certificates';
import { FollowButton } from '@/components/follow-button';
import { ListStar } from '@/components/list-star';
import { LocalDay, ProfileHeatmap } from './heatmap';
import { BandChip, RatingCurve } from '@/components/contest-parts';

/** Judge languages by their usual names; anything else as stored. */
const LANGUAGE_NAMES: Record<string, string> = { python: 'Python', cpp: 'C++', java: 'Java', go: 'Go', sql: 'SQL', pandas: 'Pandas' };

/** /u/<handle>: a learner's opt-in page. Pure of request context, so tests render it directly. */
export function ProfileView({
  profile,
  catalogue,
  zh,
  certificates = [],
}: {
  profile: NonNullable<ReturnType<typeof publicProfile>>;
  catalogue: ReadonlyMap<string, ProblemSummary>;
  zh: boolean;
  /** Course completion certificates (lib/server/certificates.ts). */
  certificates?: ReturnType<typeof profileCertificates>;
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
        {profile.featured && (
          <div className="learner-featured" data-group={profile.featured.group}>
            <span aria-hidden="true">★</span>
            <span className="sr-only">{t('展示的徽章：', 'Featured badge: ')}</span>
            {zh ? profile.featured.zh : profile.featured.en}
          </div>
        )}
        {profile.employer && (
          <div className="learner-employer">
            {t(`已验证 · ${profile.employer} 员工`, `Verified · ${profile.employer} employee`)}
          </div>
        )}
        {profile.bio && <p>{profile.bio}</p>}
        <div className="learner-social">
          <FollowButton handle={profile.handle} zh={zh} followers={profile.followers ?? 0}>
            <a href={`/u/${profile.handle}/following`}>
              <b>{profile.following ?? 0}</b> {t('关注中', 'following')}
            </a>
            {!!profile.listStars && (
              <span>
                <b>{profile.listStars}</b> {t('次题单被收藏', profile.listStars === 1 ? 'list save' : 'list saves')}
              </span>
            )}
          </FollowButton>
        </div>
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

      {!!profile.contest?.length && (
        <section aria-labelledby="learner-contest">
          <h2 id="learner-contest" className="lists-public-h2">
            {t('比赛 rating', 'Contest rating')}
            <small>
              <a href="/contest/leaderboard">{t('排行榜', 'Leaderboard')}</a>
            </small>
          </h2>
          <RatingCurve points={profile.contest} zh={zh} />
        </section>
      )}

      {profile.duel && (
        <section aria-labelledby="learner-duel">
          <h2 id="learner-duel" className="lists-public-h2">
            {t('1v1 排位', 'Ranked 1v1')}
          </h2>
          <p className="learner-duel">
            <BandChip rating={profile.duel.rating} zh={zh} duel />
            <span>
              {t(
                `${profile.duel.wins} 胜 ${profile.duel.losses} 负 ${profile.duel.draws} 平`,
                `${profile.duel.wins}W ${profile.duel.losses}L ${profile.duel.draws}D`,
              )}
            </span>
            <span>
              {t(`连胜 ${profile.duel.streak}，最长 ${profile.duel.best}`, `Streak ${profile.duel.streak}, best ${profile.duel.best}`)}
            </span>
          </p>
        </section>
      )}

      {(!!profile.languages?.length || !!profile.badges?.length) && (
        <div className="learner-pair">
          {!!profile.languages?.length && (
            <section aria-labelledby="learner-langs">
              <h2 id="learner-langs" className="lists-public-h2">
                {t('语言', 'Languages')}
                <small>{t('按通过的不同题数', 'distinct problems solved')}</small>
              </h2>
              <ul className="learner-langs">
                {profile.languages.map((l) => (
                  <li key={l.language}>
                    <span>{LANGUAGE_NAMES[l.language] ?? l.language}</span>
                    <b>{l.n}</b>
                    <span
                      className="lists-public-bar"
                      style={{ '--frac': l.n / Math.max(1, profile.languages[0].n) } as React.CSSProperties}
                      aria-hidden="true"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!!profile.badges?.length && (
            <section aria-labelledby="learner-badges">
              <h2 id="learner-badges" className="lists-public-h2">
                {t('徽章', 'Badges')}
                <small>{t(`${profile.badges.length} 枚`, `${profile.badges.length} earned`)}</small>
              </h2>
              <ul className="learner-badges">
                {profile.badges.map((b) => (
                  <li key={b.id} data-group={b.group}>
                    {zh ? b.zh : b.en}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

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
                  <LocalDay time={r.at} className="lists-public-count" />
                  <span className="lists-public-level" data-level={level?.[0]}>
                    {level ? (zh ? level[1] : level[2]) : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!!profile.posts?.total && (
        <section aria-labelledby="learner-posts">
          <h2 id="learner-posts" className="lists-public-h2">
            {t('题解与讨论', 'Solutions and threads')}
            <small>
              {t(
                `${profile.posts.total} 篇 · 共获 ${profile.posts.votes} 赞`,
                `${profile.posts.total} posts · ${profile.posts.votes} ${profile.posts.votes === 1 ? 'upvote' : 'upvotes'}`,
              )}
            </small>
          </h2>
          <ol className="lists-public-rows learner-rows learner-posts">
            {profile.posts.items.map((post) => {
              const thread = post.target.startsWith('discuss:');
              return (
                <li key={post.id}>
                  <span className="lists-public-number">{thread ? t('讨论', 'Thread') : t('题解', 'Solution')}</span>
                  <a href={thread ? threadPath(post.id) : problemAppHref(post.target)}>{post.title}</a>
                  <LocalDay time={post.createdAt} className="lists-public-count" />
                  <span className="lists-public-count">
                    <span aria-hidden="true">▲ </span>
                    {post.votes}
                    <span className="sr-only">{t(' 赞', post.votes === 1 ? ' upvote' : ' upvotes')}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!!certificates.length && (
        <section aria-labelledby="learner-certificates">
          <h2 id="learner-certificates" className="lists-public-h2">
            {t('结业证书', 'Certificates')}
          </h2>
          <ul className="lists-public-board">
            {certificates.map((c) => (
              <li key={c.id}>
                <a href={`/certificate/${c.id}`}>
                  <strong>{c.course}</strong>
                  <LocalDay time={c.issuedAt} className="lists-public-count" />
                </a>
              </li>
            ))}
          </ul>
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
                  <span className="lists-public-count">
                    {t(`${l.count} 题`, `${l.count} problems`)}
                    {!!l.stars && t(` · ${l.stars} 收藏`, ` · ${l.stars} ${l.stars === 1 ? 'save' : 'saves'}`)}
                  </span>
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
        <ListStar id={list.id} stars={list.stars ?? 0} forks={list.forks ?? 0} zh={zh} />
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

/** /u/<handle>/followers and /following: visible profiles only. */
export function FollowListView({
  people,
  which,
  zh,
}: {
  people: NonNullable<ReturnType<typeof followPeople>>;
  which: 'followers' | 'following';
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  return (
    <article>
      <nav className="lists-public-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <a href={`/u/${people.handle}`}>@{people.handle}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{which === 'followers' ? t('关注者', 'Followers') : t('关注中', 'Following')}</span>
      </nav>
      <section className="lists-public-hero learner-hero">
        <p className="lists-public-kicker">{which === 'followers' ? t('关注者', 'Followers') : t('关注中', 'Following')}</p>
        <h1>@{people.handle}</h1>
        <div className="learner-social">
          <a href={`/u/${people.handle}/followers`} aria-current={which === 'followers' ? 'page' : undefined}>
            <b>{people.followers}</b> {t('关注者', people.followers === 1 ? 'follower' : 'followers')}
          </a>
          <a href={`/u/${people.handle}/following`} aria-current={which === 'following' ? 'page' : undefined}>
            <b>{people.followees}</b> {t('关注中', 'following')}
          </a>
        </div>
      </section>
      {people.items.length ? (
        <ul className="lists-public-board">
          {people.items.map((p) => (
            <li key={p.handle}>
              <a href={`/u/${p.handle}`}>
                <strong>@{p.handle}</strong>
                {p.bio && <span className="lists-public-count">{p.bio}</span>}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="learner-empty">
          {which === 'followers'
            ? t('还没有公开主页的关注者。', 'No followers with a public profile yet.')
            : t('还没有关注公开主页。', 'Not following any public profile yet.')}
        </p>
      )}
      <p className="learner-note">
        {t(
          '只列出开启了公开主页的学习者。',
          'Only learners who turned their public profile on are listed.',
        )}
      </p>
    </article>
  );
}
