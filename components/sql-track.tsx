'use client';

import '@/app/classic-list.css';
import { useEffect, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Button } from './ui/button';
import { useLocale } from '@/lib/i18n';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import sqlTrack from '@/lib/content/sql-track.json';
import type { Navigate } from './learning';

const LANGUAGE_KEY = 'cswork:sql-track-language';
type TrackLanguage = 'sql' | 'pandas';

type TrackProps = {
  navigate: Navigate;
  availableProblemIds: string[];
  activity: { problem_id: string }[];
  signedIn: boolean;
};
type Copy = [zh: string, en: string];

/**
 * A first-party practice track (the SQL track, Core Skills): its own problems,
 * grouped by topic. The list is static (built with the packages, e.g. by
 * scripts/sql-track/build.ts); a row shows once its problem is published.
 * Solved marks come from the bootstrap's accepted-submission days.
 */
export function ProblemTrack({
  navigate,
  availableProblemIds,
  activity,
  signedIn,
  library,
  track,
  copy,
  judgeId = (id) => id,
  controls,
}: TrackProps & {
  /** The ?library= key, remembered for the workspace's next-problem button. */
  library: string;
  track: {
    groups: { key: string; zh: string; en: string; ids: string[] }[];
    problems: { id: string; titleZh: string; titleEn: string; difficulty: string }[];
  };
  copy: { kicker: Copy; title: Copy; lead: Copy; progress: Copy; empty: Copy };
  /** The problem a track row opens, e.g. its pandas version (SqlTrack); the row's own id by default. */
  judgeId?: (id: string) => string;
  /** Shown under the lead, e.g. the SQL track's SQL / Pandas switch. */
  controls?: ReactNode;
}) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const say = ([zh, en]: Copy) => (english ? en : zh);
  const available = new Set(availableProblemIds);
  // ponytail: the bootstrap's ~26 weeks of accepted runs; older solves show as unsolved.
  const solved = new Set(activity.map((item) => item.problem_id));
  // Rows are numbered by their place in the whole track, published or not.
  const problems = new Map(track.problems.map((item, index) => [item.id, { ...item, number: index + 1 }] as const));
  const groups = track.groups
    .map((group) => ({ ...group, ids: group.ids.filter((id) => available.has(judgeId(id))) }))
    .filter((group) => group.ids.length);
  const sequence = groups.flatMap((group) => group.ids.map(judgeId));
  const done = sequence.filter((id) => solved.has(id)).length;
  const next = signedIn ? sequence.find((id) => !solved.has(id)) : undefined;
  // A link to one topic (/learn/sql → #sql-group-joins) lands before the rows render: scroll once they do.
  const listed = sequence.length > 0;
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (listed && id) document.getElementById(id)?.scrollIntoView?.({ block: 'start' });
  }, [listed]);
  const open = (event: React.MouseEvent | null, id: string) => {
    // Let modified clicks open the problem in a new tab.
    if (event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    event?.preventDefault();
    if (!signedIn) {
      window.dispatchEvent(new Event('cswork:auth-required'));
      return;
    }
    rememberProblemSequence(sequence, library);
    navigate('problem', { problem: id });
  };

  return (
    <section className="study-library study-bank classic-list" lang={english ? 'en' : 'zh'}>
      <div className="classic-board">
        <p className="classic-kicker">{say(copy.kicker)}</p>
        <h1>{say(copy.title)}</h1>
        <p className="classic-lead">{say(copy.lead)}</p>
        {controls}
        {sequence.length > 0 && (
          <div className="classic-meter">
            <p className="classic-count">
              {signedIn ? (
                <>
                  <strong>{done}</strong>
                  {t(` / ${sequence.length} 道已通过`, ` of ${sequence.length} solved`)}
                </>
              ) : (
                <>
                  <strong>{sequence.length}</strong>
                  {t(' 道题可在本站判题', ' problems judged here')}
                </>
              )}
            </p>
            {signedIn && (
              <progress
                className="classic-progress"
                max={sequence.length}
                value={done}
                aria-label={say(copy.progress)}
              />
            )}
            {!signedIn ? (
              <Button className="route-cta" onClick={() => open(null, sequence[0])}>
                {t('登录后开始练习', 'Sign in to start')}
              </Button>
            ) : next ? (
              <Button className="route-cta" onClick={() => open(null, next)}>
                {done ? t('开始下一题', 'Start next problem') : t('从第一题开始', 'Start the first problem')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {!sequence.length ? (
        <output className="study-state">{say(copy.empty)}</output>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="classic-group" aria-labelledby={`${library}-group-${group.key}`}>
            <h2 className="route-heading" id={`${library}-group-${group.key}`}>
              <span className="route-heading-name">{english ? group.en : group.zh}</span>
              <span className="route-count">
                {signedIn
                  ? `${group.ids.filter((id) => solved.has(judgeId(id))).length}/${group.ids.length}`
                  : group.ids.length}
              </span>
            </h2>
            <div className="study-list">
              {group.ids.map((id) => {
                const item = problems.get(id)!;
                const level = levelOf(item.difficulty);
                const target = judgeId(id);
                const isSolved = signedIn && solved.has(target);
                return (
                  <a
                    key={target}
                    className="study-row"
                    href={problemAppHref(target)}
                    data-next={target === next || undefined}
                    onClick={(event) => open(event, target)}
                  >
                    <span
                      className="study-progress"
                      data-progress={isSolved ? 'solved' : 'not_started'}
                      title={isSolved ? t('已通过', 'Solved') : undefined}
                    >
                      {isSolved && <Check size={18} aria-hidden="true" />}
                      {isSolved && <span className="sr-only">{t('已通过', 'Solved')}</span>}
                    </span>
                    <span className="study-row-main">
                      <strong>
                        {target === next && <span className="route-next-pill">{t('下一题', 'Next')}</span>}
                        <span className="study-number">{item.number}.</span>{' '}
                        {english ? item.titleEn : item.titleZh}
                      </strong>
                    </span>
                    <span className="study-level" data-level={level?.[0]}>
                      {level ? (english ? level[2] : level[1]) : ''}
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        ))
      )}
    </section>
  );
}

/**
 * The SQL track (?view=problems&library=sql): CSWork's own SQL problems, judged on SQLite.
 * Once pandas versions (pd-xx) are listed, a SQL / Pandas switch picks which
 * of each problem the rows open; it is remembered in this browser. ?pattern= keeps
 * the rows of one interview pattern (the /learn/sql course links there).
 */
export function SqlTrack(props: TrackProps) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const [language, setLanguage] = useState<TrackLanguage>('sql');
  useEffect(() => {
    try {
      if (localStorage.getItem(LANGUAGE_KEY) === 'pandas') setLanguage('pandas');
    } catch {
      // Storage blocked: start on SQL.
    }
  }, []);
  const pick = (value: TrackLanguage) => {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {
      // Storage blocked: the switch still works on this page.
    }
  };
  // pd-xx is sql-xx in pandas, listed only while the judge can run pandas.
  const pandasId = (id: string) => `pd-${id.slice(4)}`;
  const available = new Set(props.availableProblemIds);
  const hasPandas = sqlTrack.problems.some((item) => available.has(pandasId(item.id)));
  const pandas = hasPandas && language === 'pandas';
  const judge = pandas ? pandasId : (id: string) => id;
  const [pattern, setPattern] = useState(() =>
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('pattern') ?? ''),
  );
  const counts = new Map(
    sqlTrack.patterns.map(({ key }) => [
      key,
      sqlTrack.problems.filter((item) => item.patterns.includes(key) && available.has(judge(item.id))).length,
    ]),
  );
  // An unknown pattern, or one with nothing published yet, shows the whole track.
  const active = counts.get(pattern) ? pattern : '';
  const filter = (key: string) => {
    setPattern(key);
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('pattern', key);
    else url.searchParams.delete('pattern');
    window.history.replaceState(window.history.state, '', url);
  };
  const shown = new Set(sqlTrack.problems.filter((item) => item.patterns.includes(active)).map((item) => item.id));
  const track = active
    ? {
        ...sqlTrack,
        groups: sqlTrack.groups.map((group) => ({ ...group, ids: group.ids.filter((id) => shown.has(id)) })),
      }
    : sqlTrack;
  return (
    <ProblemTrack
      {...props}
      library="sql"
      track={track}
      judgeId={pandas ? pandasId : undefined}
      controls={
        <>
          {hasPandas && (
            <fieldset className="classic-site">
              <legend className="sr-only">{t('练习语言', 'Practice language')}</legend>
              {(['sql', 'pandas'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={(pandas ? 'pandas' : 'sql') === value}
                  onClick={() => pick(value)}
                >
                  {value === 'sql' ? 'SQL' : 'Pandas'}
                </button>
              ))}
            </fieldset>
          )}
          {[...counts.values()].some(Boolean) && (
            <fieldset className="classic-patterns">
              <legend className="sr-only">{t('按题型筛选', 'Filter by pattern')}</legend>
              <button type="button" aria-pressed={!active} onClick={() => filter('')}>
                {t('全部题型', 'All patterns')}
              </button>
              {sqlTrack.patterns
                .filter(({ key }) => counts.get(key))
                .map(({ key, zh, en }) => (
                  <button key={key} type="button" aria-pressed={active === key} onClick={() => filter(key)}>
                    {english ? en : zh} <span>{counts.get(key)}</span>
                  </button>
                ))}
            </fieldset>
          )}
        </>
      }
      copy={{
        kicker: pandas
          ? ['SQL 专项 · Pandas 版', 'SQL track · pandas edition']
          : ['SQL 专项 · SQLite 方言', 'SQL track · SQLite dialect'],
        title: ['SQL 专项练习', 'SQL Practice Track'],
        lead: pandas
          ? [
              '同一批题目的 pandas 版：每张表是一个 DataFrame，写 solve(tables) 返回结果 DataFrame。判题器在服务端用和 SQL 版相同的隐藏数据运行它并比较结果；答错时可以逐行对比期望和实际结果。',
              'The same problems in pandas: each table is a DataFrame, and solve(tables) returns the result DataFrame. The judge runs it on the server against the SQL version’s hidden datasets and compares the results, and a wrong answer shows the expected and actual rows side by side.',
            ]
          : [
              'CSWork 原创的 SQL 题：连接、分组与 HAVING、子查询、窗口函数、NULL、字符串和日期处理。提交一条 SELECT，判题器在 SQLite 内存数据库里对多组隐藏数据运行它并比较结果集；答错时可以逐行对比期望和实际结果。',
              'Original CSWork SQL problems: joins, GROUP BY and HAVING, subqueries, window functions, NULLs, strings and dates. Submit one SELECT; the judge runs it on several hidden datasets in an in-memory SQLite database and compares the result sets, and a wrong answer shows the expected and actual rows side by side.',
            ],
        progress: pandas ? ['Pandas 版进度', 'Pandas edition progress'] : ['SQL 专项进度', 'SQL track progress'],
        empty: ['SQL 专项正在上线，稍后再来。', 'The SQL track is being published. Check back soon.'],
      }}
    />
  );
}
