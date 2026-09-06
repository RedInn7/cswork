'use client';
import { useEffect, useState } from 'react';
import { Check, Circle, Clock3, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/types';
import type { Navigate } from './learning';

type Progress = {
  lessonId: string;
  currentRound: { id: string | null; number: number };
  completed: number;
  total: number;
  items: {
    id: string;
    number: number;
    title: string;
    difficulty: string;
    hint: string;
    available: boolean;
    judging: boolean;
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
        <h2 id="knowledge-exercises-heading">例题与课后练习</h2>
        {data && !error && (
          <span>
            第 {data.currentRound.number} 轮 · 已通过 {data.completed} /{' '}
            {data.total}
          </span>
        )}
      </div>
      {!userId ? (
        <p>登录后可以练习，并查看本轮完成情况。</p>
      ) : error ? (
        <p role="alert">
          暂时无法获取完成情况。
          <button onClick={() => setRetry((value) => value + 1)}>
            重新加载
          </button>
        </p>
      ) : !data ? (
        <p role="status">正在读取练习进度…</p>
      ) : (
        <ul>
          {data.items.map((item) => {
            const label =
              item.status === 'solved'
                ? '已通过'
                : item.judging
                  ? '判题中'
                  : item.status === 'attempted'
                    ? '尝试过，未通过'
                    : '未开始';
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
                    {(
                      { Easy: '简单', Medium: '中等', Hard: '困难' } as Record<
                        string,
                        string
                      >
                    )[item.difficulty] ?? item.difficulty}
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </div>
                {item.hint && <p>{item.hint}</p>}
                <span className="knowledge-exercise-status">
                  {label}
                  {!item.available ? ' · 暂未开放' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
