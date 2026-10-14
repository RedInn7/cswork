'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { RatingBadge } from './rating-badge';
import { api } from '@/lib/types';
import { contestName } from '@/lib/lc-rating';
import { englishMessage } from '@/lib/messages-en';

export type ContestProblem = {
  id: string;
  number: number;
  titleZh: string;
  titleEn: string;
  difficulty: string;
  caseStatus: string;
  judgeProblemId: string | null;
  rating: number;
  q: number;
  solved: boolean;
  progressStatus: 'solved' | 'attempted' | 'not_started';
};
type Page = {
  contests: { code: string; problems: ContestProblem[] }[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * The bank by weekly / biweekly contest (GET oj/library?view=contests), newest first:
 * one row per contest, Q1–Q4 across, each cell with its rating and this round's progress.
 * Only problems in the bank appear; a gap is a problem the bank does not have.
 */
export function ContestGrid({
  english,
  onOpen,
}: {
  english: boolean;
  onOpen: (problem: ContestProblem) => void;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api<Page>(`oj/library?${new URLSearchParams({ view: 'contests', page: String(page) })}`).then(
      (result) => {
        if (current) {
          setData(result);
          setError('');
        }
      },
      (reason: Error) => {
        if (current) setError(reason.message);
      },
    );
    return () => {
      current = false;
    };
  }, [page]);
  if (error)
    return (
      <div className="study-state" role="alert">
        <p>{t(error, englishMessage(error))}</p>
      </div>
    );
  if (!data) return <output className="study-state">{t('正在加载周赛…', 'Loading contests…')}</output>;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <>
      <p className="study-result-summary">
        {t(
          `${data.total} 场周赛 · 难度分来自 zerotrac/leetcode_problem_rating（MIT）`,
          `${data.total} contests · ratings from zerotrac/leetcode_problem_rating (MIT)`,
        )}
      </p>
      <div className="contest-grid" role="table" aria-label={t('按周赛浏览', 'Problems by contest')}>
        <div className="contest-head" role="row">
          <span role="columnheader">{t('场次', 'CONTEST')}</span>
          {[1, 2, 3, 4].map((q) => (
            <span role="columnheader" key={q}>
              Q{q}
            </span>
          ))}
        </div>
        {data.contests.map((contest) => (
          <div className="contest-row" role="row" key={contest.code}>
            <span className="contest-name" role="rowheader" data-kind={contest.code[0]}>
              {contestName(contest.code, !english)}
            </span>
            {[1, 2, 3, 4].map((q) => {
              // ponytail: Q1–Q4 only; weekly 68's lone Q5 stays off the grid.
              const problem = contest.problems.find((p) => p.q === q);
              if (!problem) return <span className="contest-empty" role="cell" key={q} />;
              const name = (english ? problem.titleEn : problem.titleZh) || problem.titleEn || problem.titleZh;
              return (
                <span role="cell" key={q}>
                  <button
                    type="button"
                    className="contest-cell"
                    data-progress={problem.progressStatus}
                    title={`Q${q} · ${problem.number}. ${name}`}
                    onClick={() => onOpen(problem)}
                  >
                    <strong>
                      {problem.number}. {name}
                    </strong>
                    <span className="contest-cell-meta">
                      <RatingBadge rating={problem.rating} english={english} />
                      {problem.solved ? (
                        <>
                          <Check size={14} aria-hidden="true" />
                          {t('已通过', 'Solved')}
                        </>
                      ) : problem.progressStatus === 'attempted' ? (
                        t('未通过', 'Not solved')
                      ) : problem.judgeProblemId ? (
                        ''
                      ) : (
                        t('暂不可判', 'Not judged here')
                      )}
                    </span>
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <nav className="study-pagination" aria-label={t('周赛分页', 'Contest pages')}>
        <Button variant="outline" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
          <ChevronLeft size={16} />
          {t('更新的', 'Newer')}
        </Button>
        <span>{t(`第 ${data.page} / ${pages} 页`, `Page ${data.page} of ${pages}`)}</span>
        <Button variant="outline" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
          {t('更早的', 'Older')}
          <ChevronRight size={16} />
        </Button>
      </nav>
    </>
  );
}
