'use client';

import '@/app/classic-list.css';
import { Check, Database } from 'lucide-react';
import { Button } from './ui/button';
import { useLocale } from '@/lib/i18n';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { levelOf, problemAppHref } from '@/lib/classic-lists';
import track from '@/lib/content/sql-track.json';
import type { Navigate } from './learning';

/**
 * The SQL track (?view=problems&library=sql): CSWork's own SQL problems,
 * grouped by topic and judged on SQLite. The list is static (built with the
 * packages by scripts/sql-track/build.ts); a row shows once its problem is
 * published. Solved marks come from the bootstrap's accepted-submission days.
 */
export function SqlTrack({
  navigate,
  availableProblemIds,
  activity,
  signedIn,
}: {
  navigate: Navigate;
  availableProblemIds: string[];
  activity: { problem_id: string }[];
  signedIn: boolean;
}) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const available = new Set(availableProblemIds);
  // ponytail: the bootstrap's ~26 weeks of accepted runs; older solves show as unsolved.
  const solved = new Set(activity.map((item) => item.problem_id));
  const problems = new Map(track.problems.map((item) => [item.id, item]));
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
    rememberProblemSequence(sequence, 'sql');
    navigate('problem', { problem: id });
  };

  return (
    <section className="study-library study-bank classic-list" lang={english ? 'en' : 'zh'}>
      <div className="classic-board">
        <p className="classic-kicker">
          <Database size={13} aria-hidden="true" /> {t('SQL 专项 · SQLite 方言', 'SQL track · SQLite dialect')}
        </p>
        <h1>{t('SQL 专项练习', 'SQL Practice Track')}</h1>
        <p className="classic-lead">
          {t(
            'CSWork 原创的 SQL 题：连接、分组与 HAVING、子查询、窗口函数、NULL 和日期处理。提交一条 SELECT，判题器在 SQLite 内存数据库里对多组隐藏数据运行它并比较结果集。',
            'Original CSWork SQL problems: joins, GROUP BY and HAVING, subqueries, window functions, NULLs and dates. Submit one SELECT; the judge runs it on several hidden datasets in an in-memory SQLite database and compares the result sets.',
          )}
        </p>
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
                aria-label={t('SQL 专项进度', 'SQL track progress')}
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
        <output className="study-state">
          {t('SQL 专项正在上线，稍后再来。', 'The SQL track is being published. Check back soon.')}
        </output>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="classic-group" aria-labelledby={`sql-group-${group.key}`}>
            <h2 className="route-heading" id={`sql-group-${group.key}`}>
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
                        <span className="study-number">{Number(id.slice(4))}.</span>{' '}
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
