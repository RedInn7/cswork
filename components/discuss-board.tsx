'use client';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useLocale } from '@/lib/i18n';
import { CHANNELS, discussTarget, isChannel, type Channel } from '@/lib/community';
import type { Navigate } from './learning';
import { SolutionPosts, threadCompanies } from './solution-posts';
import '@/app/learner-cloud.css';
import '@/app/discuss.css';

/**
 * ?view=discuss: the discussion board. One channel at a time (&channel=), optionally one
 * company's threads (&company=), &q= starts a search, &post= opens a thread (links from its
 * public page). Reading works signed out; posting, replying and voting ask to sign in.
 */
export function DiscussBoard({
  params,
  navigate,
  signedIn,
}: {
  params: Record<string, string>;
  navigate: Navigate;
  signedIn: boolean;
}) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const channel: Channel = isChannel(params.channel) ? params.channel : 'interview';
  const raw = params.company ?? '';
  const company = /^[a-z0-9-]{1,80}$/.test(raw) ? raw : '';
  const [companies, setCompanies] = useState<{ slug: string; name: string }[]>([]);
  useEffect(() => {
    let live = true;
    void threadCompanies().then((c) => live && setCompanies(c));
    return () => {
      live = false;
    };
  }, []);
  const go = (next: { channel?: string; company?: string }) => {
    const merged: Record<string, string> = { channel, company, ...next };
    for (const key of Object.keys(merged)) if (!merged[key]) delete merged[key];
    navigate('discuss', merged);
  };
  const publicHref = `/discuss?${new URLSearchParams({ channel, ...(company ? { company } : {}) })}`;
  return (
    <section className="study-library algorithm-library discuss-board" lang={english ? 'en' : 'zh'}>
      <header className="cloud-board">
        <p className="route-kicker">{t('社区 · 讨论区', 'Community · Discussion')}</p>
        <h1>{t('讨论区', 'Discussion board')}</h1>
        <p>
          {t(
            '面经、算法、求职和上岸故事，按频道和公司分开聊。友善发言，别贴他人隐私和保密内容。',
            'Interviews, algorithms, careers and offer stories, by channel and company. Be kind; no one’s private details, nothing under NDA.',
          )}
        </p>
        <a className="discuss-board-public" href={publicHref}>
          {t('公开页面', 'Public page')} <ExternalLink size={12} aria-hidden="true" />
        </a>
      </header>
      <nav className="discuss-channels" aria-label={t('频道', 'Channels')}>
        {(Object.keys(CHANNELS) as Channel[]).map((key) => (
          <button key={key} type="button" aria-pressed={key === channel} onClick={() => go({ channel: key })}>
            <strong>{CHANNELS[key][english ? 1 : 0]}</strong>
            <small>{CHANNELS[key][english ? 3 : 2]}</small>
          </button>
        ))}
      </nav>
      <div className="discuss-filter">
        <label>
          <span>{t('公司', 'Company')}</span>
          <select value={company} onChange={(e) => go({ company: e.target.value })}>
            <option value="">{t('全部公司', 'All companies')}</option>
            {company && !companies.some((c) => c.slug === company) && <option value={company}>{company}</option>}
            {companies.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SolutionPosts
        key={`${channel}:${company}:${params.post ?? ''}:${params.q ?? ''}`}
        problemId={discussTarget(channel)}
        tag={company}
        initialQuery={params.q}
        english={english}
        initialPost={params.post}
        signedIn={signedIn}
      />
    </section>
  );
}

/**
 * Under a library item: comments on an experience, or community answers to an interview
 * question (shown once the learner has tried, like the reference answer). Reads signed out.
 */
export function CommunityPosts({ type, slug, signedIn }: { type: string; slug: string; signedIn: boolean }) {
  const english = useLocale() === 'en';
  const experience = type === 'experience';
  return (
    <section className="ct-community" aria-labelledby="ct-community-title">
      <h2 id="ct-community-title">
        {experience ? (english ? 'Comments' : '评论') : english ? 'Community answers' : '社区回答'}
      </h2>
      <SolutionPosts problemId={`${experience ? 'exp' : 'q'}:${slug}`} english={english} signedIn={signedIn} />
    </section>
  );
}
