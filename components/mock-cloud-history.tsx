'use client';
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { MockSession } from '@/lib/mock-oa';
import { syncMockHistory } from '@/lib/mock-cloud';
import type { Navigate } from './learning';
import '@/app/learner-cloud.css';

const SHOWN = 5;
const plain = (e: React.MouseEvent) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** My progress: the account's latest finished mock OAs, from any device. Nothing until there is one. */
export function MockCloudHistory({
  userId,
  navigate,
  english,
}: {
  userId: string;
  navigate: Navigate;
  english: boolean;
}) {
  const t = (zh: string, en: string) => (english ? en : zh);
  const [items, setItems] = useState<MockSession[]>([]);
  useEffect(() => {
    let live = true;
    // Also pulls them into this browser, so a report opens here without a refetch.
    void syncMockHistory(userId).then((merged) => {
      if (live && merged) setItems(merged.history.filter((s) => s.finishedAt));
    });
    return () => {
      live = false;
    };
  }, [userId]);
  if (!items.length) return null;
  const best = items.reduce<MockSession | null>(
    (top, s) =>
      s.result && (!top?.result || s.result.score / s.result.max > top.result.score / top.result.max) ? s : top,
    null,
  );
  return (
    <section className="cloud-mocks" aria-labelledby="cloud-mocks-title">
      <div className="cloud-head">
        <h2 id="cloud-mocks-title">{t('模拟 OA 成绩', 'Mock OA results')}</h2>
        <p>
          {t(`共 ${items.length} 场，跟随账号同步`, `${items.length} taken, synced to your account`)}
          {best?.result && (
            <>
              {' · '}
              {t('最好', 'Best')} <b>{best.result.score}</b>/{best.result.max}
            </>
          )}
        </p>
        <a
          href="/?view=mock"
          onClick={(e) => {
            if (!plain(e)) return;
            e.preventDefault();
            navigate('mock');
          }}
        >
          {t('全部模拟', 'All mocks')} <ArrowRight size={14} aria-hidden="true" />
        </a>
      </div>
      <ol className="cloud-mock-list">
        {items.slice(0, SHOWN).map((s) => (
          <li key={s.id}>
            <a
              href={`/?view=mock&report=${encodeURIComponent(s.id)}`}
              onClick={(e) => {
                if (!plain(e)) return;
                e.preventDefault();
                navigate('mock', { report: s.id });
              }}
            >
              <span className="cloud-mock-name">
                <strong>{s.name || t('自定义模拟', 'Custom mock')}</strong>
                <small>
                  {new Date(s.startedAt ?? s.createdAt).toLocaleDateString(english ? 'en-US' : 'zh-CN', {
                    month: 'short',
                    day: 'numeric',
                  })}
                  {' · '}
                  {t(`${s.ids.length} 题 · ${s.minutes} 分钟`, `${s.ids.length} Q · ${s.minutes} min`)}
                </small>
              </span>
              <span className="cloud-mock-score">
                {s.result ? (
                  <>
                    <b>{s.result.score}</b>/{s.result.max}
                    <small>
                      {t(`通过 ${s.result.solved}/${s.ids.length}`, `${s.result.solved}/${s.ids.length} solved`)}
                    </small>
                  </>
                ) : (
                  <small>{t('查看成绩', 'See score')}</small>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
