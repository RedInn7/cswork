import { LANGUAGE_IDS } from '@/lib/problems';
import type { BoardSort, practiceBoard } from '@/lib/server/practice-board';
import { LANGUAGE_NAMES } from '../u/views';

const SORTS: [BoardSort, string, string][] = [
  ['score', '积分', 'Points'],
  ['solved', '通过题数', 'Solved'],
  ['streak', '连续天数', 'Streak'],
];

/** /leaderboard: pure of request context, so tests render it directly. */
export function PracticeBoardView({
  board,
  sort,
  language,
  zh,
}: {
  board: ReturnType<typeof practiceBoard>;
  sort: BoardSort;
  language?: string;
  zh: boolean;
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  const { school, mine } = board;
  const query = (s: BoardSort) => {
    const q = new URLSearchParams();
    if (s !== 'score') q.set('sort', s);
    if (school) q.set('school', school.key);
    if (language) q.set('language', language);
    return `/leaderboard${q.toString() ? `?${q}` : ''}`;
  };
  const scope = [school?.name, language && LANGUAGE_NAMES[language]].filter(Boolean).join(' · ');
  const row = (r: (typeof board.rows)[number]) => (
    <>
      <td className="contest-rank">{r.rank}</td>
      <th scope="row">
        <a href={`/u/${r.handle}`}>@{r.handle}</a>
        {r.me && <small>{t('你', 'you')}</small>}
      </th>
      <td>{r.score}</td>
      <td>{r.solved}</td>
      <td>{r.streak}</td>
    </>
  );
  return (
    <article className="contest-public contest-leaderboard practice-board">
      <section className="lists-public-hero contest-hero">
        <p className="lists-public-kicker">{t('练习排行榜', 'Practice leaderboard')}</p>
        <h1>{t('练习积分榜', 'Practice board')}</h1>
        <p>
          {t(
            '每道通过的题只算一次：力扣题按它所在周赛的难度分（zerotrac rating）计分，没有分数的题按简单 1200、中等 1600、困难 2000 计，总和除以 100 就是积分。只统计判题模式下公开题库里的题，和主页上的通过数一致。',
            'Each accepted problem counts once: a LeetCode problem scores its contest difficulty rating (zerotrac), anything without one scores 1200, 1600 or 2000 for easy, medium or hard, and the total over 100 is your points. Only judged runs on public problems count, the same ones your profile counts.',
          )}
        </p>
        <p className="contest-calendar">
          <a href="/contest/leaderboard">{t('比赛 Rating 排行榜', 'Contest rating board')} →</a>
        </p>
      </section>
      <nav className="contest-schools" aria-label={t('排序方式', 'Sort by')}>
        {SORTS.map(([key, zhName, en]) => (
          <a key={key} href={query(key)} aria-current={key === sort ? 'page' : undefined}>
            {t(zhName, en)}
          </a>
        ))}
      </nav>
      <form className="practice-filters" method="get" action="/leaderboard">
        {sort !== 'score' && <input type="hidden" name="sort" value={sort} />}
        <label>
          <span>{t('学校', 'School')}</span>
          <select name="school" defaultValue={school?.key ?? ''}>
            <option value="">{t('全站', 'Everyone')}</option>
            {board.schools.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} ({s.members})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('语言', 'Language')}</span>
          <select name="language" defaultValue={language ?? ''}>
            <option value="">{t('全部语言', 'All languages')}</option>
            {LANGUAGE_IDS.map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_NAMES[l] ?? l}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">{t('筛选', 'Filter')}</button>
      </form>
      {school && (
        <p className="contest-hidden-note">
          {t(
            `${school.name}：学校是学习者自己填写的，未经验证。同校至少 3 人上榜才有学校榜。`,
            `${school.name}: schools are self-reported and unverified. A school gets a board once 3 of its learners are listed.`,
          )}
        </p>
      )}
      {language && (
        <p className="contest-hidden-note">
          {t(
            `只算用 ${LANGUAGE_NAMES[language]} 通过的题；连续天数不分语言。`,
            `Only problems accepted in ${LANGUAGE_NAMES[language]} count; the streak covers every language.`,
          )}
        </p>
      )}
      {board.rows.length ? (
        <div className="contest-board-wrap" role="region" aria-label={t('排行榜', 'Leaderboard')} tabIndex={0}>
          <table className="contest-board">
            <caption>
              {scope ? `${scope} · ` : ''}
              {t(`${board.total} 人上榜`, `${board.total} listed`)}
            </caption>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('主页名', 'Handle')}</th>
                {SORTS.map(([key, zhName, en]) => (
                  <th key={key} scope="col" aria-sort={key === sort ? 'descending' : undefined}>
                    {t(zhName, en)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={r.handle} data-me={r.me || undefined}>
                  {row(r)}
                </tr>
              ))}
            </tbody>
            {mine && !board.rows.some((r) => r.me) && (
              <tfoot>
                <tr data-me>{row(mine)}</tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <p className="contest-hidden-note">{t('这里还没有人上榜。', 'Nobody is listed here yet.')}</p>
      )}
      {!mine && !scope && (
        <p className="contest-hidden-note">
          {t('想上榜？在', 'Want a place? Turn on ')}
          <a href="/?view=account">{t('账户设置', 'your public profile')}</a>
          {t(
            '里公开主页，并勾选「出现在练习排行榜」。榜上只显示主页名和这三项数字。',
            ' in account settings and tick "List me on the practice leaderboard". The board shows only your handle and these three numbers.',
          )}
        </p>
      )}
    </article>
  );
}
