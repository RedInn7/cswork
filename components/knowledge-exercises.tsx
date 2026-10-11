'use client';
import { useEffect, useState } from 'react';
import { Check, Circle, Clock3, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/types';
import { useT } from '@/lib/i18n';
import type { Navigate } from './learning';

type Progress = {
  lessonId: string;
  currentRound: { id: string | null; number: number };
  completed: number;
  importedCompleted?: number;
  total: number;
  items: {
    id: string;
    number: number;
    title: string;
    difficulty: string;
    hint: string;
    available: boolean;
    judging: boolean;
    importedSources?: ('cn' | 'us')[];
    status: 'solved' | 'attempted' | 'not_started';
  }[];
};
export function KnowledgeExercises({
  lessonId,
  navigate,
  userId,
}: {
  lessonId: string;
  navigate: Navigate;
  userId?: string;
}) {
  const t = useT();
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setData(null);
    setError(false);
    if (!userId) return;
    let disposed = false,
      request = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      const sequence = ++request;
      clearTimeout(timer);
      try {
        const result = await api<Progress>(
          `knowledge/progress?lesson=${encodeURIComponent(lessonId)}`,
        );
        if (disposed || sequence !== request) return;
        setData(result);
        setError(false);
        if (
          result.items.some((item) => item.judging) &&
          document.visibilityState === 'visible'
        )
          timer = setTimeout(refresh, 2500);
      } catch {
        if (!disposed && sequence === request) setError(true);
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
      else clearTimeout(timer);
    };
    void refresh();
    window.addEventListener('cswork:practice-progress-changed', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener('cswork:practice-progress-changed', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [lessonId, userId, retry]);
  return (
    <section
      className="knowledge-exercises"
      aria-labelledby="knowledge-exercises-heading"
    >
      <div className="knowledge-exercises-heading">
        <h2 id="knowledge-exercises-heading">
          {t('例题与课后练习', 'Examples and practice')}
        </h2>
        {data && !error && (
          <span>
            {t('第', 'Round')} {data.currentRound.number}{' '}
            {t('轮 · 本站已通过', '· Solved here')} {data.completed} /{' '}
            {data.total}
            {!!data.importedCompleted &&
              t(
                ` · LeetCode 导入 ${data.importedCompleted}`,
                ` · ${data.importedCompleted} imported from LeetCode`,
              )}
          </span>
        )}
      </div>
      {!userId ? (
        <p>
          {t(
            '登录后可以练习，并查看本轮完成情况。',
            'Sign in to practice and see your progress in this round.',
          )}
        </p>
      ) : error ? (
        <p role="alert">
          {t('暂时无法获取完成情况。', "Couldn't load your progress. ")}
          <button onClick={() => setRetry((value) => value + 1)}>
            {t('重新加载', 'Reload')}
          </button>
        </p>
      ) : !data ? (
        <p role="status">{t('正在读取练习进度…', 'Loading practice progress…')}</p>
      ) : (
        <ul>
          {data.items.map((item) => {
            const label =
              item.status === 'solved'
                ? t('已通过', 'Solved')
                : item.judging
                  ? t('判题中', 'Judging')
                  : item.status === 'attempted'
                    ? t('尝试过，未通过', 'Attempted, not solved')
                    : t('未开始', 'Not started');
            const Icon =
              item.status === 'solved'
                ? Check
                : item.status === 'attempted'
                  ? Clock3
                  : Circle;
            return (
              <li key={item.id} className={`knowledge-exercise ${item.status}`}>
                <div className="knowledge-exercise-top">
                  <Icon size={18} aria-hidden="true" />
                  <a
                    href={
                      item.available
                        ? `?view=problem&problem=${encodeURIComponent(item.id)}`
                        : undefined
                    }
                    aria-disabled={!item.available}
                    onClick={(event) => {
                      if (
                        event.metaKey ||
                        event.ctrlKey ||
                        event.shiftKey ||
                        event.altKey
                      )
                        return;
                      event.preventDefault();
                      if (item.available)
                        navigate('problem', { problem: item.id });
                    }}
                  >
                    {item.number}. {item.title}
                  </a>
                  <span className="knowledge-exercise-difficulty">
                    {t(
                      (
                        { Easy: '简单', Medium: '中等', Hard: '困难' } as Record<
                          string,
                          string
                        >
                      )[item.difficulty] ?? item.difficulty,
                      item.difficulty,
                    )}
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </div>
                {item.hint && <p>{item.hint}</p>}
                <span className="knowledge-exercise-status">
                  {label}
                  {!!item.importedSources?.length &&
                    t(
                      ` · LeetCode ${item.importedSources.map((region) => (region === 'cn' ? '国区' : '美区')).join(' / ')}已通过`,
                      ` · Solved on LeetCode ${item.importedSources.map((region) => (region === 'cn' ? 'CN' : 'US')).join(' / ')}`,
                    )}
                  {!item.available ? t(' · 暂未开放', ' · Not available yet') : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
