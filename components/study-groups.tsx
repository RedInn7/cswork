'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Copy, Crown, Flag, RefreshCw, Snowflake, Trash2, UserMinus, X } from 'lucide-react';
import { api } from '@/lib/types';
import { useLocale } from '@/lib/i18n';
import { englishMessage } from '@/lib/messages-en';
import { ROUTE_SECTIONS, STOP_NAMES } from '@/lib/route-stops';
import { level, practiceStats } from './practice-calendar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import type { Navigate } from './learning';
import { CampPanel, type Camp } from './group-camp';
import { ChatCompose, ChatLog, Report, useChat, type ChatItem } from './chat-log';
import { CHAT_RETENTION_DAYS } from '@/lib/community';
import '@/app/learner-cloud.css';
import '@/app/study-groups.css';

type T = (zh: string, en: string) => string;
const DAY = 86400000;
/** Days on the check-in board. */
const GRID_DAYS = 14;
/** Line order, numbered like the stations on the map. */
const STOPS = ROUTE_SECTIONS.flatMap((s) => s.slugs);
type Member = {
  key: string;
  name: string;
  role: 'owner' | 'member';
  me: boolean;
  joinedAt: number;
  /** Distinct ACs per local day, oldest first, today last. */
  days: number[];
  week: number;
  goal: number | null;
  /** The cohort: how many of today's problems are done (which ones on the reader's own row), and of the plan. */
  camp?: { today: number; done: number; mine?: boolean[] } | null;
};
export type GroupDetail = {
  id: string;
  name: string;
  role: 'owner' | 'member' | null;
  inviteCode: string | null;
  goal: { text: string; stop: string | null; stopTotal: number; setAt: number | null } | null;
  camp?: Camp | null;
  max: number;
  createdAt: number;
  members: Member[];
};
type Preview = { id: string | null; name: string; members: number; full: boolean };
type GroupRow = { id: string; name: string; role: 'owner' | 'member'; joinedAt: number; members: number };
const plain = (e: React.MouseEvent) => !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
const tz = () => new Date().getTimezoneOffset();

export function stopLabel(slug: string, t: T) {
  const names = STOP_NAMES[slug];
  return names ? t(`第 ${STOPS.indexOf(slug) + 1} 站 · ${names[0]}`, `Stop ${STOPS.indexOf(slug) + 1} · ${names[1]}`) : slug;
}

/**
 * Per member: the streak (practiceStats with the free freezes; freezes bought with points
 * stay private, so a buyer's own calendar may run longer), today's count and the last 14
 * local days. `dayStamp` is Date#toDateString().
 */
export function memberBoard(member: Member, dayStamp: string) {
  const midnight = new Date(dayStamp).getTime();
  const last = member.days.length - 1;
  // Counts become stand-in activity at local noon; ids only need to be distinct per day.
  const activity = member.days.flatMap((count, i) =>
    Array.from({ length: count }, (_, k) => ({
      problem_id: `${i}:${k}`,
      created_at: midnight + (i - last) * DAY + DAY / 2,
    })),
  );
  const stats = practiceStats(activity, dayStamp, true, [], 14);
  return {
    streak: stats.streak,
    today: stats.today,
    cells: stats.cells.slice(stats.todayIndex - GRID_DAYS + 1, stats.todayIndex + 1),
  };
}

/** The weekly leaderboard: most distinct ACs since Monday, then the longer streak, then name. */
export function weeklyRanks<M extends { name: string; week: number; streak: number }>(members: readonly M[]) {
  return [...members].sort((a, b) => b.week - a.week || b.streak - a.streak || a.name.localeCompare(b.name));
}

function Privacy({ t }: { t: T }) {
  return (
    <p className="group-privacy">
      {t(
        `隐私：组员只能看到你在本组填的昵称、每天通过的题数、连续天数和本周通过数，开营后还有营期任务的完成数，以及你在小组聊天里发的消息（保留 ${CHAT_RETENTION_DAYS} 天）；看不到你的邮箱、账号名、代码或具体做了哪些题。随时可以退出。`,
        `Privacy: members see only the name you use in this group, how many problems you solve each day, your streak and this week’s count, plus how many cohort tasks you’ve done once a cohort starts, and what you write in the group chat (kept ${CHAT_RETENTION_DAYS} days). Never your email, account name, code or which problems. You can leave any time.`,
      )}
    </p>
  );
}
/** The group's chat: members write, a teacher moderating only reads; others' lines can be reported. */
function GroupChat({ id, member, t, english }: { id: string; member: boolean; t: T; english: boolean }) {
  const chat = useChat<{ items: ChatItem[] }>(`oj/groups/${encodeURIComponent(id)}/messages`);
  const post = async (path: string, body: unknown) => {
    try {
      chat.show(await api<{ items: ChatItem[] }>(`oj/groups/${encodeURIComponent(id)}/${path}`, body));
      return true;
    } catch (e) {
      chat.setError((e as Error).message);
      return false;
    }
  };
  return (
    <section className="group-panel group-chat" aria-labelledby="group-chat">
      <h2 id="group-chat">{t('小组聊天', 'Group chat')}</h2>
      <p className="group-sub">
        {t(
          `只有组员能看到（有消息被举报时，审核老师也能查看），保留 ${CHAT_RETENTION_DAYS} 天；三位组员举报的消息会先隐藏。`,
          `Members only (and moderating teachers while a message is reported), kept ${CHAT_RETENTION_DAYS} days; a message three members report is hidden.`,
        )}
      </p>
      {chat.data ? (
        <ChatLog
          items={chat.data.items}
          label={t('聊天记录', 'Chat messages')}
          english={english}
          named
          fresh={chat.fresh}
          actions={(m) =>
            member &&
            (m.mine ? (
              <button type="button" onClick={() => void post('unsay', { message: m.id })}>
                {t('撤回', 'Unsend')}
              </button>
            ) : (
              <Report path={`oj/groups/${encodeURIComponent(id)}/report`} body={{ message: m.id }} english={english} />
            ))
          }
        />
      ) : (
        !chat.error && <output className="group-sub">{t('正在加载聊天…', 'Loading the chat…')}</output>
      )}
      <ErrorLine error={chat.error} t={t} />
      {member && (
        <ChatCompose
          label={t('发消息给小组', 'Message the group')}
          english={english}
          send={(body) => post('messages', { body })}
        />
      )}
    </section>
  );
}
function ErrorLine({ error, t }: { error: string; t: T }) {
  return error ? (
    <p className="cloud-error" role="alert">
      {t(error, englishMessage(error))}
    </p>
  ) : null;
}

/** ?view=group: your groups; &id= opens one, &join=<code> is an invite link. */
export function StudyGroups({ navigate, params }: { navigate: Navigate; params: Record<string, string> }) {
  const english = useLocale() === 'en';
  const t: T = (zh, en) => (english ? en : zh);
  return (
    <section className="study-library algorithm-library cloud-lists study-groups" lang={english ? 'en' : 'zh'}>
      {params.join ? (
        <JoinCard key={params.join} code={params.join} navigate={navigate} t={t} />
      ) : params.id ? (
        <GroupPage key={params.id} id={params.id} navigate={navigate} t={t} english={english} />
      ) : (
        <GroupIndex navigate={navigate} t={t} />
      )}
    </section>
  );
}

function GroupIndex({ navigate, t }: { navigate: Navigate; t: T }) {
  const [groups, setGroups] = useState<GroupRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState({ name: '', displayName: '' });
  const [code, setCode] = useState('');
  useEffect(() => {
    let live = true;
    api<{ items: GroupRow[] }>('oj/groups').then(
      (r) => live && setGroups(r.items),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  async function submit() {
    setBusy(true);
    setError('');
    try {
      const made = await api<GroupDetail>(`oj/groups?tz=${tz()}`, {
        name: create.name.trim(),
        displayName: create.displayName.trim(),
      });
      navigate('group', { id: made.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="cloud-board">
        <p className="route-kicker">{t('学习小组 · 每日打卡', 'Study groups · Daily check-in')}</p>
        <h1>{t('学习小组', 'Study groups')}</h1>
        <p>
          {t(
            '拉上同学一起刷：每个人每天通过的题自动打卡，看连续天数、本周排行和小组目标。',
            'Practice with friends: every accepted problem checks you in for the day. See streaks, a weekly leaderboard and the group’s goal.',
          )}
        </p>
        <form
          className="cloud-board-new group-new"
          onSubmit={(e) => {
            e.preventDefault();
            if (create.name.trim() && create.displayName.trim()) void submit();
          }}
        >
          <input
            value={create.name}
            maxLength={40}
            onChange={(e) => setCreate({ ...create, name: e.target.value })}
            placeholder={t('小组名称，例如「秋招冲刺」', 'Group name, e.g. "Fall recruiting sprint"')}
            aria-label={t('小组名称', 'Group name')}
          />
          <input
            value={create.displayName}
            maxLength={24}
            onChange={(e) => setCreate({ ...create, displayName: e.target.value })}
            placeholder={t('你在组里的昵称', 'Your name in the group')}
            aria-label={t('你在组里的昵称', 'Your name in the group')}
          />
          <button type="submit" disabled={busy || !create.name.trim() || !create.displayName.trim()}>
            {t('建小组', 'Create group')}
          </button>
        </form>
        <form
          className="cloud-board-new"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) navigate('group', { join: code.trim() });
          }}
        >
          <input
            value={code}
            maxLength={20}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('有邀请码？输入 8 位邀请码', 'Have an invite? Enter the 8-character code')}
            aria-label={t('邀请码', 'Invite code')}
            autoCapitalize="characters"
            spellCheck={false}
          />
          <button type="submit" className="is-quiet" disabled={!code.trim()}>
            {t('加入', 'Join')}
          </button>
        </form>
      </header>
      <ErrorLine error={error} t={t} />
      {groups === null && !error ? (
        <output className="study-state">{t('正在加载…', 'Loading…')}</output>
      ) : groups?.length ? (
        <ul className="study-list progress-list cloud-list-rows">
          {groups.map((g) => (
            <li key={g.id}>
              <a
                className="study-row progress-row"
                href={`/?view=group&id=${g.id}`}
                onClick={(e) => {
                  if (!plain(e)) return;
                  e.preventDefault();
                  navigate('group', { id: g.id });
                }}
              >
                <span className="cloud-vis" data-public={g.role === 'owner' || undefined}>
                  {g.role === 'owner' ? <Crown size={16} aria-hidden="true" /> : <span className="group-dot" aria-hidden="true" />}
                </span>
                <span className="study-row-main">
                  <strong>{g.name}</strong>
                  <span className="study-row-secondary">
                    {[g.role === 'owner' ? t('组长', 'Owner') : t('组员', 'Member'), t(`${g.members} 人`, `${g.members} member${g.members === 1 ? '' : 's'}`)].join(' · ')}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        groups && (
          <div className="study-state progress-empty">
            <p>
              {t(
                '还没有加入小组。建一个，把邀请链接发到群里；或者输入朋友给的邀请码。',
                'You’re not in a group yet. Create one and share the invite link, or enter a code a friend sent you.',
              )}
            </p>
          </div>
        )
      )}
      <Privacy t={t} />
    </>
  );
}

function JoinCard({ code, navigate, t }: { code: string; navigate: Navigate; t: T }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    api<Preview>(`oj/groups/preview?code=${encodeURIComponent(code)}`).then(
      (r) => live && setPreview(r),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [code]);
  async function join() {
    setBusy(true);
    setError('');
    try {
      const joined = await api<GroupDetail>(`oj/groups/join?tz=${tz()}`, { code, displayName: name.trim() });
      navigate('group', { id: joined.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="cloud-board">
        <p className="route-kicker">{t('小组邀请', 'Group invite')}</p>
        {preview ? (
          <>
            <h1>{t(`加入「${preview.name}」`, `Join “${preview.name}”`)}</h1>
            <p>{t(`${preview.members} 人在组里打卡`, `${preview.members} member${preview.members === 1 ? '' : 's'} checking in`)}</p>
            {preview.id ? (
              <div className="cloud-actions">
                <button type="button" onClick={() => navigate('group', { id: preview.id! })}>
                  {t('你已在组里，打开小组', 'You’re in. Open the group')}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            ) : preview.full ? (
              <p>{t('这个小组已经满 50 人了。', 'This group already has 50 members.')}</p>
            ) : (
              <form
                className="cloud-board-new"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) void join();
                }}
              >
                <input
                  value={name}
                  maxLength={24}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('你在组里的昵称', 'Your name in the group')}
                  aria-label={t('你在组里的昵称', 'Your name in the group')}
                />
                <button type="submit" disabled={busy || !name.trim()}>
                  {t('加入小组', 'Join group')}
                </button>
              </form>
            )}
          </>
        ) : (
          <h1>{error ? t('邀请无效', 'Invite not valid') : t('正在查看邀请…', 'Checking the invite…')}</h1>
        )}
      </header>
      <ErrorLine error={error} t={t} />
      <Privacy t={t} />
      <p>
        <a
          className="cloud-pop-link"
          href="/?view=group"
          onClick={(e) => {
            if (!plain(e)) return;
            e.preventDefault();
            navigate('group');
          }}
        >
          {t('我的学习小组', 'My study groups')}
        </a>
      </p>
    </>
  );
}

type Confirm = { kind: 'delete' } | { kind: 'leave' } | { kind: 'remove'; key: string; name: string };

function GroupPage({ id, navigate, t, english }: { id: string; navigate: Navigate; t: T; english: boolean }) {
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ name: string; goalText: string; goalStop: string } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [copied, setCopied] = useState('');
  const [dayStamp] = useState(() => new Date().toDateString());
  useEffect(() => {
    let live = true;
    api<GroupDetail>(`oj/groups/${encodeURIComponent(id)}?tz=${tz()}`).then(
      (g) => live && setGroup(g),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [id]);
  const board = useMemo(
    () => (group ? group.members.map((m) => ({ ...m, ...memberBoard(m, dayStamp) })) : []),
    [group, dayStamp],
  );
  async function run(task: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const post = (path: string, body: unknown) =>
    run(async () => setGroup(await api<GroupDetail>(`oj/groups/${id}${path}?tz=${tz()}`, body)));
  const back = (
    <a
      href="/?view=group"
      onClick={(e) => {
        if (!plain(e)) return;
        e.preventDefault();
        navigate('group');
      }}
    >
      {t('学习小组', 'Study groups')}
    </a>
  );
  if (!group)
    return error ? (
      <div className="study-state" role="alert">
        <p>{t(error, englishMessage(error))}</p>
        <p>{back}</p>
      </div>
    ) : (
      <output className="study-state">{t('正在加载…', 'Loading…')}</output>
    );
  const manage = group.role === 'owner' || group.role === null; // null: a teacher moderating
  const link = group.inviteCode
    ? `${typeof location === 'undefined' ? '' : location.origin}/?view=group&join=${group.inviteCode}`
    : '';
  const monday = new Date(dayStamp);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const goal = group.goal;
  const thisWeek = !!goal?.setAt && goal.setAt >= monday.getTime();
  const done = goal?.stop ? group.members.filter((m) => (m.goal ?? 0) >= goal.stopTotal).length : 0;
  const ranks = weeklyRanks(board);
  const top = Math.max(1, ...ranks.map((m) => m.week));
  const days = board[0]?.cells ?? [];
  const date = (time: number) =>
    english
      ? new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `${new Date(time).getMonth() + 1}月${new Date(time).getDate()}日`;
  const weekday = (time: number) =>
    english ? 'MTWTFSS'[(new Date(time).getDay() + 6) % 7] : '一二三四五六日'[(new Date(time).getDay() + 6) % 7];
  const copy = (what: string, text: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(what),
      () => {},
    );
  return (
    <>
      <nav className="cloud-crumbs" aria-label={t('导航路径', 'Breadcrumb')}>
        {back}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{group.name}</span>
      </nav>
      <header className="cloud-board">
        <p className="route-kicker">
          {group.role === 'owner'
            ? t('你是组长', 'You own this group')
            : group.role
              ? t('学习小组', 'Study group')
              : t('管理员查看', 'Moderator view')}
          {' · '}
          {t(`${group.members.length}/${group.max} 人`, `${group.members.length}/${group.max} members`)}
        </p>
        {editing ? (
          <form
            className="cloud-edit"
            onSubmit={(e) => {
              e.preventDefault();
              void post('', editing).then((saved) => saved && setEditing(null));
            }}
          >
            <label>
              {t('小组名称', 'Group name')}
              <input
                value={editing.name}
                maxLength={40}
                required
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>
            <label>
              {t('本周目标', 'This week’s goal')}
              <input
                value={editing.goalText}
                maxLength={120}
                placeholder={t('例如：周日前做完二分查找站', 'e.g. Finish binary search by Sunday')}
                onChange={(e) => setEditing({ ...editing, goalText: e.target.value })}
              />
            </label>
            <label>
              {t('目标站点（可选）', 'Goal stop (optional)')}
              <select value={editing.goalStop} onChange={(e) => setEditing({ ...editing, goalStop: e.target.value })}>
                <option value="">{t('不指定', 'None')}</option>
                {STOPS.map((slug) => (
                  <option key={slug} value={slug}>
                    {stopLabel(slug, t)}
                  </option>
                ))}
              </select>
            </label>
            <div className="cloud-edit-actions">
              <button type="submit" disabled={busy || !editing.name.trim()}>
                {t('保存', 'Save')}
              </button>
              <button type="button" className="is-quiet" onClick={() => setEditing(null)}>
                {t('取消', 'Cancel')}
              </button>
            </div>
          </form>
        ) : (
          <h1>{group.name}</h1>
        )}
        <div className="group-goal" data-stale={(goal && !thisWeek) || undefined}>
          <span className="group-goal-label">
            {goal && !thisWeek
              ? t(`小组目标 · ${goal.setAt ? date(goal.setAt) : ''} 设定`, `Group goal · set ${goal.setAt ? date(goal.setAt) : ''}`)
              : t('本周目标', 'This week’s goal')}
          </span>
          {goal ? (
            <>
              {goal.text && <strong>{goal.text}</strong>}
              {goal.stop && (
                <a
                  href={`/topics/${goal.stop}`}
                  className="group-goal-stop"
                >
                  {stopLabel(goal.stop, t)}
                  <span>
                    {t(`${done}/${group.members.length} 人已完成`, `${done} of ${group.members.length} finished`)}
                  </span>
                </a>
              )}
            </>
          ) : (
            <span className="group-goal-empty">
              {manage ? t('还没有目标，点「设目标」给大家定一个。', 'No goal yet. Use “Set goal” to give everyone one.') : t('组长还没有设目标。', 'The owner hasn’t set a goal yet.')}
            </span>
          )}
        </div>
        {group.inviteCode && (
          <div className="cloud-share group-invite">
            <label>
              {t('邀请链接', 'Invite link')}
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            </label>
            <button type="button" onClick={() => copy('link', link)}>
              <Copy size={14} aria-hidden="true" />
              {copied === 'link' ? t('已复制', 'Copied') : t('复制链接', 'Copy link')}
            </button>
            <button type="button" className="is-quiet" onClick={() => copy('code', group.inviteCode!)}>
              <span className="group-code" aria-label={t(`邀请码 ${group.inviteCode}`, `Invite code ${group.inviteCode}`)}>
                {group.inviteCode}
              </span>
              {copied === 'code' ? t('已复制', 'Copied') : t('复制邀请码', 'Copy code')}
            </button>
          </div>
        )}
        <div className="cloud-actions">
          {manage && !editing && (
            <button
              type="button"
              className="is-quiet"
              onClick={() =>
                setEditing({ name: group.name, goalText: goal?.text ?? '', goalStop: goal?.stop ?? '' })
              }
            >
              {t('设目标 / 改名', 'Set goal / rename')}
            </button>
          )}
          {group.role === 'owner' && (
            <button type="button" className="is-quiet" disabled={busy} onClick={() => void post('/rotate', {})}>
              <RefreshCw size={14} aria-hidden="true" />
              {t('换邀请码', 'New invite code')}
            </button>
          )}
          {group.role && renaming === null && (
            <button
              type="button"
              className="is-quiet"
              onClick={() => setRenaming(group.members.find((m) => m.me)?.name ?? '')}
            >
              {t('改我的昵称', 'Change my name')}
            </button>
          )}
          {group.role === 'member' && (
            <button type="button" className="is-quiet is-danger" onClick={() => setConfirm({ kind: 'leave' })}>
              {t('退出小组', 'Leave group')}
            </button>
          )}
          {manage && (
            <button type="button" className="is-quiet is-danger" onClick={() => setConfirm({ kind: 'delete' })}>
              <Trash2 size={14} aria-hidden="true" />
              {t('解散小组', 'Disband')}
            </button>
          )}
          {group.role === 'member' && (
            <button type="button" className="is-quiet" aria-expanded={reporting !== null} onClick={() => setReporting(reporting === null ? '' : null)}>
              <Flag size={14} aria-hidden="true" />
              {t('举报', 'Report')}
            </button>
          )}
        </div>
        {renaming !== null && (
          <form
            className="cloud-board-new"
            onSubmit={(e) => {
              e.preventDefault();
              void post('/me', { displayName: renaming.trim() }).then((saved) => saved && setRenaming(null));
            }}
          >
            <input
              value={renaming}
              maxLength={24}
              onChange={(e) => setRenaming(e.target.value)}
              aria-label={t('你在组里的昵称', 'Your name in the group')}
            />
            <button type="submit" disabled={busy || !renaming.trim()}>
              {t('保存', 'Save')}
            </button>
            <button type="button" className="is-quiet" onClick={() => setRenaming(null)}>
              {t('取消', 'Cancel')}
            </button>
          </form>
        )}
        {reporting !== null &&
          (reported ? (
            <p className="group-reported" role="status">
              {t('已提交给管理员，谢谢。', 'Sent to the site team. Thank you.')}
            </p>
          ) : (
            <form
              className="cloud-edit"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  api('tickets', {
                    title: t(`[group:${group.id}] 举报学习小组`, `[group:${group.id}] Study group report`),
                    body: `${reporting.trim()}\n\n${t('小组', 'Group')}: ${group.id}`,
                  }),
                ).then((sent) => sent && setReported(true));
              }}
            >
              <label>
                {t('哪里有问题？（不当的小组名、昵称或目标）', 'What’s wrong? (an abusive group name, member name or goal)')}
                <textarea value={reporting} maxLength={1000} rows={3} required onChange={(e) => setReporting(e.target.value)} />
              </label>
              <div className="cloud-edit-actions">
                <button type="submit" disabled={busy || !reporting.trim()}>
                  {t('提交举报', 'Send report')}
                </button>
                <button type="button" className="is-quiet" onClick={() => setReporting(null)}>
                  {t('取消', 'Cancel')}
                </button>
              </div>
            </form>
          ))}
      </header>
      <ErrorLine error={error} t={t} />

      <CampPanel
        camp={group.camp ?? null}
        members={board}
        group={group.name}
        manage={manage}
        member={!!group.role}
        busy={busy}
        save={(body) => post('/camp', body)}
        t={t}
        english={english}
      />

      <section className="group-panel" aria-labelledby="group-checkins">
        <h2 id="group-checkins">{t('近 14 天打卡', 'Check-ins, last 14 days')}</h2>
        <div className="group-grid-scroll" tabIndex={0} role="region" aria-labelledby="group-checkins">
          <table className="group-grid">
            <thead>
              <tr>
                <th scope="col">{t('成员', 'Member')}</th>
                {days.map((cell) => (
                  <th key={cell.time} scope="col" className="group-day">
                    <abbr title={date(cell.time)}>
                      <span aria-hidden="true">{weekday(cell.time)}</span>
                      <span aria-hidden="true">{new Date(cell.time).getDate()}</span>
                      <span className="sr-only">{date(cell.time)}</span>
                    </abbr>
                  </th>
                ))}
                <th scope="col">{t('连续', 'Streak')}</th>
                <th scope="col">{t('今日', 'Today')}</th>
                {goal?.stop && <th scope="col">{t('目标', 'Goal')}</th>}
                {manage && (
                  <th scope="col">
                    <span className="sr-only">{t('管理', 'Manage')}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {board.map((m) => (
                <tr key={m.key} data-me={m.me || undefined}>
                  <th scope="row">
                    <span className="group-name">{m.name}</span>
                    {m.role === 'owner' && (
                      <>
                        <Crown size={12} className="group-crown" aria-hidden="true" />
                        <span className="sr-only">{t('（组长）', ' (owner)')}</span>
                      </>
                    )}
                    {m.me && <span className="group-you">{t('我', 'you')}</span>}
                  </th>
                  {m.cells.map((cell, i) => (
                    <td key={cell.time}>
                      <span
                        className="group-led"
                        data-level={level(cell.count)}
                        data-frozen={cell.frozen || undefined}
                        data-today={i === m.cells.length - 1 || undefined}
                        title={`${date(cell.time)} · ${cell.count ? t(`通过 ${cell.count} 题`, `${cell.count} solved`) : cell.frozen ? t('保护日', 'Streak freeze') : t('无', 'None')}`}
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        {cell.count ? cell.count : cell.frozen ? t('保护日', 'freeze') : 0}
                      </span>
                    </td>
                  ))}
                  <td className="group-num" data-hot={m.streak >= 7 || undefined}>
                    {m.streak}
                  </td>
                  <td className="group-num">{m.today}</td>
                  {goal?.stop && (
                    <td className="group-num" data-done={(m.goal ?? 0) >= goal.stopTotal || undefined}>
                      {m.goal ?? 0}/{goal.stopTotal}
                    </td>
                  )}
                  {manage && (
                    <td>
                      {m.role !== 'owner' && (
                        <button
                          type="button"
                          className="cloud-remove"
                          aria-label={t(`移出 ${m.name}`, `Remove ${m.name}`)}
                          onClick={() => setConfirm({ kind: 'remove', key: m.key, name: m.name })}
                        >
                          <UserMinus size={15} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="group-legend">
          <Snowflake size={12} aria-hidden="true" />
          {t(
            '每天至少通过一题算打卡；冰蓝格是断签保护日（每月免费 2 次；用积分买的补签卡只计入个人日历）。',
            'Solving at least one problem checks you in. Ice-blue days are streak freezes (the free 2 a month; ones bought with points count on your own calendar only).',
          )}
        </p>
      </section>

      <section className="group-panel" aria-labelledby="group-week">
        <h2 id="group-week">{t('本周排行', 'This week’s leaderboard')}</h2>
        <p className="group-sub">{t('按周一以来通过的不同题目数', 'Distinct problems solved since Monday')}</p>
        <ol className="group-ranks">
          {ranks.map((m, i) => (
            <li key={m.key} data-me={m.me || undefined}>
              <span className="group-rank">{i + 1}</span>
              <span className="group-name">{m.name}</span>
              <span
                className="group-rank-bar"
                style={{ '--frac': m.week / top } as React.CSSProperties}
                aria-hidden="true"
              />
              <b>{t(`${m.week} 题`, `${m.week}`)}</b>
            </li>
          ))}
        </ol>
      </section>
      <GroupChat id={group.id} member={!!group.role} t={t} english={english} />
      <Privacy t={t} />

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === 'delete'
                ? t('解散这个小组？', 'Disband this group?')
                : confirm?.kind === 'leave'
                  ? t('退出这个小组？', 'Leave this group?')
                  : t(`把 ${confirm?.kind === 'remove' ? confirm.name : ''} 移出小组？`, `Remove ${confirm?.kind === 'remove' ? confirm.name : ''}?`)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'delete'
                ? t('所有成员都会被移出，邀请链接失效。大家的提交记录不受影响。', 'Everyone is removed and the invite link stops working. Nobody’s submissions are affected.')
                : confirm?.kind === 'leave'
                  ? t('组员将不再看到你的打卡。之后可以用邀请链接重新加入。', 'Members will stop seeing your check-ins. You can rejoin with an invite link.')
                  : t('邀请码会随之更换，对方不能再用旧链接加入；记得把新链接发给还没加入的人。', 'The invite code changes too, so they cannot rejoin with the old link; share the new one with anyone still to join.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X size={14} aria-hidden="true" />
              {t('取消', 'Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const c = confirm;
                if (c?.kind === 'remove') void post('/remove', { member: c.key });
                else if (c)
                  void run(async () => {
                    await api(`oj/groups/${id}/${c.kind}`, {});
                    navigate('group');
                  });
              }}
            >
              {confirm?.kind === 'delete' ? t('解散', 'Disband') : confirm?.kind === 'leave' ? t('退出', 'Leave') : t('移出', 'Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
