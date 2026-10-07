'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import styles from './leetcode-sync-panel.module.css';
import type {
  LeetcodeSyncRun as Run,
  LeetcodeSyncState as History,
} from '@/lib/leetcode-sync-types';
const regionName = (region: 'cn' | 'us') =>
  region === 'cn' ? '力扣国区' : 'LeetCode 美区';
const statusName = {
  running: '同步中',
  complete: '同步完成',
  cancelled: '已停止，已导入记录保留',
  failed: '部分同步，请处理错误后继续',
  truncated: '已达到本次同步上限，记录已保留',
};

async function request<T>(
  data?: unknown,
  signal?: AbortSignal,
  page = 1,
): Promise<T> {
  const response = await fetch(`/api/oj/leetcode-sync?page=${page}`, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    signal,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value?.error === 'string' ? value.error : '同步失败，请稍后重试',
    );
  return value as T;
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 1500);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export function LeetcodeSyncPanel({
  rounds,
  currentRoundId,
  onClose,
  onChanged,
}: {
  rounds: { id: string; number: number }[];
  currentRoundId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [region, setRegion] = useState<'cn' | 'us'>('cn');
  const [roundId, setRoundId] = useState(currentRoundId);
  const [session, setSession] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [run, setRun] = useState<Run | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [page, setPage] = useState(1);
  const controller = useRef<AbortController | null>(null);
  const activeRun = useRef<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const key = useRef<string | null>(null);
  const refresh = useRef(onChanged);
  refresh.current = onChanged;
  const clearCredentials = () => {
    setSession('');
    setCsrfToken('');
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function loadHistory(nextPage = 1) {
    setHistoryBusy(true);
    try {
      const result = await request<History>(undefined, undefined, nextPage);
      if (mounted.current) {
        setHistory(result);
        setPage(nextPage);
      }
    } catch {
      if (mounted.current) setError('同步记录暂时无法加载，请重试。');
    } finally {
      if (mounted.current) setHistoryBusy(false);
    }
  }
  useEffect(() => {
    void loadHistory();
  }, []);

  async function start(resume?: Run) {
    if (pending.current || !session.trim() || !csrfToken.trim()) return;
    pending.current = true;
    activeRun.current = resume?.id ?? null;
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    // Only this function's memory holds credentials during the paginated request.
    const credentials = {
      session: session.trim(),
      csrfToken: csrfToken.trim(),
    };
    clearCredentials();
    if (!key.current) key.current = crypto.randomUUID();
    try {
      let result = await request<{ run: Run }>(
        resume
          ? { action: 'continue', runId: resume.id, ...credentials }
          : {
              action: 'start',
              region,
              roundId,
              idempotencyKey: key.current,
              ...credentials,
            },
        abort.signal,
      );
      if (abort.signal.aborted) return;
      activeRun.current = result.run.id;
      setRun(result.run);
      key.current = null;
      while (result.run.status === 'running') {
        await pause(abort.signal);
        result = await request<{ run: Run }>(
          { action: 'continue', runId: result.run.id, ...credentials },
          abort.signal,
        );
        if (abort.signal.aborted) return;
        setRun(result.run);
      }
      if (result.run.error) setError(result.run.error);
    } catch (reason) {
      if (!abort.signal.aborted && mounted.current)
        setError(
          reason instanceof Error
            ? reason.message
            : '同步中断，请重新填写凭据后继续。',
        );
    } finally {
      credentials.session = '';
      credentials.csrfToken = '';
      pending.current = false;
      if (mounted.current) {
        setBusy(false);
        refresh.current();
        void loadHistory();
      }
    }
  }

  async function cancel() {
    controller.current?.abort();
    clearCredentials();
    setError('已停止请求，已同步记录会保留。');
    const id = activeRun.current;
    if (id) {
      try {
        const result = await request<{ run: Run }>({
          action: 'cancel',
          runId: id,
        });
        if (mounted.current) setRun(result.run);
      } catch {
        if (mounted.current)
          setError(
            '本地同步已停止，服务器状态未确认。重新打开可查看已保存记录。',
          );
      }
    }
  }
  const canSubmit = !busy && !!session.trim() && !!csrfToken.trim();
  const fixedRound = rounds.find(
    (item) => item.id === (run?.roundId || roundId),
  );
  return (
    <section className={styles.panel} aria-labelledby="leetcode-sync-title">
      <div className={styles.header}>
        <h3 id="leetcode-sync-title">同步 LeetCode</h3>
        <Button
          variant="ghost"
          onClick={() => {
            controller.current?.abort();
            clearCredentials();
            onClose();
          }}
        >
          关闭
        </Button>
      </div>
      <p>
        导入自己账号的历史成功提交，不导入代码。同步固定写入所选轮次，新开一轮仍从零开始。
      </p>
      <p className={styles.muted}>
        同步当前 LeetCode 登录会话可访问的记录；不会切换原站刷题会话。
      </p>
      <p className={styles.muted}>
        登录凭据等同账号登录权限，不要分享给他人。本站仅临时使用，不保存凭据，也不需要你的密码。
      </p>
      <details>
        <summary>如何获取自己的登录凭据？</summary>
        <ol>
          <li>在浏览器登录你自己的 leetcode.cn 或 leetcode.com 账号。</li>
          <li>
            打开浏览器开发者工具 → Application / 应用 → Cookies，选择对应站点。
          </li>
          <li>
            复制 LEETCODE_SESSION 和 csrftoken
            的值到下方。不要复制他人的凭据，也不要把整个 Cookie 列表分享出来。
          </li>
        </ol>
        <p>
          凭据失效后重新登录获取；遇到验证码或访问限制，请回原站处理，不会绕过原站限制。
        </p>
      </details>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
        autoComplete="off"
      >
        <div className={styles.fields}>
          <label>
            账号地区
            <select
              value={region}
              disabled={busy}
              onChange={(event) => {
                setRegion(event.target.value as 'cn' | 'us');
                key.current = null;
                clearCredentials();
              }}
            >
              <option value="cn">力扣国区 · leetcode.cn</option>
              <option value="us">LeetCode 美区 · leetcode.com</option>
            </select>
          </label>
          <label>
            导入到哪一轮
            <select
              value={roundId}
              disabled={busy}
              onChange={(event) => {
                setRoundId(event.target.value);
                key.current = null;
              }}
            >
              {rounds.map((item) => (
                <option key={item.id} value={item.id}>
                  第 {item.number} 轮
                  {item.id === currentRoundId ? '（当前）' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            LEETCODE_SESSION
            <input
              type="password"
              value={session}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setSession(event.target.value)}
              required
            />
          </label>
          <label>
            csrftoken
            <input
              type="password"
              value={csrfToken}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCsrfToken(event.target.value)}
              required
            />
          </label>
        </div>
        <div className={styles.actions}>
          <Button type="submit" disabled={!canSubmit}>
            {busy ? '正在读取提交记录…' : '开始同步'}
          </Button>
          {busy && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void cancel()}
            >
              停止同步
            </Button>
          )}
        </div>
      </form>
      {run && (
        <div className={styles.progress} role="status" aria-live="polite">
          <strong>{statusName[run.status]}</strong>
          <div>
            {regionName(run.region)} · {run.username} · 第{' '}
            {fixedRound?.number ?? '—'} 轮
          </div>
          <div>
            已扫描 {run.scanned} · 成功提交 {run.accepted} · 已匹配{' '}
            {run.matched} · 未匹配 {run.unmatched}
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <details>
        <summary>同步任务{history ? `（${history.runs.length}）` : ''}</summary>
        <ul className={styles.history}>
          {history?.runs.map((item) => (
            <li key={item.id}>
              {regionName(item.region)} · {item.username} ·{' '}
              {statusName[item.status]}
              <span className={styles.meta}>
                第 {rounds.find((r) => r.id === item.roundId)?.number ?? '—'} 轮
                · 已扫描 {item.scanned} · 匹配 {item.matched} · 未匹配{' '}
                {item.unmatched}
              </span>
              {['running', 'failed', 'cancelled'].includes(item.status) && (
                <Button
                  variant="outline"
                  disabled={!canSubmit}
                  onClick={() => {
                    setRegion(item.region);
                    setRoundId(item.roundId);
                    void start(item);
                  }}
                >
                  继续此任务
                </Button>
              )}
              {item.error && <span className={styles.meta}>{item.error}</span>}
            </li>
          ))}
        </ul>
        <p className={styles.muted}>
          继续任务前，填入该地区同一账号的新凭据；目标轮次不会改变。
        </p>
      </details>
      <details>
        <summary>已导入成功提交{history ? `（${history.total}）` : ''}</summary>
        <p className={styles.muted}>
          未匹配题目也保留记录，但不计入本站题单进度。
        </p>
        <ul className={styles.history}>
          {history?.records.map((item) => (
            <li key={item.id}>
              <a
                href={safeSource(item.sourceUrl, item.region)}
                target="_blank"
                rel="noreferrer"
              >
                {item.title || item.slug}
              </a>
              <span className={styles.meta}>
                {regionName(item.region)} · {item.language} ·{' '}
                {new Date(item.submittedAt).toLocaleString('zh-CN')} ·{' '}
                {item.matchedProblemId ? '已匹配' : '未匹配本站题目'}
              </span>
            </li>
          ))}
        </ul>
        {history?.total === 0 && <p>还没有同步记录。</p>}
        <div className={styles.actions}>
          <Button
            variant="outline"
            disabled={historyBusy || page <= 1}
            onClick={() => void loadHistory(page - 1)}
          >
            上一页
          </Button>
          <span>第 {page} 页</span>
          <Button
            variant="outline"
            disabled={historyBusy || !history?.hasMore}
            onClick={() => void loadHistory(page + 1)}
          >
            下一页
          </Button>
          <Button
            variant="ghost"
            disabled={historyBusy}
            onClick={() => void loadHistory(page)}
          >
            刷新记录
          </Button>
        </div>
      </details>
    </section>
  );
}

function safeSource(value: string, region: 'cn' | 'us') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === (region === 'cn' ? 'leetcode.cn' : 'leetcode.com')
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
