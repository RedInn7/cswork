'use client';
import { useState } from 'react';
import { CalendarRange, Download, ImageIcon, Share2, X } from 'lucide-react';
import { classicLists } from '@/lib/classic-lists';

type T = (zh: string, en: string) => string;
export type Camp = {
  plan: string;
  planName: [string, string];
  perDay: number;
  startDate: string;
  /** Day N for the reader: below 1 before the start, above `days` once finished. */
  day: number;
  days: number;
  total: number;
  tasks: { id: string; number: number; titleZh: string; titleEn: string; difficulty: string }[];
};
type Member = {
  key: string;
  name: string;
  me: boolean;
  streak: number;
  today: number;
  camp?: { today: boolean[]; done: number } | null;
};
const localDate = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const problemHref = (id: string) => `/?${new URLSearchParams({ view: 'problem', problem: id })}`;

/** What the check-in card says, in the reader's language. */
export function cardFacts(
  input: { group: string; camp: Camp | null; streak: number; today: number; done: number | null; date: string },
  english: boolean,
) {
  const t: T = (zh, en) => (english ? en : zh);
  const running = !!input.camp && input.camp.day >= 1 && input.camp.day <= input.camp.days;
  return {
    kicker: t('CSWORK · 学习小组打卡', 'CSWORK · STUDY GROUP CHECK-IN'),
    group: input.group,
    big: running ? t(`第 ${input.camp!.day} 天`, `DAY ${input.camp!.day}`) : input.date,
    stats: [
      [String(input.today), t('今日通过', 'solved today')],
      [String(input.streak), t('连续天数', 'day streak')],
      ...(input.camp && input.done !== null ? [[`${input.done}/${input.camp.total}`, input.camp.planName[english ? 1 : 0]]] : []),
    ] as [string, string][],
    footer: `${input.date} · cswork.org`,
  };
}

/** Draws the 1080×1350 card; false when this browser has no 2D canvas. */
export function drawCard(canvas: HTMLCanvasElement, facts: ReturnType<typeof cardFacts>) {
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return false;
  const W = (canvas.width = 1080);
  const H = (canvas.height = 1350);
  const sans = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif';
  ctx.fillStyle = '#0e1a2b';
  ctx.fillRect(0, 0, W, H);
  // The car display's dot texture.
  ctx.fillStyle = 'rgba(238,243,248,0.05)';
  for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#2ebd85';
  ctx.fillRect(0, 0, W, 14);
  const fit = (text: string, max: number) => {
    let s = text;
    while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -1);
    return s === text ? s : `${s.slice(0, -1)}…`;
  };
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffb23f';
  ctx.font = `800 34px ${sans}`;
  ctx.fillText(facts.kicker, 90, 150);
  ctx.fillStyle = '#eef3f8';
  ctx.font = `800 76px ${sans}`;
  ctx.fillText(fit(facts.group, W - 180), 90, 260);
  ctx.fillStyle = '#ffb23f';
  ctx.shadowColor = 'rgba(255,178,63,0.55)';
  ctx.shadowBlur = 40;
  ctx.font = `900 ${facts.big.length > 8 ? 150 : 210}px ${sans}`;
  ctx.fillText(fit(facts.big, W - 180), 82, 560);
  ctx.shadowBlur = 0;
  facts.stats.forEach(([value, label], i) => {
    const y = 760 + i * 170;
    ctx.fillStyle = '#1e2b40';
    ctx.fillRect(90, y - 110, W - 180, 140);
    ctx.fillStyle = '#2ebd85';
    ctx.fillRect(90, y - 110, 10, 140);
    ctx.fillStyle = '#eef3f8';
    ctx.font = `800 88px ${sans}`;
    ctx.fillText(value, 130, y);
    ctx.fillStyle = '#9fb0c6';
    ctx.font = `600 36px ${sans}`;
    ctx.fillText(fit(label, W - 260 - ctx.measureText(value).width), 160 + ctx.measureText(value).width, y - 6);
  });
  ctx.fillStyle = '#9fb0c6';
  ctx.font = `600 32px ${sans}`;
  ctx.fillText(facts.footer, 90, H - 90);
  return true;
}

/**
 * The cohort panel on a group page: day N of the plan, today's problems with a done grid per
 * member, the owner's settings, and a check-in card drawn in the browser (download or share).
 */
export function CampPanel({
  camp,
  members,
  group,
  manage,
  member,
  busy,
  save,
  t,
  english,
}: {
  camp: Camp | null;
  members: Member[];
  group: string;
  manage: boolean;
  /** The reader is in the group (a moderating teacher is not). */
  member: boolean;
  busy: boolean;
  save: (body: unknown) => Promise<boolean>;
  t: T;
  english: boolean;
}) {
  const [editing, setEditing] = useState<{ plan: string; perDay: number; startDate: string } | null>(null);
  const [card, setCard] = useState<{ url: string; blob: Blob | null } | 'unsupported' | null>(null);
  const me = members.find((m) => m.me);
  async function makeCard() {
    const facts = cardFacts(
      { group, camp, streak: me?.streak ?? 0, today: me?.today ?? 0, done: me?.camp?.done ?? null, date: localDate() },
      english,
    );
    const canvas = document.createElement('canvas');
    if (!drawCard(canvas, facts)) return setCard('unsupported');
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    setCard({ url: canvas.toDataURL('image/png'), blob });
  }
  const file = card && card !== 'unsupported' && card.blob ? new File([card.blob], `cswork-checkin-${localDate()}.png`, { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] });
  const running = !!camp && camp.day >= 1 && camp.day <= camp.days;
  const form = editing && (
    <form
      className="cloud-edit group-camp-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(editing).then((ok) => ok && setEditing(null));
      }}
    >
      <label>
        {t('题单', 'List')}
        <select value={editing.plan} onChange={(e) => setEditing({ ...editing, plan: e.target.value })}>
          {classicLists.map((list) => (
            <option key={list.slug} value={list.slug}>
              {english ? list.nameEn : list.nameZh}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('每天几题', 'Problems a day')}
        <input
          type="number"
          min={1}
          max={10}
          required
          value={editing.perDay}
          onChange={(e) => setEditing({ ...editing, perDay: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
        />
      </label>
      <label>
        {t('开营日期（第 1 天）', 'Start date (day 1)')}
        <input type="date" required value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
      </label>
      <div className="cloud-edit-actions">
        <button type="submit" disabled={busy}>
          {t('保存营期', 'Save cohort')}
        </button>
        <button type="button" className="is-quiet" onClick={() => setEditing(null)}>
          {t('取消', 'Cancel')}
        </button>
      </div>
    </form>
  );
  const share = member && (
    <div className="group-card">
      <button type="button" className="group-card-make" onClick={() => void makeCard()}>
        <ImageIcon size={14} aria-hidden="true" />
        {t('生成今日打卡卡片', 'Make today’s check-in card')}
      </button>
      {card === 'unsupported' && <p role="status">{t('这个浏览器不能生成图片。', 'This browser can’t draw the image.')}</p>}
      {card && card !== 'unsupported' && (
        <figure>
          {/* oxlint-disable-next-line nextjs/no-img-element -- A data URL drawn in this browser. */}
          <img src={card.url} alt={t('今日打卡卡片预览', 'Preview of today’s check-in card')} width={216} height={270} />
          <figcaption className="cloud-actions">
            <a href={card.url} download={`cswork-checkin-${localDate()}.png`}>
              <Download size={14} aria-hidden="true" />
              {t('下载图片', 'Download')}
            </a>
            {canShare && (
              <button type="button" onClick={() => void navigator.share({ files: [file!], title: group }).catch(() => {})}>
                <Share2 size={14} aria-hidden="true" />
                {t('分享', 'Share')}
              </button>
            )}
            <button type="button" className="is-quiet" aria-label={t('关闭预览', 'Close preview')} onClick={() => setCard(null)}>
              <X size={14} aria-hidden="true" />
            </button>
          </figcaption>
        </figure>
      )}
    </div>
  );
  if (!camp)
    return manage || member ? (
      <section className="group-panel group-camp" data-empty aria-labelledby="group-camp-title">
        <h2 id="group-camp-title">
          <CalendarRange size={16} aria-hidden="true" /> {t('营期', 'Cohort')}
        </h2>
        {manage ? (
          editing ? (
            form
          ) : (
            <p className="group-sub">
              {t('选一个题单开营：大家每天做同样的几道题，按天打卡。', 'Start a cohort: everyone works the same few problems from a list each day.')}{' '}
              <button
                type="button"
                className="group-camp-start"
                onClick={() => setEditing({ plan: classicLists[0].slug, perDay: 2, startDate: localDate() })}
              >
                {t('开营', 'Start a cohort')}
              </button>
            </p>
          )
        ) : (
          <p className="group-sub">{t('组长还没有开营。', 'The owner hasn’t started a cohort.')}</p>
        )}
        {share}
      </section>
    ) : null;
  const name = english ? camp.planName[1] : camp.planName[0];
  return (
    <section className="group-panel group-camp" aria-labelledby="group-camp-title">
      <p className="group-camp-kicker">
        {t('营期', 'Cohort')} · {name} · {t(`每天 ${camp.perDay} 题`, `${camp.perDay} a day`)}
      </p>
      <h2 id="group-camp-title" className="group-camp-day">
        {running ? (
          <>
            <span className="group-camp-led">{t(`第 ${camp.day} 天`, `Day ${camp.day}`)}</span>
            <small>{t(`共 ${camp.days} 天`, `of ${camp.days}`)}</small>
          </>
        ) : camp.day < 1 ? (
          t(`${1 - camp.day} 天后开营（${camp.startDate}）`, `Starts in ${1 - camp.day} day${camp.day === 0 ? '' : 's'} (${camp.startDate})`)
        ) : (
          t('营期已完成', 'Cohort complete')
        )}
      </h2>
      {running && (
        <span
          className="group-camp-track"
          style={{ '--frac': camp.day / Math.max(1, camp.days) } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
      {camp.tasks.length > 0 && (
        <div className="group-grid-scroll" tabIndex={0} role="region" aria-label={t('今日任务完成情况', 'Today’s tasks by member')}>
          <table className="group-grid group-camp-grid">
            <thead>
              <tr>
                <th scope="col">{t('今日任务', 'Today')}</th>
                {camp.tasks.map((task) => (
                  <th key={task.id} scope="col">
                    <a href={problemHref(task.id)} title={english ? task.titleEn || task.titleZh : task.titleZh || task.titleEn}>
                      {task.number}. {english ? task.titleEn || task.titleZh : task.titleZh || task.titleEn}
                    </a>
                  </th>
                ))}
                <th scope="col">{t('累计', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.key} data-me={m.me || undefined}>
                  <th scope="row">
                    <span className="group-name">{m.name}</span>
                    {m.me && <span className="group-you">{t('我', 'you')}</span>}
                  </th>
                  {camp.tasks.map((task, i) => {
                    const done = !!m.camp?.today[i];
                    return (
                      <td key={task.id}>
                        <span className="group-led" data-level={done ? 4 : 0} aria-hidden="true" />
                        <span className="sr-only">{done ? t('已完成', 'done') : t('未完成', 'not yet')}</span>
                      </td>
                    );
                  })}
                  <td className="group-num" data-done={(m.camp?.done ?? 0) >= camp.total || undefined}>
                    {m.camp?.done ?? 0}/{camp.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {manage &&
        (editing ? (
          form
        ) : (
          <div className="cloud-actions">
            <button
              type="button"
              className="is-quiet"
              onClick={() => setEditing({ plan: camp.plan, perDay: camp.perDay, startDate: camp.startDate })}
            >
              {t('调整营期', 'Edit cohort')}
            </button>
            <button type="button" className="is-quiet is-danger" disabled={busy} onClick={() => void save({ plan: '' })}>
              {t('结束营期', 'End cohort')}
            </button>
          </div>
        ))}
      {share}
    </section>
  );
}
