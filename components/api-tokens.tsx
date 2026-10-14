'use client';
import { useEffect, useId, useState } from 'react';
import { Copy, PlugZap } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale, useT } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { Button } from './ui/button';
import { Input } from './ui/input';
import '@/app/api-tokens.css';

type Token = { id: string; name: string; createdAt: number; lastUsedAt: number | null };

/** Account settings: personal access tokens for the MCP server (/mcp). The token shows once. */
export function ApiTokenSettings() {
  const t = useT();
  const locale = useLocale();
  const id = useId();
  const [items, setItems] = useState<Token[] | null>(null);
  const [name, setName] = useState('');
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<{ items: Token[] }>('oj/tokens').then(
      ({ items }) => live && setItems(items),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  const date = (at: number) =>
    new Date(at).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' });
  const run = (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    work()
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <section className="form-card commerce-account-card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        <PlugZap size={19} />
        {t('在 AI 编辑器里练题（MCP）', 'Practice from your AI editor (MCP)')}
      </h2>
      <p className="muted">
        {t(
          '访问令牌让 Claude Code、Cursor 等 MCP 客户端替你读题、运行和提交代码、查看结果；不能读笔记、改账号或管理令牌。',
          'An access token lets Claude Code, Cursor and other MCP clients read problems, run and submit code and see results for you. It cannot read your notes, change your account or manage tokens.',
        )}{' '}
        <a href="/mcp" className="underline underline-offset-4">
          {t('配置说明', 'Setup guide')}
        </a>
      </p>
      <form
        className="pat-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const created = await api<{ token: string; item: Token }>('oj/tokens', {
              name: name.trim(),
            });
            setFresh({ token: created.token, name: created.item.name });
            setCopied(false);
            setItems((list) => [created.item, ...(list ?? [])]);
            setName('');
          });
        }}
      >
        <label htmlFor={`${id}-name`}>{t('令牌名称', 'Token name')}</label>
        <div className="pat-create">
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('例如：笔记本上的 Claude Code', 'e.g. Claude Code on my laptop')}
            required
            maxLength={60}
            autoComplete="off"
          />
          <Button variant="outline" disabled={busy || !name.trim()}>
            {t('生成令牌', 'Create token')}
          </Button>
        </div>
      </form>
      {fresh && (
        <div className="pat-fresh">
          <output>
            <strong>{fresh.name}</strong>
            {t(
              '：令牌只显示这一次，请现在复制到 MCP 客户端的 CSWORK_TOKEN。',
              ': this token is shown only once. Copy it into your MCP client as CSWORK_TOKEN now.',
            )}
          </output>
          <div className="pat-secret">
            <input
              readOnly
              value={fresh.token}
              aria-label={t('新令牌', 'New token')}
              onFocus={(e) => e.currentTarget.select()}
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void navigator.clipboard?.writeText(fresh.token).then(
                  () => setCopied(true),
                  () => {},
                )
              }
            >
              <Copy size={14} aria-hidden="true" />
              {copied ? t('已复制', 'Copied') : t('复制', 'Copy')}
            </Button>
          </div>
        </div>
      )}
      {items && (
        <ul className="pat-list" aria-label={t('有效的令牌', 'Active tokens')}>
          {!items.length && <li className="muted">{t('还没有令牌。', 'No tokens yet.')}</li>}
          {items.map((item) => (
            <li key={item.id} className="service-row">
              <span>
                <b>{item.name}</b>
                <small>
                  {t('创建于 ', 'Created ')}
                  {date(item.createdAt)}
                  {' · '}
                  {item.lastUsedAt
                    ? `${t('最近使用 ', 'Last used ')}${date(item.lastUsedAt)}`
                    : t('从未使用', 'Never used')}
                </small>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                aria-label={`${t('吊销', 'Revoke')} ${item.name}`}
                onClick={() => {
                  if (
                    !window.confirm(
                      t(
                        `吊销「${item.name}」？用它的客户端会立刻失去访问权限。`,
                        `Revoke "${item.name}"? Clients using it lose access right away.`,
                      ),
                    )
                  )
                    return;
                  run(async () => {
                    await api(`oj/tokens/${encodeURIComponent(item.id)}/revoke`, {});
                    setItems((list) => (list ?? []).filter((x) => x.id !== item.id));
                  });
                }}
              >
                {t('吊销', 'Revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="notice error">
          {t(error, englishMessage(error))}
        </p>
      )}
    </section>
  );
}
