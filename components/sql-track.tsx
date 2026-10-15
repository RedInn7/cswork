'use client';

import '@/app/classic-list.css';
import { Check } from 'lucide-react';
import { Button } from './ui/button';
import { useLocale } from '@/lib/i18n';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import sqlTrack from '@/lib/content/sql-track.json';
import type { Navigate } from './learning';

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
}: TrackProps & {
  /** The ?library= key, remembered for the workspace's next-problem button. */
  library: string;
  track: {
    groups: { key: string; zh: string; en: string; ids: string[] }[];
    problems: { id: string; titleZh: string; titleEn: string; difficulty: string }[];
  };
  copy: { kicker: Copy; title: Copy; lead: Copy; progress: Copy; empty: Copy };
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
    .map((group) => ({ ...group, ids: group.ids.filter((id) => available.has(id)) }))
    .filter((group) => group.ids.length);
  const sequence = groups.flatMap((group) => group.ids);
  const done = sequence.filter((id) => solved.has(id)).length;
  const next = signedIn ? sequence.find((id) => !solved.has(id)) : undefined;
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
                  ? `${group.ids.filter((id) => solved.has(id)).length}/${group.ids.length}`
                  : group.ids.length}
              </span>
            </h2>
            <div className="study-list">
              {group.ids.map((id) => {
                const item = problems.get(id)!;
                const level = levelOf(item.difficulty);
                const isSolved = signedIn && solved.has(id);
                return (
                  <a
                    key={id}
                    className="study-row"
                    href={problemAppHref(id)}
                    data-next={id === next || undefined}
                    onClick={(event) => open(event, id)}
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
                        {id === next && <span className="route-next-pill">{t('下一题', 'Next')}</span>}
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

/** The SQL track (?view=problems&library=sql): CSWork's own SQL problems, judged on SQLite. */
export function SqlTrack(props: TrackProps) {
  return (
    <ProblemTrack
      {...props}
      library="sql"
      track={sqlTrack}
      copy={{
        kicker: ['SQL 专项 · SQLite 方言', 'SQL track · SQLite dialect'],
        title: ['SQL 专项练习', 'SQL Practice Track'],
        lead: [
          'CSWork 原创的 SQL 题：连接、分组与 HAVING、子查询、窗口函数、NULL、字符串和日期处理。提交一条 SELECT，判题器在 SQLite 内存数据库里对多组隐藏数据运行它并比较结果集；答错时可以逐行对比期望和实际结果。',
          'Original CSWork SQL problems: joins, GROUP BY and HAVING, subqueries, window functions, NULLs, strings and dates. Submit one SELECT; the judge runs it on several hidden datasets in an in-memory SQLite database and compares the result sets, and a wrong answer shows the expected and actual rows side by side.',
        ],
        progress: ['SQL 专项进度', 'SQL track progress'],
        empty: ['SQL 专项正在上线，稍后再来。', 'The SQL track is being published. Check back soon.'],
      }}
    />
  );
}
