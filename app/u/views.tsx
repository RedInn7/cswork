import { levelOf, problemAppHref } from '@/lib/classic-lists';
import { problemTitle, type ProblemSummary } from '@/lib/problems';
import { STOP_NAMES, stopHref } from '@/lib/route-stops';
import type { followPeople } from '@/lib/server/follows';
import type { publicCompare, publicProfile, publicYear, readList } from '@/lib/server/learner-cloud';
import type { Activity } from '@/components/practice-calendar';
import type { profileCertificates } from '@/lib/server/certificates';
import { FollowButton } from '@/components/follow-button';
import { ListStar } from '@/components/list-star';
import { LocalDay, ProfileHeatmap } from './heatmap';
import { ClimbChart, EffortChart } from './practice-charts';
import { BandChip, RatingCurve } from '@/components/contest-parts';

/** Judge languages by their usual names; anything else as stored. */
export const LANGUAGE_NAMES: Record<string, string> = { python: 'Python', cpp: 'C++', java: 'Java', go: 'Go', sql: 'SQL', pandas: 'Pandas' };
const LINK_NAMES: Record<string, string> = { github: 'GitHub', linkedin: 'LinkedIn', x: 'X' };
const LEVELS = ['easy', 'medium', 'hard'] as const;
type Solved = { total: number; easy: number; medium: number; hard: number };

/** Solved counts by difficulty, the profile's big numbers. */
function SolvedStats({ solved, zh }: { solved: Solved; zh: boolean }) {
  return (
    <>
      <dl className="learner-stats">
        <div className="learner-total">
          <dt>{zh ? '已通过' : 'Solved'}</dt>
          <dd>{solved.total}</dd>
        </div>
        {LEVELS.map((key) => {
          const level = levelOf(key)!;
          return (
            <div key={key} data-level={key}>
              <dt>{zh ? level[1] : level[2]}</dt>
              <dd>{solved[key]}</dd>
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
    </>
  );
}

/** /u/<handle>: a learner's opt-in page. Pure of request context, so tests render it directly. */
export function ProfileView({
  profile,
  catalogue,
  zh,
  certificates = [],
  year,
  viewer,
}: {
  profile: NonNullable<ReturnType<typeof publicProfile>>;
  catalogue: ReadonlyMap<string, ProblemSummary>;
  zh: boolean;
  /** Course completion certificates (lib/server/certificates.ts). */
  certificates?: ReturnType<typeof profileCertificates>;
  /** ?year=: that calendar year's heatmap in place of the last half year. */
  year?: { year: number; activity: Activity[] };
  /** The signed-in reader's own visible handle: offers "compare with me". */
  viewer?: string | null;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { solved } = profile;
  const facts = [
    profile.school,
    profile.gradYear && t(`${profile.gradYear} 届`, `Class of ${profile.gradYear}`),
    profile.targetRole && t(`目标岗位：${profile.targetRole}`, `Aiming for ${profile.targetRole}`),
  ].filter(Boolean);
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
        {!!facts.length && <p className="learner-facts">{facts.join(' · ')}</p>}
        {!!profile.links?.length && (
          <ul className="learner-links" aria-label={t('链接', 'Links')}>
            {profile.links.map((link) => (
              <li key={link.kind}>
                <a href={link.url} rel="nofollow ugc noopener" target="_blank">
                  {LINK_NAMES[link.kind] ?? new URL(link.url).hostname.replace(/^www\./, '')}
                  <span className="sr-only">{t('（新窗口打开）', ' (opens in a new tab)')}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
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
            {!!profile.reputation && (
              <span title={t('帖子被点赞、面经通过审核所得的积分', 'Points from upvoted posts and approved interview reports')}>
                <b>{profile.reputation}</b> {t('声望', 'reputation')}
              </span>
            )}
            {viewer && viewer !== profile.handle && (
              <a href={`/u/compare?a=${viewer}&b=${profile.handle}`}>{t('和我对比', 'Compare with me')}</a>
            )}
          </FollowButton>
        </div>
        <SolvedStats solved={solved} zh={zh} />
      </section>

      {!!profile.years?.length && (
        <nav className="learner-years" aria-label={t('按年份看热力图', 'Heatmap by year')}>
          <a href={`/u/${profile.handle}`} aria-current={year ? undefined : 'page'}>
            {t('近半年', 'Last 6 months')}
          </a>
          {profile.years.map((y) => (
            <a key={y} href={`/u/${profile.handle}?year=${y}`} aria-current={year?.year === y ? 'page' : undefined}>
              {y}
            </a>
          ))}
          {year && (
            <a className="learner-years-recap" href={`/u/${profile.handle}/recap/${year.year}`}>
              {t(`${year.year} 年度回顾`, `${year.year} in review`)} →
            </a>
          )}
        </nav>
      )}
      <ProfileHeatmap activity={year?.activity ?? profile.activity} zh={zh} year={year?.year} />

      {profile.climb && profile.effort && (
        <div className="learner-pair">
          <section aria-labelledby="learner-climb">
            <h2 id="learner-climb" className="lists-public-h2">
              {t('累计解题', 'Climbing')}
              <small>{t('按周，不同的题', 'distinct problems by week')}</small>
            </h2>
            <ClimbChart climb={profile.climb} zh={zh} />
          </section>
          <section aria-labelledby="learner-effort">
            <h2 id="learner-effort" className="lists-public-h2">
              {t('每日难度', 'Daily effort')}
              <small>{t('最近 12 周首次通过（UTC 日期）', 'first solves, last 12 weeks (UTC days)')}</small>
            </h2>
            <EffortChart effort={profile.effort} zh={zh} />
          </section>
        </div>
      )}

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
            {t('题解', 'Solutions')}
            <small>
              {t(
                `${profile.posts.total} 篇 · 共获 ${profile.posts.votes} 赞`,
                `${profile.posts.total} posts · ${profile.posts.votes} ${profile.posts.votes === 1 ? 'upvote' : 'upvotes'}`,
              )}
            </small>
          </h2>
          <ol className="lists-public-rows learner-rows learner-posts">
            {profile.posts.items.map((post) => (
              <li key={post.id}>
                <span className="lists-public-number">{t('题解', 'Solution')}</span>
                <a href={problemAppHref(post.target)}>{post.title}</a>
                <LocalDay time={post.createdAt} className="lists-public-count" />
                <span className="lists-public-count">
                  <span aria-hidden="true">▲ </span>
                  {post.votes}
                  <span className="sr-only">{t(' 赞', post.votes === 1 ? ' upvote' : ' upvotes')}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {!!certificates.length && (
        <section aria-labelledby="learner-certificates">
          <h2 id="learner-certificates" className="lists-public-h2">
            {t('证书', 'Certificates')}
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

/** /u/<handle>/recap/<year>: one year of a public profile. */
export function RecapView({ recap, zh }: { recap: NonNullable<ReturnType<typeof publicYear>>; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { handle, year } = recap;
  return (
    <article className="learner-profile">
      <nav className="lists-public-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        <a href={`/u/${handle}`}>@{handle}</a>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{t(`${year} 年度回顾`, `${year} in review`)}</span>
      </nav>
      <section className="lists-public-hero learner-hero">
        <p className="lists-public-kicker">{t('年度回顾', 'Year in review')}</p>
        <h1>{t(`@${handle} 的 ${year}`, `@${handle} in ${year}`)}</h1>
        <SolvedStats solved={recap.solved} zh={zh} />
        {recap.contest && (
          <p className="learner-recap-contest">
            {t(
              `参加 ${recap.contest.contests} 场计分比赛，rating ${recap.contest.start} → ${recap.contest.end}`,
              `${recap.contest.contests} rated ${recap.contest.contests === 1 ? 'contest' : 'contests'}, rating ${recap.contest.start} → ${recap.contest.end}`,
            )}
          </p>
        )}
      </section>
      <ProfileHeatmap activity={recap.activity} zh={zh} year={year} />
      {!!recap.stops.length && (
        <section aria-labelledby="learner-recap-stops">
          <h2 id="learner-recap-stops" className="lists-public-h2">
            {t('这一年刷得最多的 500 路站点', 'Line 500 stops with most solved this year')}
          </h2>
          <ol className="learner-stops">
            {recap.stops.map((stop) => (
              <li key={stop.slug}>
                <a href={stopHref(stop.slug) ?? '/?view=problems'}>
                  <span>{STOP_NAMES[stop.slug]?.[zh ? 0 : 1] ?? stop.slug}</span>
                  <small>{t(`今年 ${stop.solved} 题 / 共 ${stop.total}`, `${stop.solved} of ${stop.total} this year`)}</small>
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
      {recap.years.length > 1 && (
        <nav className="learner-years" aria-label={t('其他年份', 'Other years')}>
          {recap.years.map((y) => (
            <a key={y} href={`/u/${handle}/recap/${y}`} aria-current={y === year ? 'page' : undefined}>
              {y}
            </a>
          ))}
        </nav>
      )}
      <p className="learner-note">
        {t(
          '按你所在时区的日期统计热力图；通过题数按 UTC 年份统计。',
          'The heatmap counts days in your time zone; solved counts follow the UTC year.',
        )}
      </p>
    </article>
  );
}

/** /u/compare: two or three public profiles side by side, counts only. */
export function CompareView({ compare, zh }: { compare: NonNullable<ReturnType<typeof publicCompare>>; zh: boolean }) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { people } = compare;
  const rows: [string, string, keyof Solved][] = [
    ['已通过', 'Solved', 'total'],
    ...LEVELS.map((key) => {
      const level = levelOf(key)!;
      return [level[1], level[2], key] as [string, string, keyof Solved];
    }),
  ];
  return (
    <article className="learner-profile">
      <section className="lists-public-hero learner-hero">
        <p className="lists-public-kicker">{t('刷题对比', 'Compare')}</p>
        <h1>{people.map((p) => `@${p.handle}`).join(' vs ')}</h1>
        <p className="learner-compare-common">
          {compare.common === null
            ? t(
                '互相关注后可以看到共同通过的题数',
                `Follow each other to see how many problems you ${people.length > 2 ? 'all' : 'both'} solved`,
              )
            : t(
                people.length > 2 ? `三人都通过的题：${compare.common} 道` : `两人都通过的题：${compare.common} 道`,
                `Solved by ${people.length > 2 ? 'all three' : 'both'}: ${compare.common}`,
              )}
        </p>
      </section>
      <div className="contest-board-wrap" role="region" aria-label={t('按难度的通过数', 'Solved by difficulty')} tabIndex={0}>
        <table className="contest-board learner-compare">
          <caption className="sr-only">{t('按难度的通过数', 'Solved by difficulty')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('难度', 'Difficulty')}</th>
              {people.map((p) => (
                <th scope="col" key={p.handle}>
                  <a href={`/u/${p.handle}`}>@{p.handle}</a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([rowZh, rowEn, key]) => (
              <tr key={key}>
                <th scope="row">{t(rowZh, rowEn)}</th>
                {people.map((p) => (
                  <td key={p.handle}>{p.solved[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!compare.stops.length && (
        <section aria-labelledby="learner-compare-stops">
          <h2 id="learner-compare-stops" className="lists-public-h2">
            {t('500 路各站进度', 'Line 500 stops')}
          </h2>
          <ol className="learner-compare-stops">
            {compare.stops.map((stop) => (
              <li key={stop.slug}>
                <a href={stopHref(stop.slug) ?? '/?view=problems'}>{STOP_NAMES[stop.slug]?.[zh ? 0 : 1] ?? stop.slug}</a>
                <ul>
                  {people.map((p) => {
                    const n = p.stops[stop.slug] ?? 0;
                    return (
                      <li key={p.handle}>
                        <span>@{p.handle}</span>
                        <b>
                          {n}/{stop.total}
                        </b>
                        <span
                          className="lists-public-bar"
                          style={{ '--frac': n / stop.total } as React.CSSProperties}
                          aria-hidden="true"
                        />
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="learner-note">
        {t(
          '只比较公开主页上已有的统计和共同通过的题数，不列出具体题目。',
          'Only the counts each public profile already shows, plus how many problems all of them solved; never which ones.',
        )}
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
