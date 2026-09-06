'use client';
import { useState } from 'react';
import { api, type Notification, date } from '@/lib/types';
import type { Navigate } from './learning';
import { Button } from './ui/button';
import { CursorPagination, useCursorPage } from './lms-shared';
export function NotificationsPane({
  refresh,
  navigate,
  close,
}: {
  refresh: () => Promise<void>;
  navigate: Navigate;
  close: () => void;
}) {
  const list = useCursorPage<Notification>('lms/notifications'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <div className="lms-toolbar">
        <Button variant="outline" disabled={busy} onClick={list.refresh}>
          刷新消息
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !list.data?.total}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await api('lms/notifications/read-all', {});
              list.refresh();
              await refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          全部标记已读
        </Button>
      </div>
      {(error || list.error) && (
        <p role="alert" className="error-text">
          {error || list.error}{' '}
          <Button variant="ghost" onClick={list.refresh}>
            重试
          </Button>
        </p>
      )}
      {list.busy && <output>正在加载消息…</output>}
      <div className="search-results">
        {list.data?.items.map((item) => (
          <button
            key={item.id}
            onClick={async () => {
              const dest = Object.fromEntries(
                new URL(item.href, location.origin).searchParams,
              );
              void api('notifications', { id: item.id })
                .then(refresh)
                .catch(() => {});
              close();
              const { view, ...params } = dest;
              navigate(view || 'home', params);
            }}
          >
            <strong>
              {!item.read_at && <span className="status-dot" />}
              {item.title}
            </strong>
            <p>{item.body}</p>
            <small>{date(item.created_at)}</small>
          </button>
        ))}
      </div>
      {list.data && !list.data.items.length && (
        <p className="quiet-empty">暂时没有新消息。</p>
      )}
      <CursorPagination list={list} />
    </>
  );
}
