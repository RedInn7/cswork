'use client';

import '@/app/classic-list.css';
import { useEffect, useRef, useState } from 'react';
import { Check, Circle, Clock3, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { readLcSite, saveLcSite, type LcSite } from '@/lib/lc-site';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import {
  bookProblemUrl,
  classicList,
  leetcodeUrl,
  levelOf,
  problemAppHref,
  problemTitle,
  refLabel,
  sourceUrl,
} from '@/lib/classic-lists';
import type { Navigate } from './learning';

type ClassicItem = {
  /** The LeetCode number; null for a book problem without a main-site twin. */
  number: number | null;
  /** Book lists: the problem's number in the book and its leetcode.cn slug. */
  ref?: string | null;
  refSlug?: string | null;
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
  /** Ticked by hand on the list (members; guests keep theirs in this browser). */
  done?: boolean;
};
type Counts = { total: number; ready: number; solved: number };
type ClassicView = {
  collection: Counts & { id: string; mapped?: number };
  groups: (Counts & { nameZh: string; nameEn: string; items: ClassicItem[] })[];
  sequence: string[];
  nextProblemId: string | null;
};

/**
 * A guest's hand ticks on one list: LeetCode numbers in this browser. Book problems
 * without a LeetCode twin have no number and cannot be ticked.
 */
const tickKey = (slug: string) => `cswork:list-done:${slug}`;
function readTicks(slug: string) {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(tickKey(slug)) ?? '[]');
    return Array.isArray(saved) ? saved.filter((n): n is number => Number.isInteger(n) && n > 0) : [];
  } catch {
    return [];
  }
}
function saveTicks(slug: string, numbers: ReadonlySet<number>) {
  try {
    if (numbers.size) localStorage.setItem(tickKey(slug), JSON.stringify([...numbers]));
    else localStorage.removeItem(tickKey(slug));
  } catch {}
}
const flip = (set: ReadonlySet<number>, number: number, on: boolean) => {
  const next = new Set(set);
  if (on) next.add(number);
  else next.delete(number);
  return next;
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
        if (!current) return;
        setData(result);
        setError('');
      })
      .catch((reason: Error) => {
        // A failed background refresh keeps the list already on screen.
        if (current) setError(reason.message);
      });
    return () => {
      current = false;
    };
  }, [slug, retry]);
  // External links open the LeetCode site this browser chose; by default the reader's language's.
  const [site, setSite] = useState<LcSite>(english ? 'com' : 'cn');
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- The saved site exists only in the browser, after hydration.
    setSite(readLcSite(english));
  }, [english]);
  // Hand ticks by LeetCode number: this browser's for guests, user_marks (done) for members.
  const [ticks, setTicks] = useState<ReadonlySet<number>>(new Set());
  const [tickError, setTickError] = useState('');
  useEffect(() => {
    // oxlint-disable-next-line react/react-compiler -- A guest's ticks live only in this browser.
    if (!signedIn) setTicks(new Set(readTicks(slug)));
  }, [slug, signedIn]);
  useEffect(() => {
    if (signedIn && data)
      // oxlint-disable-next-line react/react-compiler -- The account's ticks arrive with the list.
      setTicks(
        new Set(data.groups.flatMap((group) => group.items.flatMap((item) => (item.done && item.number ? [item.number] : [])))),
      );
  }, [signedIn, data]);
  // The first signed-in visit moves this browser's ticks into the account, then clears them here.
  const merged = useRef('');
  useEffect(() => {
    if (!signedIn || merged.current === slug) return;
    merged.current = slug;
    const local = readTicks(slug).slice(0, 500);
    if (!local.length) return;
    api('oj/marks', { targets: local.map((n) => `problem:lc-${n}`), mark: 'done' }).then(
      () => {
        saveTicks(slug, new Set());
        setRetry((n) => n + 1);
      },
      // ponytail: a failed merge keeps the ticks here and retries on the next visit.
      () => {},
    );
  }, [signedIn, slug]);
  async function tick(number: number, on: boolean) {
    setTickError('');
    setTicks((current) => flip(current, number, on));
    if (!signedIn) return saveTicks(slug, flip(ticks, number, on));
    try {
      await api('oj/marks', { target: `problem:lc-${number}`, mark: 'done', on });
    } catch (reason) {
      setTicks((current) => flip(current, number, !on));
      setTickError((reason as Error).message);
    }
  }
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
    rememberProblemSequence(data?.sequence ?? [judgeProblemId], slug);
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

  // Done = solved here or ticked by hand, over the problems with a LeetCode number (a
  // number listed twice counts once); book problems without a twin cannot be tracked.
  const count = (items: ClassicItem[]) => {
    const rows = [...new Map(items.flatMap((item) => (item.number ? [[item.number, item] as const] : []))).values()];
    const manual = rows.filter((item) => !item.solved && ticks.has(item.number!)).length;
    return { total: rows.length, done: rows.filter((item) => item.solved).length + manual, manual };
  };
  const progress = count(data?.groups.flatMap((group) => group.items) ?? []);
  const groupCounts = data?.groups.map((group) => count(group.items)) ?? [];

  return (
    <section className="study-library study-bank classic-list" lang={english ? 'en' : 'zh'}>
      <div className="classic-board">
        <p className="classic-kicker">{t('经典题单 · 对照', 'Classic list · Mapped')}</p>
        {/* The page's only h1: the bank's own heading is skipped for classic lists. */}
        <h1>{english ? list.nameEn : list.nameZh}</h1>
        <p className="classic-lead">
          {t(
            '按题号对照到本站题库：能在本站判题的直接提交，其余标为站外，去力扣练习。由 cswork 对照整理，并非官方题单。',
            'Mapped to this bank by problem number: judgeable problems are submitted here, the rest are marked external and practiced on LeetCode. Mapped by cswork; not the official list.',
          )}{' '}
          <a href={sourceUrl(list)} target="_blank" rel="noopener noreferrer">
            {t('原题单', 'Original list')}
            <ExternalLink size={12} aria-hidden="true" />
            <span className="sr-only">{t('（在新窗口打开）', ' (opens in a new tab)')}</span>
          </a>
        </p>
        <fieldset className="classic-site">
          <legend className="sr-only">{t('站外题打开的力扣站点', 'LeetCode site for external problems')}</legend>
          {(['cn', 'com'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={site === value}
              onClick={() => {
                setSite(value);
                saveLcSite(value);
              }}
            >
              {value === 'cn' ? t('力扣 CN', 'LeetCode CN') : 'LeetCode US'}
            </button>
          ))}
        </fieldset>
        {data && (
          <div className="classic-meter">
            <p className="classic-count">
              <strong>{progress.done}</strong>
              {t(` / ${progress.total} 道已完成`, ` of ${progress.total} done`)}
              <span>
                {t(
                  `本站可判 ${data.collection.ready} 道，其余去力扣做完后手动打勾`,
                  `${data.collection.ready} judgeable here; tick the rest by hand`,
                )}
              </span>
              {progress.manual > 0 && (
                <span className="classic-manual">
                  {t(`其中 ${progress.manual} 道是手动标记`, `${progress.manual} ticked by hand`)}
                </span>
              )}
              {list.refLabel && data.collection.mapped !== undefined && (
                <span className="classic-coverage">
                  {t(
                    `${data.collection.mapped} / ${data.collection.total} 道有力扣主站对应题`,
                    `${data.collection.mapped} of ${data.collection.total} have a LeetCode twin`,
                  )}
                </span>
              )}
            </p>
            <progress
              className="classic-progress"
              max={progress.total || 1}
              value={progress.done}
              aria-label={t('题单进度：判题通过或手动标记', 'List progress: solved here or ticked by hand')}
            />
            {!signedIn ? (
              <Button
                className="route-cta"
                onClick={() => window.dispatchEvent(new Event('cswork:auth-required'))}
              >
                {t('登录后同步到所有设备', 'Sign in to sync across devices')}
              </Button>
            ) : data.nextProblemId ? (
              <Button
                className="route-cta"
                onClick={() => {
                  rememberProblemSequence(data.sequence, slug);
                  navigate('problem', { problem: data.nextProblemId! });
                }}
              >
                {data.collection.solved ? t('开始下一题', 'Start next problem') : t('从第一题开始', 'Start the first problem')}
              </Button>
            ) : null}
          </div>
        )}
        {tickError && (
          <p className="classic-tick-error" role="alert">
            {t(tickError, englishMessage(tickError))}
          </p>
        )}
      </div>
      {error && !data ? (
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
            <h2 className="route-heading" id={`classic-group-${index}`}>
              <span className="route-heading-name">{english ? group.nameEn : group.nameZh}</span>
              <span className="route-count">
                {groupCounts[index].done}/{groupCounts[index].total}
                <meter
                  min={0}
                  max={groupCounts[index].total || 1}
                  value={groupCounts[index].done}
                  aria-hidden="true"
                />
              </span>
            </h2>
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
                        <span className="study-number">
                          {item.ref ? refLabel(list, item.ref, english) : `${item.number}.`}
                        </span>{' '}
                        {problemTitle(item, english)}
                      </strong>
                      <span className="classic-tags">
                        {item.ref && item.number !== null && (
                          <span
                            className="classic-twin"
                            title={t('力扣主站上的同一道题', 'The same problem on LeetCode')}
                          >
                            LeetCode {item.number}
                          </span>
                        )}
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
                const link = item.judgeProblemId ? (
                  <a
                    className="study-row"
                    href={problemAppHref(item.judgeProblemId)}
                    data-next={next || undefined}
                    onClick={(event) => open(event, item.judgeProblemId!)}
                  >
                    {body}
                  </a>
                ) : (
                  <a
                    className="study-row"
                    data-external
                    href={
                      // A book problem opens its own page; a LeetCode number its problem.
                      item.refSlug
                        ? bookProblemUrl(item.refSlug)
                        : leetcodeUrl(item.number!, item.slug, site)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {body}
                    <span className="sr-only">{t('（在新窗口打开）', ' (opens in a new tab)')}</span>
                  </a>
                );
                const name = `${item.ref ? refLabel(list, item.ref, english) : `${item.number}.`} ${problemTitle(item, english)}`;
                // Every row is a tick box and a link, so the zebra stripes stay regular.
                return (
                  <div key={item.ref ?? item.number} className="classic-row">
                    {item.number ? (
                      <label className="classic-tick" title={t('做完了就打勾（不经过判题）', 'Tick when done (not judged)')}>
                        <input
                          type="checkbox"
                          checked={ticks.has(item.number)}
                          aria-label={t(`已做：${name}`, `Done: ${name}`)}
                          onChange={(event) => void tick(item.number!, event.target.checked)}
                        />
                      </label>
                    ) : (
                      <span className="classic-tick" />
                    )}
                    {link}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
