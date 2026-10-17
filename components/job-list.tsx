'use client';
import { useEffect, useRef, useState } from 'react';
import { AUTH_FLAGS, jobLinkKey, ROLE_NAMES, roleCategory, termKey, termLabel, termOf } from '@/lib/job-tags';
import { companyHubPath } from '@/lib/oa-company-brands';
import { api } from '@/lib/types';
import type { Opening, Pay } from '@/lib/server/job-openings';
import { blockError, putBlocked } from './job-blocked';

// Styles: app/company/jobs.css, imported by the pages that show these.
const KIND: Record<Opening['kind'], [string, string]> = { intern: ['实习', 'Intern'], 'new-grad': ['新毕业生', 'New grad'] };
const UNIT: Record<Pay['unit'], [string, string]> = { year: ['年', 'year'], hour: ['小时', 'hour'], month: ['月', 'month'] };
// What the description says (lib/job-tags.ts authFlags).
const AUTH: [number, string, string][] = [
  [AUTH_FLAGS.noSponsor, '写明不担保', 'No visa sponsorship'],
  [AUTH_FLAGS.citizenOrGc, '需公民/绿卡', 'US citizen / green card'],
  [AUTH_FLAGS.clearance, '需安全许可', 'Security clearance'],
];
const HIDDEN_KEY = 'cswork:jobs:hidden';
const HIDDEN_MAX = 500;

/** The tracker's add form filled in with this opening; saved only once the learner confirms (components/application-tracker.tsx). */
export const trackerAddPath = (company: string, o: Opening) =>
  `/career/tracker?${new URLSearchParams({ add: '1', company, role: o.title, link: o.url })}`;

/** "$45–55 / hour", "$120k–150k / year". */
export function payLabel(p: Pay, zh: boolean) {
  const sign = p.currency === 'CAD' ? 'CA$' : '$';
  const n = (v: number) => (p.unit === 'year' ? `${+(v / 1000).toFixed(1)}k` : v.toLocaleString('en-US'));
  return `${sign}${p.min === p.max ? n(p.min) : `${n(p.min)}–${n(p.max)}`} / ${UNIT[p.unit][zh ? 0 : 1]}`;
}

/** Hidden opening ids in this browser, oldest first; none when storage is off. */
function readHidden(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string').slice(-HIDDEN_MAX) : [];
  } catch {
    return [];
  }
}
function writeHidden(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids.slice(-HIDDEN_MAX)));
  } catch {
    /* Private mode: hidden for this visit only. */
  }
}

/**
 * Openings as rows: the posting on the company's board, kind, role, term, place, pay, H-1B, what the
 * description says about sponsorship, date and an add-to-tracker link. The server renders it whole;
 * in the browser, openings hidden here (localStorage, up to 500) drop out and, signed in, ones
 * already on the tracker board say so. With `blocked` (signed in, every company's list), each row
 * can block its company: all its rows go, with an undo.
 */
export function JobList({
  items,
  names,
  zh,
  withCompany = false,
  signedIn = false,
  h1b = {},
  blocked: initialBlocked,
}: {
  items: Opening[];
  /** Company slug → name. */
  names: Record<string, string>;
  zh: boolean;
  withCompany?: boolean;
  signedIn?: boolean;
  /** Company slug → [fiscal year, new-employment approvals], only once H-1B data is built. */
  h1b?: Record<string, [number, number]>;
  /** The learner's blocked companies; given, rows offer to block theirs. */
  blocked?: string[];
}) {
  const t = (a: string, b: string) => (zh ? a : b);
  // null until mounted, so the first render matches the server's.
  const [hidden, setHidden] = useState<string[] | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [tracked, setTracked] = useState<ReadonlySet<string>>(new Set());
  const toggleRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<HTMLElement | 'toggle' | null>(null);
  const [blocked, setBlocked] = useState(initialBlocked ?? []);
  const [justBlocked, setJustBlocked] = useState<string | null>(null);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockFailed, setBlockFailed] = useState('');
  const undoRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // After a block, focus goes to its undo (''); after an undo, back to that company's first row (its slug).
  const blockFocus = useRef<string | null>(null);
  useEffect(() => setHidden(readHidden()), []);
  useEffect(() => {
    const next = blockFocus.current;
    blockFocus.current = null;
    if (next === '') undoRef.current?.focus();
    else if (next) listRef.current?.querySelector<HTMLElement>(`li[data-company="${next}"] .job-openings-block`)?.focus();
  }, [blocked]);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api<{ items: { link: string }[] }>('oj/applications').then(
      (r) => live && setTracked(new Set(r.items.map((a) => jobLinkKey(a.link)).filter(Boolean))),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [signedIn]);
  // Focus leaves a row as it is hidden: to the next row's button, or the "show hidden" toggle.
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    (next === 'toggle' ? toggleRef.current : next)?.focus();
  }, [hidden]);
  const hiddenSet = new Set(hidden);
  const blockedSet = new Set(blocked);
  const hiddenHere = items.filter((o) => hiddenSet.has(o.id) && !blockedSet.has(o.companySlug)).length;
  function toggle(o: Opening, button: HTMLButtonElement) {
    const ids = hidden ?? [],
      unhide = hiddenSet.has(o.id);
    if (!unhide && !showHidden) {
      const row = button.closest('li');
      focusNext.current = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>('.job-openings-hide') ?? 'toggle';
    }
    const next = unhide ? ids.filter((id) => id !== o.id) : [...ids, o.id].slice(-HIDDEN_MAX);
    setHidden(next);
    writeHidden(next);
  }
  async function block(slug: string, on: boolean) {
    if (blockBusy) return;
    setBlockBusy(true);
    setBlockFailed('');
    try {
      const next = await putBlocked(slug, on);
      blockFocus.current = on ? '' : slug;
      setJustBlocked(on ? slug : null);
      setBlocked(next);
    } catch (e) {
      setBlockFailed(blockError(e, zh));
    } finally {
      setBlockBusy(false);
    }
  }
  return (
    <>
      {justBlocked && (
        <p className="job-hidden-bar">
          <output>
            {zh
              ? `已屏蔽 ${names[justBlocked] ?? justBlocked}，不再显示它的岗位。`
              : `Blocked ${names[justBlocked] ?? justBlocked}: its roles are no longer shown.`}
          </output>
          <button ref={undoRef} type="button" aria-disabled={blockBusy} onClick={() => void block(justBlocked, false)}>
            {t('撤销', 'Undo')}
            <span className="sr-only">
              {t('：屏蔽 ', ': block ')}
              {names[justBlocked] ?? justBlocked}
            </span>
          </button>
        </p>
      )}
      {blockFailed && (
        <p className="job-hidden-bar" role="alert">
          {blockFailed}
        </p>
      )}
      {hiddenHere > 0 && (
        <p className="job-hidden-bar">
          <output>{zh ? `已隐藏 ${hiddenHere} 个岗位` : `${hiddenHere} hidden ${hiddenHere === 1 ? 'opening' : 'openings'}`}</output>
          <button ref={toggleRef} type="button" aria-pressed={showHidden} onClick={() => setShowHidden((on) => !on)}>
            {t('显示已隐藏', 'Show hidden')}
          </button>
        </p>
      )}
      <ul className="job-openings" ref={listRef}>
        {items.map((o) => {
          const isHidden = hiddenSet.has(o.id);
          if ((isHidden && !showHidden) || blockedSet.has(o.companySlug)) return null;
          const company = names[o.companySlug] ?? o.companySlug;
          const day = o.postedAt === null ? null : new Date(o.postedAt).toISOString().slice(0, 10);
          const role = roleCategory(o.title),
            term = termOf(o.title),
            key = termKey(term);
          const sponsor = h1b[o.companySlug];
          return (
            <li key={o.id} data-hidden={isHidden || undefined} data-company={o.companySlug}>
              <a className="job-openings-title" href={o.url} rel="noopener noreferrer nofollow">
                {o.title}
              </a>
              <p className="job-openings-facts">
                {withCompany && <a href={`${companyHubPath(o.companySlug)}#jobs`}>{company}</a>}
                <span className="job-openings-kind" data-kind={o.kind}>
                  {KIND[o.kind][zh ? 0 : 1]}
                </span>
                <span className="job-openings-tag" data-role={role}>
                  {ROLE_NAMES[role][zh ? 0 : 1]}
                </span>
                {(key || term.coop) && <span className="job-openings-tag">{[termLabel(key, zh), term.coop ? 'Co-op' : ''].filter(Boolean).join(' · ')}</span>}
                {o.location && <span>{o.location}</span>}
                {o.pay && <span className="job-openings-pay">{payLabel(o.pay, zh)}</span>}
                {sponsor && <span>{zh ? `H-1B：FY${sponsor[0]} 新批 ${sponsor[1].toLocaleString('zh-CN')} 个` : `H-1B: ${sponsor[1].toLocaleString('en-US')} new approvals in FY${sponsor[0]}`}</span>}
                {o.authFlags > 0 &&
                  AUTH.filter(([bit]) => o.authFlags & bit).map(([bit, zhName, enName]) => (
                    <span key={bit} className="job-openings-auth">
                      {zh ? zhName : enName}
                    </span>
                  ))}
                {day && <time dateTime={day}>{zh ? `发布于 ${day}` : `Posted ${day}`}</time>}
                {isHidden && <span className="job-openings-tag">{t('已隐藏', 'Hidden')}</span>}
              </p>
              <div className="job-openings-actions">
                {tracked.has(jobLinkKey(o.url)) ? (
                  <a className="job-openings-tracked" href="/career/tracker">
                    {t('已在投递看板', 'On your tracker')}
                    <span className="sr-only">
                      {t('：', ': ')}
                      {o.title}
                    </span>
                  </a>
                ) : (
                  <a className="job-openings-add" href={trackerAddPath(company, o)}>
                    {t('加入投递追踪', 'Add to tracker')}
                    <span className="sr-only">
                      {t('：', ': ')}
                      {o.title}
                    </span>
                  </a>
                )}
                <button type="button" className="job-openings-hide" onClick={(e) => toggle(o, e.currentTarget)}>
                  {isHidden ? t('取消隐藏', 'Unhide') : t('隐藏', 'Hide')}
                  <span className="sr-only">
                    {t('：', ': ')}
                    {o.title}
                  </span>
                </button>
                {initialBlocked && (
                  <button type="button" className="job-openings-block" aria-disabled={blockBusy} onClick={() => void block(o.companySlug, true)}>
                    {t('不看这家公司', 'Block company')}
                    <span className="sr-only">
                      {t('：', ': ')}
                      {company}
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
