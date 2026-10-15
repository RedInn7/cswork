'use client';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Ban, Mail } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { DM_RETENTION_DAYS, threadPath } from '@/lib/community';
import type { Navigate } from './learning';
import { ChatCompose, ChatLog, Report, useChat, type ChatItem } from './chat-log';
import '@/app/learner-cloud.css';
import '@/app/chat.css';

type T = (zh: string, en: string) => string;
type Open = 'all' | 'follows' | 'none';
type Inbox = {
  open: Open;
  items: { key: string; name: string; at: number; last: string; lastMine: boolean; unread: number; blocked: boolean }[];
};
type Conversation = {
  key: string;
  name: string;
  blocked: boolean;
  canSend: boolean;
  post: { id: string; title: string } | null;
  items: ChatItem[];
};
const plain = (e: React.MouseEvent) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
function ErrorLine({ error, t }: { error: string; t: T }) {
  return error ? (
    <p className="cloud-error" role="alert">
      {t(error, englishMessage(error))}
    </p>
  ) : null;
}

/**
 * ?view=messages: direct messages. The inbox, one conversation (&thread=<key>), or a first
 * message: &to=<handle> between mutual follows, &post=<id> to ask a referral thread's author.
 */
export function Messages({ params, navigate }: { params: Record<string, string>; navigate: Navigate }) {
  const english = useLocale() === 'en';
  const t: T = (zh, en) => (english ? en : zh);
  const inbox = (
    <a
      className="dm-back"
      href="/?view=messages"
      onClick={(e) => {
        if (!plain(e)) return;
        e.preventDefault();
        navigate('messages');
      }}
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {t('全部私信', 'All messages')}
    </a>
  );
  return (
    <section className="study-library algorithm-library cloud-lists dm-page" lang={english ? 'en' : 'zh'}>
      <header className="cloud-board">
        <p className="route-kicker">{t('社区 · 私信', 'Community · Messages')}</p>
        <h1>{t('私信', 'Messages')}</h1>
        <p>
          {t(
            `互相关注的人之间，或者从内推帖请求内推时，才能开始对话。消息保留 ${DM_RETENTION_DAYS} 天；新消息只在站内提醒，提醒里不含正文。`,
            `Conversations start between people who follow each other, or from a referral thread. Messages are kept ${DM_RETENTION_DAYS} days; new ones are flagged on the site only, never with their text.`,
          )}
        </p>
      </header>
      {params.thread ? (
        <Thread key={params.thread} threadKey={params.thread} back={inbox} t={t} english={english} />
      ) : params.to || params.post ? (
        <FirstMessage to={params.to} post={params.post} back={inbox} navigate={navigate} t={t} english={english} />
      ) : (
        <InboxList navigate={navigate} t={t} english={english} />
      )}
    </section>
  );
}

function InboxList({ navigate, t, english }: { navigate: Navigate; t: T; english: boolean }) {
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<Inbox>('oj/dm').then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  async function setOpen(open: Open) {
    setError('');
    try {
      setData(await api<Inbox>('oj/dm/settings', { open }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      {data && (
        <label className="dm-open">
          <span>{t('谁可以给我发起新对话', 'Who can start a conversation with me')}</span>
          <select value={data.open} onChange={(e) => void setOpen(e.target.value as Open)}>
            <option value="all">{t('互相关注的人，以及内推请求', 'People I follow back, and referral requests')}</option>
            <option value="follows">{t('只有互相关注的人', 'Only people I follow back')}</option>
            <option value="none">{t('谁都不行', 'Nobody')}</option>
          </select>
        </label>
      )}
      <ErrorLine error={error} t={t} />
      {!data ? (
        !error && <output className="study-state">{t('正在加载…', 'Loading…')}</output>
      ) : data.items.length ? (
        <ul className="study-list progress-list cloud-list-rows dm-inbox">
          {data.items.map((c) => (
            <li key={c.key}>
              <a
                className="study-row progress-row"
                href={`/?view=messages&thread=${c.key}`}
                data-unread={c.unread > 0 || undefined}
                onClick={(e) => {
                  if (!plain(e)) return;
                  e.preventDefault();
                  navigate('messages', { thread: c.key });
                }}
              >
                <span className="cloud-vis" data-public={c.unread > 0 || undefined}>
                  {c.blocked ? <Ban size={16} aria-hidden="true" /> : <Mail size={16} aria-hidden="true" />}
                </span>
                <span className="study-row-main">
                  <strong>
                    {c.name}
                    {c.unread > 0 && (
                      <span className="dm-unread">{t(`${c.unread} 条未读`, `${c.unread} unread`)}</span>
                    )}
                    {c.blocked && <span className="dm-unread" data-blocked>{t('已屏蔽', 'Blocked')}</span>}
                  </strong>
                  <span className="study-row-secondary">
                    {c.lastMine && t('我：', 'You: ')}
                    {c.last}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="study-state">
          {t(
            '还没有私信。在互相关注的人的主页上，或者讨论区的内推帖里，都可以发起对话。',
            'No messages yet. Start one from the profile of someone you follow back, or from a referral thread on the discussion board.',
          )}
        </p>
      )}
    </>
  );
}

function Thread({ threadKey, back, t, english }: { threadKey: string; back: React.ReactNode; t: T; english: boolean }) {
  const path = `oj/dm/${encodeURIComponent(threadKey)}`;
  const chat = useChat<Conversation>(path);
  const act = async (action: string, body: unknown) => {
    try {
      chat.show(await api<Conversation>(`${path}${action}`, body));
      return true;
    } catch (e) {
      chat.setError((e as Error).message);
      return false;
    }
  };
  const c = chat.data;
  return (
    <>
      {back}
      <ErrorLine error={chat.error} t={t} />
      {!c ? (
        !chat.error && <output className="study-state">{t('正在加载…', 'Loading…')}</output>
      ) : (
        <section className="dm-panel" aria-labelledby="dm-with">
          <header className="dm-head">
            <h2 id="dm-with">{c.name}</h2>
            <button type="button" onClick={() => void act('/block', { on: !c.blocked })}>
              <Ban size={14} aria-hidden="true" />
              {c.blocked ? t('解除屏蔽', 'Unblock') : t('屏蔽', 'Block')}
            </button>
          </header>
          {c.post && (
            <p className="dm-post">
              {t('来自内推帖：', 'From the referral thread: ')}
              <a href={threadPath(c.post.id)}>{c.post.title}</a>
            </p>
          )}
          <ChatLog
            items={c.items}
            label={t(`和 ${c.name} 的对话`, `Conversation with ${c.name}`)}
            english={english}
            fresh={chat.fresh}
            actions={(m) => !m.mine && <Report path={`${path}/report`} body={{ message: m.id }} english={english} />}
          />
          {!c.canSend && (
            <p className="dm-note">
              {c.blocked
                ? t('你屏蔽了对方：双方都不能再发消息，解除屏蔽后可以继续。', 'You blocked them: neither of you can write until you unblock.')
                : t('对方暂不接收你的私信。', "They aren't taking messages from you.")}
            </p>
          )}
          <ChatCompose
            label={t(`发消息给 ${c.name}`, `Message ${c.name}`)}
            english={english}
            disabled={!c.canSend}
            send={(body) => act('', { body })}
          />
        </section>
      )}
    </>
  );
}

function FirstMessage({
  to,
  post,
  back,
  navigate,
  t,
  english,
}: {
  to?: string;
  post?: string;
  back: React.ReactNode;
  navigate: Navigate;
  t: T;
  english: boolean;
}) {
  const [error, setError] = useState('');
  return (
    <>
      {back}
      <section className="dm-panel" aria-labelledby="dm-first">
        <h2 id="dm-first">{post ? t('请求内推', 'Request a referral') : t(`发私信给 @${to}`, `Message @${to}`)}</h2>
        <p className="dm-note">
          {post
            ? t(
                '对方是这家公司已验证的员工。说说你是谁、想投哪个岗位，附上简历链接；不要发密码、证件号这类信息。',
                'They are a verified employee there. Say who you are and which role you want, with a link to your résumé; never send passwords or ID numbers.',
              )
            : t('你们互相关注，可以直接聊。', 'You follow each other, so you can talk directly.')}
        </p>
        <ErrorLine error={error} t={t} />
        <ChatCompose
          label={post ? t('内推请求', 'Referral request') : t('私信内容', 'Message')}
          english={english}
          send={async (body) => {
            setError('');
            try {
              const c = await api<Conversation>('oj/dm', post ? { post, body } : { to, body });
              navigate('messages', { thread: c.key });
              return true;
            } catch (e) {
              setError((e as Error).message);
              return false;
            }
          }}
        />
      </section>
    </>
  );
}
