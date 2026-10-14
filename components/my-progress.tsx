'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Circle, Star } from 'lucide-react';
import { api, type Boot } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { verdictNames } from '@/lib/oj-client';
import { problemTitle } from '@/lib/problems';
import { rememberProblemSequence } from '@/lib/problem-sequence';
import { STOP_NAMES } from '@/lib/route-stops';
import {
  dueReviews,
  REVIEW_LADDER,
  wrongBook,
  type PracticeHistoryItem,
} from '@/lib/practice-review';
import { PracticeCalendar, usePracticeStats } from './practice-calendar';
import { BadgeWall, progressBadges } from './achievements';
import { MockCloudHistory } from './mock-cloud-history';
import { MyExperienceSubmissions } from './experience-submissions';
import { Button } from './ui/button';
import type { Navigate } from './learning';
import '@/app/my-progress.css';

type Mark = { target: string; mark: string; createdAt: number };
type Note = { target: string; updatedAt: number };
type Data = {
  history: PracticeHistoryItem[];
  marks: Mark[];
  notes: Note[];
  /** Line 500 stops with this round's progress, for the badges; empty when the list failed. */
  sections: { slug: string; solved: number; total: number }[];
  /** OA employer names for the company badges; empty when the OA library failed. */
  companyNames: Map<string, string>;
  /** Read once per load, so every tab agrees on "today". */
  now: number;
};
type Tab = 'history' | 'mistakes' | 'review' | 'starred' | 'redo' | 'notes' | 'badges';
const TABS: [Tab, string, string][] = [
  ['history', '练习历史', 'History'],
  ['mistakes', '错题本', 'Mistakes'],
  ['review', '到期复习', 'Due for review'],
  ['starred', '收藏', 'Starred'],
  ['redo', '待重做', 'To redo'],
  ['notes', '有笔记', 'With notes'],
  ['badges', '徽章', 'Badges'],
];
const DAY = 86400000;
const problemOf = (target: string) =>
  target.startsWith('problem:') ? target.slice(8) : null;
const source = (id: string): 'lc' | 'oa' | 'sql' | 'course' =>
  id.startsWith('lc-')
    ? 'lc'
    : id.startsWith('oa-')
      ? 'oa'
      : id.startsWith('sql-')
        ? 'sql'
        : 'course';

/** ?view=progress: practice history, mistakes, reviews due today, and the learner's marks and notes. */
export function MyProgress({
  boot,
  navigate,
  tab: initialTab,
}: {
  boot: Boot;
  navigate: Navigate;
  tab?: string;
}) {
  const english = useLocale() === 'en';
  const t = (zh: string, en: string) => (english ? en : zh);
  const [tab, setTab] = useState<Tab>(
    TABS.some(([key]) => key === initialTab) ? (initialTab as Tab) : 'history',
  );
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [origin, setOrigin] = useState('');
  const [result, setResult] = useState('');
  const [period, setPeriod] = useState('');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stats = usePracticeStats(boot.activity ?? [], english, boot.daily?.done);
  // Line 500's daily target, read only: the trip itself lives on the bank page.
  // This view only renders after the client bootstrap, so storage is safe here.
  const [target] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('cswork:practice:daily-target'));
      return [1, 2, 3, 5].includes(saved) ? saved : 3;
    } catch {
      return 3;
    }
  });
  useEffect(() => {
    let current = true;
    Promise.all([
      api<{ items: PracticeHistoryItem[] }>('oj/history'),
      api<{ items: Mark[] }>('oj/marks'),
      api<{ items: Note[] }>('oj/notes'),
      // Badges only: the rest of the page works without it.
      api<{ collection?: { sections: Data['sections'] } }>(
        'oj/library?collection=ling-selected-500',
      ).catch(() => null),
      api<{ companies: { slug: string; name: string }[] }>('oj/oa-library').catch(() => null),
    ])
      .then(([history, marks, notes, line, oa]) => {
        if (current)
          setData({
            history: history.items,
            marks: marks.items,
            notes: notes.items,
            sections: line?.collection?.sections ?? [],
            companyNames: new Map(oa?.companies.map((c) => [c.slug, c.name])),
            now: Date.now(),
          });
      })
      .catch((reason: Error) => {
        if (current) setError(reason.message);
      });
    return () => {
      current = false;
    };
  }, [retry]);

  const summaries = new Map(boot.problems.map((p) => [p.id, p]));
  const byId = new Map((data?.history ?? []).map((item) => [item.problemId, item]));
  const marked = (mark: string) =>
    (data?.marks ?? []).flatMap((m) => {
      const id = m.mark === mark ? problemOf(m.target) : null;
      return id ? [{ id, at: m.createdAt }] : [];
    });
  const starredIds = new Set(marked('star').map((m) => m.id));
  const due = data ? dueReviews(data.history, data.now) : [];
  const mistakes = data ? wrongBook(data.history) : [];
  const personId = boot.person?.id;
  const badges = useMemo(
    () =>
      data
        ? progressBadges({
            sections: data.sections,
            history: data.history,
            problems: boot.problems,
            userId: personId,
            now: data.now,
            companyNames: data.companyNames,
          })
        : [],
    [data, boot.problems, personId],
  );
  const noted = (data?.notes ?? []).flatMap((n) => {
    const id = problemOf(n.target);
    return id ? [{ id, at: n.updatedAt }] : [];
  });
  const counts: Record<Tab, number> = {
    history: data?.history.length ?? 0,
    mistakes: mistakes.length,
    review: due.length,
    starred: starredIds.size,
    redo: marked('redo').length,
    notes: noted.length,
    badges: badges.filter((b) => b.earned).length,
  };
  const date = (time: number) =>
    new Date(time).toLocaleDateString(english ? 'en-US' : 'zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  const verdict = (status: string) => {
    const [zh, en] = verdictNames[status] ?? [status, status];
    return t(zh, en);
  };
  const tried = (item: PracticeHistoryItem) =>
    t(`提交 ${item.attempts} 次`, `${item.attempts} submission${item.attempts > 1 ? 's' : ''}`);
  const sourceName = (id: string) =>
    ({ lc: 'LeetCode', oa: 'OA', sql: t('SQL 专项', 'SQL track'), course: t('课程练习', 'Course') })[
      source(id)
    ];

  /** One problem row; `detail` is the tab's own line under the title. */
  function row(id: string, detail: string[], list: string[]) {
    const summary = summaries.get(id);
    const item = byId.get(id);
    const progress = item?.firstAcAt
      ? 'solved'
      : item
        ? 'attempted'
        : 'not_started';
    const label = {
      solved: t('已通过', 'Solved'),
      attempted: t('未通过', 'Not solved'),
      not_started: t('未提交', 'Not submitted'),
    }[progress];
    const stop = item?.stop ? STOP_NAMES[item.stop] : undefined;
    const href = `/?${new URLSearchParams({ view: 'problem', problem: id })}`;
    return (
      <li key={id}>
        <a
          className="study-row progress-row"
          href={href}
          data-progress={progress}
          onClick={(event) => {
            // Modified clicks keep the browser's own link behaviour (new tab, etc.).
            if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
              return;
            event.preventDefault();
            rememberProblemSequence(list);
            navigate('problem', { problem: id });
          }}
        >
          <span className="study-progress" data-progress={progress} title={label}>
            {progress === 'solved' ? (
              <Check size={18} aria-hidden="true" />
            ) : progress === 'attempted' ? (
              <Circle size={18} aria-hidden="true" />
            ) : null}
            <span className="sr-only">{label}</span>
          </span>
          <span className="study-row-main">
            <strong>
              {source(id) === 'lc' && (
                <span className="study-number">{id.slice(3)}.</span>
              )}{' '}
              {summary ? problemTitle(summary, english ? 'en' : 'zh') : id}
              {starredIds.has(id) && (
                <>
                  <Star className="study-star" size={14} aria-hidden="true" />
                  <span className="sr-only">{t('（已收藏）', ' (starred)')}</span>
                </>
              )}
            </strong>
            <span className="study-row-secondary progress-detail">
              {stop && <span className="progress-stop">{t(...stop)}</span>}
              {[sourceName(id), ...detail].join(' · ')}
            </span>
          </span>
          <span
            className="study-level"
            data-level={summary?.difficulty.toLowerCase()}
          >
            {summary
              ? t(
                  summary.difficulty,
                  ({ 简单: 'Easy', 中等: 'Medium', 困难: 'Hard' } as Record<string, string>)[
                    summary.difficulty
                  ] || summary.difficulty,
                )
              : '—'}
          </span>
        </a>
      </li>
    );
  }
  function list(
    entries: { id: string; detail: string[] }[],
    empty: [string, string],
  ) {
    if (!entries.length)
      return (
        <div className="study-state progress-empty">
          <p>{t(...empty)}</p>
          <Button variant="outline" onClick={() => navigate('problems')}>
            {t('去题库刷题', 'Go to the Problem Bank')}
            <ArrowRight size={15} />
          </Button>
        </div>
      );
    const ids = entries.map((entry) => entry.id);
    return (
      <ul className="study-list progress-list">
        {entries.map((entry) => row(entry.id, entry.detail, ids))}
      </ul>
    );
  }

  function panel() {
    if (!data) return null;
    if (tab === 'badges') return <BadgeWall badges={badges} english={english} />;
    if (tab === 'history') {
      const since = period ? data.now - Number(period) * DAY : 0;
      const shown = data.history.filter(
        (item) =>
          (!origin || source(item.problemId) === origin) &&
          (!result || (result === 'solved') === !!item.firstAcAt) &&
          item.lastAt >= since,
      );
      return (
        <>
          <fieldset className="study-filters progress-filters">
            <legend className="sr-only">{t('筛选练习历史', 'Filter history')}</legend>
            <label>
              {t('来源', 'Source')}
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option value="">{t('全部', 'All')}</option>
                <option value="lc">LeetCode</option>
                <option value="oa">OA</option>
              </select>
            </label>
            <label>
              {t('结果', 'Result')}
              <select value={result} onChange={(e) => setResult(e.target.value)}>
                <option value="">{t('全部', 'All')}</option>
                <option value="solved">{t('已通过', 'Solved')}</option>
                <option value="unsolved">{t('未通过', 'Not solved')}</option>
              </select>
            </label>
            <label>
              {t('时间', 'When')}
              <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="">{t('全部时间', 'Any time')}</option>
                <option value="7">{t('最近 7 天', 'Last 7 days')}</option>
                <option value="30">{t('最近 30 天', 'Last 30 days')}</option>
                <option value="90">{t('最近 90 天', 'Last 90 days')}</option>
              </select>
            </label>
            <output className="progress-filter-count">
              {t(`${shown.length} 道题`, `${shown.length} problems`)}
            </output>
          </fieldset>
          {list(
            shown.map((item) => ({
              id: item.problemId,
              detail: [
                verdict(item.lastStatus),
                tried(item),
                item.languages.join(' / '),
                t(`最近 ${date(item.lastAt)}`, `Last ${date(item.lastAt)}`),
              ],
            })),
            data.history.length
              ? ['没有符合筛选的记录。', 'Nothing matches these filters.']
              : ['还没有正式提交。去 Line 500 交出第一题吧。', 'No submissions yet. Submit your first Line 500 problem.'],
          )}
        </>
      );
    }
    if (tab === 'mistakes')
      return list(
        mistakes.map((item) => ({
          id: item.problemId,
          detail: item.firstAcAt
            ? [
                t(
                  `通过前失败 ${item.failuresBeforeAc} 次`,
                  `${item.failuresBeforeAc} failures before AC`,
                ),
                t(`${date(item.firstAcAt)} 通过`, `Solved ${date(item.firstAcAt)}`),
              ]
            : [t(`最近：${verdict(item.lastStatus)}`, `Last: ${verdict(item.lastStatus)}`), tried(item)],
        })),
        ['错题本是空的：没有未通过的题，也没有失败两次以上才过的题。', 'No mistakes to revisit: nothing unsolved, nothing that took two or more failures.'],
      );
    if (tab === 'review')
      return list(
        due.map(({ item, level, dueAt }) => {
          const late = Math.floor((data.now - dueAt) / DAY);
          return {
            id: item.problemId,
            detail: [
              t(`第 ${level}/${REVIEW_LADDER.length} 次复习`, `Review ${level} of ${REVIEW_LADDER.length}`),
              late > 0
                ? t(`逾期 ${late} 天`, `${late} day${late > 1 ? 's' : ''} overdue`)
                : t('今天到期', 'Due today'),
            ],
          };
        }),
        ['今天没有到期的复习。通过的题会在 3、7、21、60 天后回来找你。', 'Nothing due today. Solved problems come back after 3, 7, 21 and 60 days.'],
      );
    const entries = tab === 'notes' ? noted : marked(tab === 'starred' ? 'star' : 'redo');
    return list(
      entries.map(({ id, at }) => {
        const item = byId.get(id);
        return {
          id,
          detail: [
            item ? verdict(item.lastStatus) : t('还没提交', 'Not submitted yet'),
            tab === 'notes'
              ? t(`笔记 ${date(at)} 更新`, `Note updated ${date(at)}`)
              : t(`${date(at)} 标记`, `Marked ${date(at)}`),
          ],
        };
      }),
      tab === 'starred'
        ? ['在题目页标题旁点星标，题目会收进这里。', 'Star a problem next to its title and it lands here.']
        : tab === 'redo'
          ? ['在题目页点「稍后重做」，题目会排进这里。', 'Mark a problem “Redo later” and it queues up here.']
          : ['在题目页的「笔记」标签写下思路，题目会出现在这里。', 'Write in a problem’s Notes tab and it shows up here.'],
    );
  }

  const meters: [string, string, number][] = [
    ['已通过', 'Solved', data?.history.filter((i) => i.firstAcAt).length ?? 0],
    ['今日复习', 'Due today', counts.review],
    ['错题本', 'Mistakes', counts.mistakes],
    ['收藏', 'Starred', counts.starred],
  ];
  return (
    <section className="study-library algorithm-library my-progress" lang={english ? 'en' : 'zh'}>
      <header className="progress-board">
        <div className="progress-board-main">
          <p className="route-kicker">{t('个人站台 · 我的进度', 'Your platform · My progress')}</p>
          <h1>{t('我的进度', 'My progress')}</h1>
          <dl className="progress-meters">
            {meters.map(([zh, en, value]) => (
              <div key={en}>
                <dt>{t(zh, en)}</dt>
                <dd className={en === 'Due today' && value ? 'route-led' : undefined}>
                  {data ? value : '–'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="route-habit">
          <PracticeCalendar stats={stats} signedIn target={target} t={t} />
        </div>
      </header>
      <div
        className="progress-tabs"
        role="tablist"
        aria-label={t('我的进度', 'My progress')}
      >
        {TABS.map(([key, zh, en], index) => (
          <button
            key={key}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            id={`progress-tab-${key}`}
            role="tab"
            type="button"
            aria-selected={tab === key}
            aria-controls="progress-panel"
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              const step =
                event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = (index + step + TABS.length) % TABS.length;
              setTab(TABS[next][0]);
              tabs.current[next]?.focus();
            }}
          >
            {t(zh, en)}
            <span className="progress-count">{data ? counts[key] : ''}</span>
          </button>
        ))}
      </div>
      <div
        id="progress-panel"
        role="tabpanel"
        aria-labelledby={`progress-tab-${tab}`}
        className="progress-panel"
      >
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
          <output className="study-state">{t('正在加载…', 'Loading…')}</output>
        ) : (
          panel()
        )}
      </div>
      {boot.person && <MockCloudHistory userId={boot.person.id} navigate={navigate} english={english} />}
      {boot.person && <MyExperienceSubmissions english={english} navigate={navigate} open={initialTab === 'share'} />}
    </section>
  );
}
