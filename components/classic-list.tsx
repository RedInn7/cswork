'use client';

import '@/app/classic-list.css';
import { useEffect, useState } from 'react';
import { Check, Circle, Clock3, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import {
  classicList,
  leetcodeUrl,
  levelOf,
  problemAppHref,
  problemTitle,
} from '@/lib/classic-lists';
import type { Navigate } from './learning';

type ClassicItem = {
  number: number;
  slug: string;
  titleZh: string;
  titleEn: string;
  difficulty: string;
  judgeProblemId: string | null;
  external: boolean;
  stop: { slug: string; code: string; nameZh: string; nameEn: string } | null;
  solved: boolean;
  progressStatus: 'solved' | 'attempted' | 'not_started';
  judging: boolean;
};
type Counts = { total: number; ready: number; solved: number };
type ClassicView = {
  collection: Counts & { id: string };
  groups: (Counts & { nameZh: string; nameEn: string; items: ClassicItem[] })[];
  sequence: string[];
  nextProblemId: string | null;
};

/**
 * A classic list mapped onto the bank: its own groups, a progress bar over the
 * problems judgeable here, and external rows that open LeetCode. No metro line.
 */
export function ClassicList({
  slug,
  navigate,
  signedIn,
}: {
  slug: string;
  navigate: Navigate;
  signedIn: boolean;
}) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const list = classicList(slug)!;
  const [data, setData] = useState<ClassicView | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    api<ClassicView>(`oj/library?${new URLSearchParams({ collection: slug })}`)
      .then((result) => {
        if (current) setData(result);
      })
      .catch((reason: Error) => {
        if (current) setError(reason.message);
      });
    return () => {
      current = false;
    };
  }, [slug, retry]);
  useEffect(() => {
    // Solving a problem elsewhere updates the bar when the learner comes back.
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener('focus', refresh);
    window.addEventListener('cswork:practice-progress-changed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('cswork:practice-progress-changed', refresh);
    };
  }, []);

  const open = (event: React.MouseEvent, judgeProblemId: string) => {
    // Let modified clicks open the problem in a new tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (!signedIn) {
      window.dispatchEvent(new Event('cswork:auth-required'));
      return;
    }
    rememberProblemSequence(data?.sequence ?? [judgeProblemId]);
    navigate('problem', { problem: judgeProblemId });
  };
  const status = (item: ClassicItem) =>
    item.solved
      ? t('已通过', 'Solved')
      : item.judging
        ? t('判题中', 'Judging')
        : item.progressStatus === 'attempted'
          ? t('未通过', 'Not solved')
          : t('未开始', 'Not started');

  return (
    <section className="study-library study-bank classic-list" lang={english ? 'en' : 'zh'}>
      <div className="classic-board">
        <p className="classic-kicker">{t('经典题单 · 对照', 'Classic list · Mapped')}</p>
        <h2>{english ? list.nameEn : list.nameZh}</h2>
        <p className="classic-lead">
          {t(
            '按题号对照到本站题库：能在本站判题的直接提交，其余标为站外，去力扣练习。由 cswork 对照整理，并非官方题单。',
            'Mapped to this bank by problem number: judgeable problems are submitted here, the rest are marked external and practiced on LeetCode. Mapped by cswork; not the official list.',
          )}{' '}
          <a href={list.source} target="_blank" rel="noopener noreferrer">
            {t('原题单', 'Original list')}
            <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only">{t('（在新窗口打开）', ' (opens in a new tab)')}</span>
          </a>
        </p>
        {data && (
          <div className="classic-meter">
            <p className="classic-count">
              {signedIn ? (
                <>
                  <strong>{data.collection.solved}</strong>
                  {t(
                    ` / ${data.collection.ready} 道本站可判题已通过`,
                    ` of ${data.collection.ready} judgeable problems solved`,
                  )}
                </>
              ) : (
                <>
                  <strong>{data.collection.ready}</strong>
                  {t(
                    ` / ${data.collection.total} 道可在本站判题`,
                    ` of ${data.collection.total} judgeable here`,
                  )}
                </>
              )}
              <span>
                {t(
                  `站外 ${data.collection.total - data.collection.ready} 道，不计入进度`,
                  `${data.collection.total - data.collection.ready} external, not counted`,
                )}
              </span>
            </p>
            {signedIn && (
              <progress
                className="classic-progress"
                max={data.collection.ready || 1}
                value={data.collection.solved}
                aria-label={t('本站可判题进度', 'Progress on judgeable problems')}
              />
            )}
            {!signedIn ? (
              <Button
                className="route-cta"
                onClick={() => window.dispatchEvent(new Event('cswork:auth-required'))}
              >
                {t('登录后记录进度', 'Sign in to track progress')}
              </Button>
            ) : data.nextProblemId ? (
              <Button
                className="route-cta"
                onClick={() => {
                  rememberProblemSequence(data.sequence);
                  navigate('problem', { problem: data.nextProblemId! });
                }}
              >
                {data.collection.solved ? t('开始下一题', 'Start next problem') : t('从第一题开始', 'Start the first problem')}
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {error ? (
        <div className="study-state" role="alert">
          <p>{t(error, englishMessage(error))}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError('');
              setRetry((n) => n + 1);
            }}
          >
            {t('重新加载', 'Reload')}
          </Button>
        </div>
      ) : !data ? (
        <output className="study-state">{t('正在加载题单…', 'Loading collection…')}</output>
      ) : (
        data.groups.map((group, index) => (
          <section
            key={`${group.nameEn}-${index}`}
            className="classic-group"
            aria-labelledby={`classic-group-${index}`}
          >
            <h3 className="route-heading" id={`classic-group-${index}`}>
              <span className="route-heading-name">{english ? group.nameEn : group.nameZh}</span>
              <span className="route-count">
                {signedIn ? (
                  <>
                    {group.solved}/{group.ready}
                    <meter min={0} max={group.ready || 1} value={group.solved} aria-hidden="true" />
                  </>
                ) : (
                  t(`本站可判 ${group.ready} / ${group.total}`, `${group.ready} of ${group.total} judgeable`)
                )}
              </span>
            </h3>
            <div className="study-list">
              {group.items.map((item) => {
                const level = levelOf(item.difficulty);
                const next =
                  signedIn && !!item.judgeProblemId && item.judgeProblemId === data.nextProblemId;
                const body = (
                  <>
                    <span
                      className="study-progress"
                      data-progress={item.external ? undefined : item.solved ? 'solved' : item.progressStatus}
                      title={item.external ? undefined : status(item)}
                    >
                      {item.external ? (
                        <ExternalLink size={15} aria-hidden="true" />
                      ) : item.solved ? (
                        <Check size={18} aria-hidden="true" />
                      ) : item.judging ? (
                        <Clock3 size={18} aria-hidden="true" />
                      ) : item.progressStatus === 'attempted' ? (
                        <Circle size={18} aria-hidden="true" />
                      ) : null}
                      {!item.external && signedIn && <span className="sr-only">{status(item)}</span>}
                    </span>
                    <span className="study-row-main">
                      <strong>
                        {next && <span className="route-next-pill">{t('下一题', 'Next')}</span>}
                        <span className="study-number">{item.number}.</span>{' '}
                        {problemTitle(item, english)}
                      </strong>
                      <span className="classic-tags">
                        {item.stop && (
                          <span
                            className="classic-stop"
                            title={t(`500 路第 ${item.stop.code} 站`, `Line 500, stop ${item.stop.code}`)}
                          >
                            <span className="route-code">{item.stop.code}</span>
                            {english ? item.stop.nameEn : item.stop.nameZh}
                          </span>
                        )}
                        {item.external && (
                          <span className="classic-external">{t('站外', 'External')}</span>
                        )}
                      </span>
                    </span>
                    <span className="study-level" data-level={level?.[0]}>
                      {level ? (english ? level[2] : level[1]) : ''}
                    </span>
                  </>
                );
                // Every row is a link, so the zebra stripes stay regular.
                return item.judgeProblemId ? (
                  <a
                    key={item.number}
                    className="study-row"
                    href={problemAppHref(item.judgeProblemId)}
                    data-next={next || undefined}
                    onClick={(event) => open(event, item.judgeProblemId!)}
                  >
                    {body}
                  </a>
                ) : (
                  <a
                    key={item.number}
                    className="study-row"
                    data-external
                    href={leetcodeUrl(item.number, item.slug, english)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {body}
                    <span className="sr-only">{t('（在新窗口打开）', ' (opens in a new tab)')}</span>
                  </a>
                );
              })}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
