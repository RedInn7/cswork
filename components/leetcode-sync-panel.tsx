'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from './ui/button';
import styles from './leetcode-sync-panel.module.css';
import { readLocale, useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import type {
  LeetcodeSyncRun as Run,
  LeetcodeSyncState as History,
} from '@/lib/leetcode-sync-types';

// Errors stay Chinese in state and pick their language at render;
// server ones go through englishMessage.
const messagesEn: Record<string, string> = {
  '同步失败，请稍后重试': 'Sync failed. Please try again later',
  '同步记录暂时无法加载，请重试。':
    "Couldn't load sync history. Please try again.",
  '同步中断，请重新填写凭据后继续。':
    'Sync was interrupted. Re-enter your credentials to resume.',
  '已停止请求，已同步记录会保留。':
    'Requests stopped. Synced records are kept.',
  '本地同步已停止，服务器状态未确认。重新打开可查看已保存记录。':
    'Sync stopped here, but the server status is unconfirmed. Reopen to see saved records.',
};
const messageEn = (message: string) =>
  Object.hasOwn(messagesEn, message)
    ? messagesEn[message]
    : englishMessage(message);

async function request<T>(
  data?: unknown,
  signal?: AbortSignal,
  page = 1,
): Promise<T> {
  const response = await fetch(`/api/oj/leetcode-sync?page=${page}`, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    signal,
    // Like api(): server errors come back in the site language.
    headers: {
      'X-Locale': readLocale(),
      ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
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
  const t = useT();
  const locale = useLocale();
  const regionName = (value: 'cn' | 'us') =>
    value === 'cn'
      ? t('力扣国区', 'LeetCode China')
      : t('LeetCode 美区', 'LeetCode US');
  const statusName = {
    running: t('同步中', 'Syncing'),
    complete: t('同步完成', 'Sync complete'),
    cancelled: t('已停止，已导入记录保留', 'Stopped; imported records kept'),
    failed: t(
      '部分同步，请处理错误后继续',
      'Partially synced. Fix the error, then resume',
    ),
    truncated: t(
      '已达到本次同步上限，记录已保留',
      "Reached this sync's limit; records kept",
    ),
  };
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
        <h3 id="leetcode-sync-title">{t('同步 LeetCode', 'Sync LeetCode')}</h3>
        <Button
          variant="ghost"
          onClick={() => {
            controller.current?.abort();
            clearCredentials();
            onClose();
          }}
        >
          {t('关闭', 'Close')}
        </Button>
      </div>
      <p>
        {t(
          '导入自己账号的历史成功提交，不导入代码。同步固定写入所选轮次，新开一轮仍从零开始。',
          'Imports past accepted submissions from your own account (code is not imported). Records go into the round you pick; a new round still starts from zero.',
        )}
      </p>
      <p className={styles.muted}>
        {t(
          '同步当前 LeetCode 登录会话可访问的记录；不会切换原站刷题会话。',
          'Syncs the records your current LeetCode sign-in can access. Your practice session on LeetCode is not switched.',
        )}
      </p>
      <p className={styles.muted}>
        {t(
          '登录凭据等同账号登录权限，不要分享给他人。本站仅临时使用，不保存凭据，也不需要你的密码。',
          'These credentials give full access to your account, so never share them. We use them only temporarily, never store them, and never need your password.',
        )}
      </p>
      <details>
        <summary>
          {t('如何获取自己的登录凭据？', 'How do I get my credentials?')}
        </summary>
        <ol>
          <li>
            {t(
              '在浏览器登录你自己的 leetcode.cn 或 leetcode.com 账号。',
              'Sign in to your own leetcode.cn or leetcode.com account in your browser.',
            )}
          </li>
          <li>
            {t(
              '打开浏览器开发者工具 → Application / 应用 → Cookies，选择对应站点。',
              "Open your browser's developer tools → Application → Cookies, and select the site.",
            )}
          </li>
          <li>
            {t(
              '复制 LEETCODE_SESSION 和 csrftoken 的值到下方。不要复制他人的凭据，也不要把整个 Cookie 列表分享出来。',
              "Paste the LEETCODE_SESSION and csrftoken values below. Don't use anyone else's credentials, and never share your whole cookie list.",
            )}
          </li>
        </ol>
        <p>
          {t(
            '凭据失效后重新登录获取；遇到验证码或访问限制，请回原站处理，不会绕过原站限制。',
            "If the credentials expire, sign in again to get new ones. If you hit a CAPTCHA or an access limit, resolve it on LeetCode; we don't bypass its limits.",
          )}
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
            {t('账号地区', 'Account region')}
            <select
              value={region}
              disabled={busy}
              onChange={(event) => {
                setRegion(event.target.value as 'cn' | 'us');
                key.current = null;
                clearCredentials();
              }}
            >
              <option value="cn">
                {t('力扣国区 · leetcode.cn', 'LeetCode China · leetcode.cn')}
              </option>
              <option value="us">
                {t(
                  'LeetCode 美区 · leetcode.com',
                  'LeetCode US · leetcode.com',
                )}
              </option>
            </select>
          </label>
          <label>
            {t('导入到哪一轮', 'Import into round')}
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
                  {t(`第 ${item.number} 轮`, `Round ${item.number}`)}
                  {item.id === currentRoundId
                    ? t('（当前）', ' (current)')
                    : ''}
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
            {busy
              ? t('正在读取提交记录…', 'Reading submissions…')
              : t('开始同步', 'Start sync')}
          </Button>
          {busy && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void cancel()}
            >
              {t('停止同步', 'Stop sync')}
            </Button>
          )}
        </div>
      </form>
      {run && (
        <div className={styles.progress} role="status" aria-live="polite">
          <strong>{statusName[run.status]}</strong>
          <div>
            {regionName(run.region)} · {run.username} ·{' '}
            {t(
              `第 ${fixedRound?.number ?? '—'} 轮`,
              `Round ${fixedRound?.number ?? '—'}`,
            )}
          </div>
          <div>
            {t(
              `已扫描 ${run.scanned} · 成功提交 ${run.accepted} · 已匹配 ${run.matched} · 未匹配 ${run.unmatched}`,
              `Scanned ${run.scanned} · Accepted ${run.accepted} · Matched ${run.matched} · Unmatched ${run.unmatched}`,
            )}
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {t(error, messageEn(error))}
        </p>
      )}
      <details>
        <summary>
          {t('同步任务', 'Sync jobs')}
          {history
            ? t(`（${history.runs.length}）`, ` (${history.runs.length})`)
            : ''}
        </summary>
        <ul className={styles.history}>
          {history?.runs.map((item) => {
            const round =
              rounds.find((r) => r.id === item.roundId)?.number ?? '—';
            return (
              <li key={item.id}>
                {regionName(item.region)} · {item.username} ·{' '}
                {statusName[item.status]}
                <span className={styles.meta}>
                  {t(
                    `第 ${round} 轮 · 已扫描 ${item.scanned} · 匹配 ${item.matched} · 未匹配 ${item.unmatched}`,
                    `Round ${round} · Scanned ${item.scanned} · Matched ${item.matched} · Unmatched ${item.unmatched}`,
                  )}
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
                    {t('继续此任务', 'Resume')}
                  </Button>
                )}
                {item.error && (
                  <span className={styles.meta}>
                    {t(item.error, messageEn(item.error))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className={styles.muted}>
          {t(
            '继续任务前，填入该地区同一账号的新凭据；目标轮次不会改变。',
            'To resume a job, enter fresh credentials for the same account in that region. The target round stays the same.',
          )}
        </p>
      </details>
      <details>
        <summary>
          {t('已导入成功提交', 'Imported accepted submissions')}
          {history ? t(`（${history.total}）`, ` (${history.total})`) : ''}
        </summary>
        <p className={styles.muted}>
          {t(
            '未匹配题目也保留记录，但不计入本站题单进度。',
            "Unmatched problems are kept too, but they don't count toward problem list progress here.",
          )}
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
                {new Date(item.submittedAt).toLocaleString(
                  locale === 'zh' ? 'zh-CN' : 'en-US',
                )}{' '}
                ·{' '}
                {item.matchedProblemId
                  ? t('已匹配', 'Matched')
                  : t('未匹配本站题目', 'No match on this site')}
              </span>
            </li>
          ))}
        </ul>
        {history?.total === 0 && (
          <p>{t('还没有同步记录。', 'No synced records yet.')}</p>
        )}
        <div className={styles.actions}>
          <Button
            variant="outline"
            disabled={historyBusy || page <= 1}
            onClick={() => void loadHistory(page - 1)}
          >
            {t('上一页', 'Previous')}
          </Button>
          <span>{t(`第 ${page} 页`, `Page ${page}`)}</span>
          <Button
            variant="outline"
            disabled={historyBusy || !history?.hasMore}
            onClick={() => void loadHistory(page + 1)}
          >
            {t('下一页', 'Next')}
          </Button>
          <Button
            variant="ghost"
            disabled={historyBusy}
            onClick={() => void loadHistory(page)}
          >
            {t('刷新记录', 'Refresh')}
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
