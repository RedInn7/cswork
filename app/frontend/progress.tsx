'use client';
import { useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { api } from '@/lib/types';
import { markTarget, readDone } from '@/lib/js-runner';

type Item = { slug: string; title: string; difficulty: 'easy' | 'medium' | 'hard' };
type Group = { key: string; title: string; items: Item[] };

/**
 * The /frontend problem list with each problem's state: passed in this browser, or marked done
 * on the account (content:fe-js/<slug>) for members.
 */
export function FrontendProblemList({ groups, signedIn }: { groups: Group[]; signedIn: boolean }) {
  const t = useT();
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- This browser's progress, after hydration.
    setDone(new Set(readDone()));
    if (!signedIn) return;
    let live = true;
    api<{ items: { target: string }[] }>('oj/marks?mark=done').then(
      ({ items }) => {
        if (!live) return;
        const prefix = markTarget('');
        const mine = items.filter((m) => m.target.startsWith(prefix)).map((m) => m.target.slice(prefix.length));
        setDone((current) => new Set([...current, ...mine]));
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [signedIn]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const solved = groups.reduce((n, g) => n + g.items.filter((item) => done.has(item.slug)).length, 0);
  const level = (d: Item['difficulty']) => ({ easy: t('简单', 'Easy'), medium: t('中等', 'Medium'), hard: t('困难', 'Hard') })[d];
  return (
    <div className="fejs-list">
      <p className="fejs-progress">
        <span>{t(`已完成 ${solved} / ${total}`, `${solved} / ${total} solved`)}</span>
        <span className="fejs-progress-bar" aria-hidden="true">
          <span style={{ width: `${total ? (solved / total) * 100 : 0}%` }} />
        </span>
      </p>
      {groups.map((group) => (
        <section key={group.key} className="fejs-group" aria-labelledby={`fejs-group-${group.key}`}>
          <h2 id={`fejs-group-${group.key}`}>
            <span>{group.title}</span>
            <small>{group.items.length}</small>
          </h2>
          <ol>
            {group.items.map((item) => (
              <li key={item.slug}>
                <a href={`/frontend/js/${item.slug}`}>
                  <span className="fejs-item-title">{item.title}</span>
                  <span className={`fejs-level fejs-level-${item.difficulty}`}>{level(item.difficulty)}</span>
                  {done.has(item.slug) ? (
                    <CircleCheck size={16} className="fejs-done" aria-label={t('已完成', 'Solved')} />
                  ) : (
                    <span className="fejs-todo" aria-hidden="true" />
                  )}
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
